/**
 * Update Routes
 * Checks GitHub for new versions and runs git-pull-based updates.
 * - GET  /api/update/check  — compare local vs GitHub version (1hr cache)
 * - POST /api/update/run    — start update job (admin only)
 * - GET  /api/update/log    — stream current/last update log
 */

import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import * as authService from '../services/auth.service.js';

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function requireAdmin(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { json(res, 401, { error: 'Unauthorized' }); return false; }
  const user = await authService.validateSession(auth.substring(7));
  if (!user) { json(res, 401, { error: 'Unauthorized' }); return false; }
  if ((user as any).isFamilyMember) { json(res, 403, { error: 'Admin access required' }); return false; }
  return true;
}

// ── Version helpers ───────────────────────────────────────────────────────────

function getLocalVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch { return '0.0.0'; }
}

/** Returns 1 if a > b, -1 if a < b, 0 if equal */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0, nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// ── Update check cache (1 hour) ───────────────────────────────────────────────

interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  lastChecked: string;
  error?: string;
}

let cachedCheck: UpdateCheckResult | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function doUpdateCheck(): Promise<UpdateCheckResult> {
  const currentVersion = getLocalVersion();
  try {
    const resp = await fetch(
      'https://raw.githubusercontent.com/Roberadesissai/arcellite/main/package.json',
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!resp.ok) throw new Error(`GitHub responded with ${resp.status}`);
    const pkg = await resp.json() as { version?: string };
    const latestVersion = pkg.version || '0.0.0';
    return {
      updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
      currentVersion,
      latestVersion,
      lastChecked: new Date().toISOString(),
    };
  } catch (err) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      lastChecked: new Date().toISOString(),
      error: 'Could not reach GitHub to check for updates',
    };
  }
}

// ── Update job state ──────────────────────────────────────────────────────────

interface UpdateJob {
  startedAt: string;
  step: string;
  log: string[];
}
interface CompletedUpdateJob {
  startedAt: string;
  finishedAt: string;
  step: string;
  lines: string[];
  success: boolean;
}

let runningJob: UpdateJob | null = null;
let lastCompletedJob: CompletedUpdateJob | null = null;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function handleUpdateRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> {
  const urlPath = url.split('?')[0];
  if (!urlPath.startsWith('/api/update')) return false;

  // ── GET /api/update/check ────────────────────────────────────────────────────
  if (urlPath === '/api/update/check' && req.method === 'GET') {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) { json(res, 401, { error: 'Unauthorized' }); return true; }
    const user = await authService.validateSession(auth.substring(7));
    if (!user) { json(res, 401, { error: 'Unauthorized' }); return true; }

    // Force-refresh param: ?force=1
    const force = url.includes('force=1');
    const now = Date.now();
    if (!force && cachedCheck && (now - cacheTime) < CACHE_TTL) {
      json(res, 200, cachedCheck);
      return true;
    }

    const result = await doUpdateCheck();
    cachedCheck = result;
    cacheTime = now;
    json(res, 200, result);
    return true;
  }

  // ── POST /api/update/run ─────────────────────────────────────────────────────
  if (urlPath === '/api/update/run' && req.method === 'POST') {
    if (!(await requireAdmin(req, res))) return true;

    if (runningJob) {
      json(res, 409, { error: 'An update is already running' });
      return true;
    }

    const cwd = process.cwd();
    const startedAt = new Date().toISOString();
    const log: string[] = [];
    lastCompletedJob = null;

    const push = (d: string) => {
      const lines = d.split('\n').filter(l => l.trim());
      log.push(...lines);
    };

    runningJob = { startedAt, step: 'Starting update...', log };

    const runStep = (cmd: string, stepLabel: string) =>
      new Promise<void>((resolve, reject) => {
        if (runningJob) runningJob.step = stepLabel;
        log.push(`\n── ${stepLabel} ──`);
        const child = exec(cmd, { cwd, env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' } });
        child.stdout?.on('data', push);
        child.stderr?.on('data', push);
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`${stepLabel} exited with code ${code}`));
        });
      });

    // Run all steps in background
    (async () => {
      try {
        await runStep('git pull origin main', 'Pulling latest code');
        await runStep('npm install', 'Installing dependencies');
        await runStep('npm run build', 'Building frontend');
        await runStep('npm run build:server', 'Compiling server');
        await runStep('pm2 restart arcellite', 'Restarting Arcellite');
        log.push('\n[  OK  ] Arcellite updated and restarted successfully!');
        // Bust the version cache so next check shows the new version
        cachedCheck = null;
        cacheTime = 0;
        lastCompletedJob = {
          startedAt,
          finishedAt: new Date().toISOString(),
          step: 'Update complete!',
          lines: [...log],
          success: true,
        };
      } catch (err) {
        log.push(`\n[ERROR] ${(err as Error).message}`);
        lastCompletedJob = {
          startedAt,
          finishedAt: new Date().toISOString(),
          step: 'Update failed',
          lines: [...log],
          success: false,
        };
      } finally {
        runningJob = null;
        // Keep log available for 15 minutes after completion
        setTimeout(() => { lastCompletedJob = null; }, 15 * 60 * 1000);
      }
    })();

    json(res, 202, { message: 'Update started', startedAt });
    return true;
  }

  // ── GET /api/update/log ──────────────────────────────────────────────────────
  if (urlPath === '/api/update/log' && req.method === 'GET') {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) { json(res, 401, { error: 'Unauthorized' }); return true; }
    const user = await authService.validateSession(auth.substring(7));
    if (!user) { json(res, 401, { error: 'Unauthorized' }); return true; }

    if (runningJob) {
      json(res, 200, {
        running: true,
        step: runningJob.step,
        startedAt: runningJob.startedAt,
        finishedAt: null,
        lines: runningJob.log,
        success: null,
      });
    } else if (lastCompletedJob) {
      json(res, 200, {
        running: false,
        step: lastCompletedJob.step,
        startedAt: lastCompletedJob.startedAt,
        finishedAt: lastCompletedJob.finishedAt,
        lines: lastCompletedJob.lines,
        success: lastCompletedJob.success,
      });
    } else {
      json(res, 200, { running: false, step: null, startedAt: null, finishedAt: null, lines: [], success: null });
    }
    return true;
  }

  return false;
}
