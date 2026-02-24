/**
 * Backup & Restore Routes
 * Provides status, history, and trigger endpoints for the backup system.
 * All endpoints require admin authentication (non-family members only).
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { exec } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';
import * as authService from '../services/auth.service.js';

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function requireAdmin(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    json(res, 401, { error: 'Unauthorized' });
    return false;
  }
  const user = await authService.validateSession(auth.substring(7));
  if (!user) {
    json(res, 401, { error: 'Unauthorized' });
    return false;
  }
  if ((user as any).isFamilyMember) {
    json(res, 403, { error: 'Admin access required' });
    return false;
  }
  return true;
}

function getBackupDir(): string {
  const dir = process.env.ARCELLITE_BACKUP_DIR || path.join(os.homedir(), 'arcellite-backups');
  return dir.replace(/^~/, os.homedir());
}

/** Augment PATH with common PostgreSQL client binary locations */
function buildEnv(): NodeJS.ProcessEnv {
  const pgPaths = [
    '/usr/lib/postgresql/16/bin',
    '/usr/lib/postgresql/15/bin',
    '/usr/lib/postgresql/14/bin',
    '/usr/lib/postgresql/13/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
  ];
  const existing = process.env.PATH || '/usr/bin:/bin';
  const augmented = [...pgPaths, existing].join(':');
  return { ...process.env, PATH: augmented };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 4) return (bytes / 1024 ** 4).toFixed(1) + ' TB';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function dirSizeBytes(dir: string): number {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) total += dirSizeBytes(full);
      else if (entry.isFile()) { try { total += fs.statSync(full).size; } catch {} }
    }
  } catch {}
  return total;
}

interface BackupEntry {
  id: string;
  timestamp: string;
  date: string;
  type: 'daily' | 'weekly';
  sizeBytes: number;
  sizeHuman: string;
  manifest: Record<string, unknown> | null;
}

function listBackups(): BackupEntry[] {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return [];

  const entries: BackupEntry[] = [];
  for (const name of fs.readdirSync(dir)) {
    // Skip temp dirs (failed in-progress backups)
    if (name.startsWith('.tmp_')) continue;

    const full = path.join(dir, name);
    try {
      if (!fs.statSync(full).isDirectory()) continue;
    } catch { continue; }

    const isWeekly = name.startsWith('weekly_');
    const tsMatch = name.match(/(\d{8}_\d{6})/);
    const timestamp = tsMatch ? tsMatch[1] : name;

    let manifest: Record<string, unknown> | null = null;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(full, 'manifest.json'), 'utf8'));
    } catch {}

    // Skip incomplete backups (no manifest)
    if (!manifest) continue;

    const sizeBytes = dirSizeBytes(full);

    let date = '';
    if (tsMatch) {
      const ts = tsMatch[1]; // YYYYmmdd_HHmmss
      date = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}Z`;
    } else if (manifest?.date) {
      date = manifest.date as string;
    }

    entries.push({ id: name, timestamp, date, type: isWeekly ? 'weekly' : 'daily', sizeBytes, sizeHuman: formatBytes(sizeBytes), manifest });
  }

  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ── Job state ──────────────────────────────────────────────────────────
interface Job {
  pid: number;
  startedAt: string;
  log: string[];
}
interface CompletedJob {
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  lines: string[];
}

let runningJob: Job | null = null;
let lastCompletedJob: CompletedJob | null = null;

export async function handleBackupRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> {
  const urlPath = url.split('?')[0];

  if (!urlPath.startsWith('/api/backup')) return false;

  // GET /api/backup/status
  if (urlPath === '/api/backup/status' && req.method === 'GET') {
    if (!(await requireAdmin(req, res))) return true;

    // Auto-create backup dir so it always shows "Ready"
    const dir = getBackupDir();
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore — read-only fs */ }
    }

    const backups = listBackups();
    const last = backups.find(b => b.type === 'daily') ?? backups[0] ?? null;
    const scriptPath = path.join(process.cwd(), 'scripts', 'backup.sh');

    json(res, 200, {
      backupDir: dir,
      backupDirExists: fs.existsSync(dir),
      totalBackups: backups.length,
      lastBackup: last ? { date: last.date, id: last.id, sizeHuman: last.sizeHuman } : null,
      running: runningJob ? { startedAt: runningJob.startedAt } : null,
      backups: backups.slice(0, 20),
      scriptPath,
    });
    return true;
  }

  // POST /api/backup/run
  if (urlPath === '/api/backup/run' && req.method === 'POST') {
    if (!(await requireAdmin(req, res))) return true;

    if (runningJob) {
      json(res, 409, { error: 'A backup is already running' });
      return true;
    }

    const script = path.join(process.cwd(), 'scripts', 'backup.sh');
    if (!fs.existsSync(script)) {
      json(res, 500, { error: `Backup script not found: ${script}` });
      return true;
    }

    // Ensure backup dir exists before starting
    const backupDir = getBackupDir();
    try { fs.mkdirSync(backupDir, { recursive: true }); } catch {}

    const log: string[] = [];
    const startedAt = new Date().toISOString();
    // Clear last completed job so UI shows fresh log
    lastCompletedJob = null;

    const child = exec(`bash "${script}"`, { env: buildEnv() });
    runningJob = { pid: child.pid ?? 0, startedAt, log };

    child.stdout?.on('data', (d: string) => { log.push(...d.split('\n').filter(Boolean)); });
    child.stderr?.on('data', (d: string) => { log.push(...d.split('\n').filter(Boolean)); });

    child.on('close', (code) => {
      // Preserve the log for 10 minutes after completion
      lastCompletedJob = {
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode: code,
        lines: [...log],
      };
      setTimeout(() => { lastCompletedJob = null; }, 10 * 60 * 1000);
      runningJob = null;
    });

    json(res, 202, { message: 'Backup started', startedAt });
    return true;
  }

  // GET /api/backup/log
  if (urlPath === '/api/backup/log' && req.method === 'GET') {
    if (!(await requireAdmin(req, res))) return true;

    if (runningJob) {
      json(res, 200, {
        running: true,
        startedAt: runningJob.startedAt,
        finishedAt: null,
        exitCode: null,
        lines: runningJob.log,
      });
    } else if (lastCompletedJob) {
      json(res, 200, {
        running: false,
        startedAt: lastCompletedJob.startedAt,
        finishedAt: lastCompletedJob.finishedAt,
        exitCode: lastCompletedJob.exitCode,
        lines: lastCompletedJob.lines,
      });
    } else {
      json(res, 200, { running: false, startedAt: null, finishedAt: null, exitCode: null, lines: [] });
    }
    return true;
  }

  // DELETE /api/backup/:id
  if (urlPath.startsWith('/api/backup/') && req.method === 'DELETE') {
    if (!(await requireAdmin(req, res))) return true;
    const id = decodeURIComponent(urlPath.slice('/api/backup/'.length));
    if (!id || id.includes('..') || id.includes('/')) {
      json(res, 400, { error: 'Invalid backup id' });
      return true;
    }
    const dir = getBackupDir();
    const target = path.join(dir, id);
    if (!target.startsWith(dir + path.sep) && target !== dir) {
      json(res, 400, { error: 'Invalid backup id' });
      return true;
    }
    if (!fs.existsSync(target)) {
      json(res, 404, { error: 'Backup not found' });
      return true;
    }
    fs.rmSync(target, { recursive: true, force: true });
    json(res, 200, { message: 'Backup deleted' });
    return true;
  }

  return false;
}
