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
import { exec, execSync } from 'child_process';
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

// ── Shared job runner ─────────────────────────────────────────────────────────

interface JobStep { cmd: string; label: string; }

const UPDATE_STEPS: JobStep[] = [
  { cmd: 'git pull origin main', label: 'Pulling latest code' },
  { cmd: 'npm install',          label: 'Installing dependencies' },
  { cmd: 'npm run build',        label: 'Building frontend' },
  { cmd: 'npm run build:server', label: 'Compiling server' },
  { cmd: 'pm2 restart arcellite',label: 'Restarting Arcellite' },
];

/** Start an async job (update or rollback). Returns startedAt or null if already running. */
function startJob(
  steps: JobStep[],
  jobLabel: string,
  opts: { clearVersionCache?: boolean } = {}
): string | null {
  if (runningJob) return null;
  const cwd = process.cwd();
  const startedAt = new Date().toISOString();
  const log: string[] = [];
  lastCompletedJob = null;

  const push = (d: string) => { log.push(...d.split('\n').filter(l => l.trim())); };
  runningJob = { startedAt, step: `Starting ${jobLabel.toLowerCase()}…`, log };

  const runStep = (cmd: string, stepLabel: string) =>
    new Promise<void>((resolve, reject) => {
      if (runningJob) runningJob.step = stepLabel;
      log.push(`\n── ${stepLabel} ──`);
      const child = exec(cmd, { cwd, env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' } });
      child.stdout?.on('data', push);
      child.stderr?.on('data', push);
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`${stepLabel} exited with code ${code}`)));
    });

  (async () => {
    try {
      for (const step of steps) await runStep(step.cmd, step.label);
      log.push(`\n[  OK  ] ${jobLabel} completed successfully!`);
      if (opts.clearVersionCache) { cachedCheck = null; cacheTime = 0; }
      lastCompletedJob = { startedAt, finishedAt: new Date().toISOString(), step: `${jobLabel} complete!`, lines: [...log], success: true };
    } catch (err) {
      log.push(`\n[ERROR] ${(err as Error).message}`);
      lastCompletedJob = { startedAt, finishedAt: new Date().toISOString(), step: `${jobLabel} failed`, lines: [...log], success: false };
    } finally {
      runningJob = null;
      setTimeout(() => { lastCompletedJob = null; }, 15 * 60 * 1000);
    }
  })();

  return startedAt;
}

// ── Parse JSON body ───────────────────────────────────────────────────────────

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise(resolve => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

// ── Git commit info ───────────────────────────────────────────────────────────

interface CommitInfo {
  hash: string;
  shortHash: string;
  subject: string;
  type: string;
  typeLabel: string;
  date: string;
}

function detectCommitType(subject: string): { type: string; typeLabel: string } {
  const s = subject.toLowerCase();
  if (/^feat(\(.+\))?[!:]/.test(s)) return { type: 'feature', typeLabel: 'Feature' };
  if (/^fix(\(.+\))?[!:]/.test(s))  return { type: 'bugfix',  typeLabel: 'Bug Fix' };
  if (/^perf(\(.+\))?[!:]/.test(s)) return { type: 'perf',    typeLabel: 'Performance' };
  if (/^refactor(\(.+\))?[!:]/.test(s)) return { type: 'improvement', typeLabel: 'Improvement' };
  if (/^docs?(\(.+\))?[!:]/.test(s)) return { type: 'docs',  typeLabel: 'Docs' };
  if (/^(chore|ci|build|test|style)(\(.+\))?[!:]/.test(s)) return { type: 'maintenance', typeLabel: 'Maintenance' };
  if (/^(add|new|implement)/i.test(s)) return { type: 'feature', typeLabel: 'New' };
  if (/^(fix|resolve|patch|correct)/i.test(s)) return { type: 'bugfix', typeLabel: 'Bug Fix' };
  return { type: 'update', typeLabel: 'Update' };
}

function getGitHistory(n = 15): CommitInfo[] {
  try {
    const cwd = process.cwd();
    const raw = execSync(`git log --pretty=format:"%H|%s|%ci" -${n}`, { cwd, timeout: 8000 }).toString();
    return raw.split('\n').filter(Boolean).map(line => {
      const firstPipe  = line.indexOf('|');
      const secondPipe = line.indexOf('|', firstPipe + 1);
      const hash    = line.slice(0, firstPipe);
      const subject = line.slice(firstPipe + 1, secondPipe);
      const date    = line.slice(secondPipe + 1);
      const { type, typeLabel } = detectCommitType(subject);
      return {
        hash:      hash.trim(),
        shortHash: hash.trim().slice(0, 7),
        subject:   subject.trim(),
        type,
        typeLabel,
        date: date ? new Date(date).toLocaleDateString() : '',
      };
    });
  } catch { return []; }
}

// ── Auto-update schedule ──────────────────────────────────────────────────────

interface UpdateScheduleConfig { enabled: boolean; time: string; }

let scheduleConfig: UpdateScheduleConfig = { enabled: false, time: '02:00' };
let lastAutoRunDate: string | null = null;
let scheduleIntervalId: ReturnType<typeof setInterval> | null = null;

const SCHEDULE_FILE = (() => {
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/root';
    const dir = path.join(homeDir, '.arcellite');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'update-schedule.json');
  } catch { return ''; }
})();

function loadScheduleConfig(): void {
  try {
    if (SCHEDULE_FILE && fs.existsSync(SCHEDULE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
      scheduleConfig = { enabled: !!raw.enabled, time: String(raw.time || '02:00') };
    }
  } catch { /* use defaults */ }
}

function saveScheduleConfig(): void {
  try {
    if (SCHEDULE_FILE) fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(scheduleConfig, null, 2), 'utf8');
  } catch { /* silent */ }
}

function startScheduleTimer(): void {
  if (scheduleIntervalId) clearInterval(scheduleIntervalId);
  scheduleIntervalId = setInterval(async () => {
    if (!scheduleConfig.enabled) return;
    const [hh, mm] = scheduleConfig.time.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return;
    const now = new Date();
    if (now.getHours() !== hh || now.getMinutes() !== mm) return;
    const today = now.toISOString().slice(0, 10);
    if (lastAutoRunDate === today) return; // already triggered today
    lastAutoRunDate = today;
    try {
      const result = await doUpdateCheck();
      if (result.updateAvailable && !runningJob) {
        startJob(UPDATE_STEPS, 'Auto-update', { clearVersionCache: true });
      }
    } catch { /* silent */ }
  }, 60_000);
}

// Initialize schedule on module load
loadScheduleConfig();
startScheduleTimer();

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
    if (runningJob) { json(res, 409, { error: 'An update is already running' }); return true; }
    const startedAt = startJob(UPDATE_STEPS, 'Update', { clearVersionCache: true });
    if (!startedAt) { json(res, 409, { error: 'An update is already running' }); return true; }
    json(res, 202, { message: 'Update started', startedAt });
    return true;
  }

  // ── GET /api/update/schedule ──────────────────────────────────────────────
  if (urlPath === '/api/update/schedule' && req.method === 'GET') {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) { json(res, 401, { error: 'Unauthorized' }); return true; }
    const user = await authService.validateSession(auth.substring(7));
    if (!user) { json(res, 401, { error: 'Unauthorized' }); return true; }
    let nextRun: string | null = null;
    if (scheduleConfig.enabled) {
      const [hh, mm] = scheduleConfig.time.split(':').map(Number);
      const candidate = new Date();
      candidate.setHours(hh, mm, 0, 0);
      if (candidate <= new Date()) candidate.setDate(candidate.getDate() + 1);
      nextRun = candidate.toISOString();
    }
    json(res, 200, { ...scheduleConfig, nextRun });
    return true;
  }

  // ── POST /api/update/schedule ─────────────────────────────────────────────
  if (urlPath === '/api/update/schedule' && req.method === 'POST') {
    if (!(await requireAdmin(req, res))) return true;
    const body = await parseBody(req);
    const { enabled, time } = body;
    if (typeof enabled !== 'boolean') { json(res, 400, { error: 'enabled must be boolean' }); return true; }
    const timeStr = String(time || '');
    if (!/^\d{2}:\d{2}$/.test(timeStr)) { json(res, 400, { error: 'time must be HH:MM' }); return true; }
    const [hh, mm] = timeStr.split(':').map(Number);
    if (hh > 23 || mm > 59) { json(res, 400, { error: 'Invalid time' }); return true; }
    scheduleConfig = { enabled, time: timeStr };
    saveScheduleConfig();
    startScheduleTimer();
    json(res, 200, { ...scheduleConfig, message: 'Schedule saved' });
    return true;
  }

  // ── GET /api/update/changelog ─────────────────────────────────────────────
  if (urlPath.startsWith('/api/update/changelog') && req.method === 'GET') {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) { json(res, 401, { error: 'Unauthorized' }); return true; }
    const user = await authService.validateSession(auth.substring(7));
    if (!user) { json(res, 401, { error: 'Unauthorized' }); return true; }
    const nParam = new URL(`http://x${url}`).searchParams.get('n');
    const n = Math.min(50, Math.max(5, parseInt(nParam || '20', 10) || 20));
    json(res, 200, { commits: getGitHistory(n) });
    return true;
  }

  // ── POST /api/update/rollback ─────────────────────────────────────────────
  if (urlPath === '/api/update/rollback' && req.method === 'POST') {
    if (!(await requireAdmin(req, res))) return true;
    if (runningJob) { json(res, 409, { error: 'An update or rollback is already running' }); return true; }
    const body = await parseBody(req);
    const hash = String(body.hash || '');
    if (!hash || !/^[0-9a-f]{4,40}$/i.test(hash)) {
      json(res, 400, { error: 'Invalid commit hash' });
      return true;
    }
    const rollbackSteps: JobStep[] = [
      { cmd: `git reset --hard ${hash}`, label: 'Rolling back code' },
      { cmd: 'npm install',              label: 'Installing dependencies' },
      { cmd: 'npm run build',            label: 'Building frontend' },
      { cmd: 'npm run build:server',     label: 'Compiling server' },
      { cmd: 'pm2 restart arcellite',    label: 'Restarting Arcellite' },
    ];
    const startedAt = startJob(rollbackSteps, 'Rollback', { clearVersionCache: true });
    if (!startedAt) { json(res, 409, { error: 'Already running' }); return true; }
    json(res, 202, { message: 'Rollback started', startedAt, hash });
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
