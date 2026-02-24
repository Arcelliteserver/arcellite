/**
 * Health Check Route
 * GET /api/health — returns system health for monitoring tools and the health-monitor.sh script
 * This endpoint is intentionally unauthenticated so external monitors can use it.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import os from 'os';
import fs from 'fs';
import { checkDatabaseHealth } from '../db/connection.js';

const START_TIME = Date.now();

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

function getDiskUsage(path: string): { used: number; total: number; pct: number } | null {
  try {
    // Use statfs via /proc/mounts approximation — works on Linux
    const stat = fs.statfsSync(path);
    const total = stat.blocks * stat.bsize;
    const free = stat.bfree * stat.bsize;
    const used = total - free;
    return { used, total, pct: Math.round((used / total) * 100) };
  } catch {
    return null;
  }
}

export async function handleHealthRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> {
  const path = url.split('?')[0];

  if (path !== '/api/health') return false;
  if (req.method !== 'GET') return false;

  const dbOk = await checkDatabaseHealth();
  const uptime = Date.now() - START_TIME;
  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const memUsed = memTotal - memFree;
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const nodeUptime = process.uptime();

  // Disk usage for root filesystem
  const rootDisk = getDiskUsage('/');

  // Determine data dir disk usage
  const dataDir = process.env.ARCELLITE_DATA
    ? process.env.ARCELLITE_DATA.replace(/^~/, os.homedir())
    : `${os.homedir()}/arcellite-data`;
  const dataDisk = getDiskUsage(dataDir);

  // Determine overall status
  const diskCritical = (rootDisk && rootDisk.pct >= 90) || (dataDisk && dataDisk.pct >= 90);
  const diskWarning = (rootDisk && rootDisk.pct >= 80) || (dataDisk && dataDisk.pct >= 80);

  let status: 'ok' | 'degraded' | 'critical' = 'ok';
  if (!dbOk || diskCritical) status = 'critical';
  else if (diskWarning) status = 'degraded';

  const httpStatus = status === 'ok' ? 200 : status === 'degraded' ? 200 : 503;

  const payload = {
    status,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: {
      process: formatUptime(uptime),
      node: `${Math.floor(nodeUptime)}s`,
    },
    database: {
      status: dbOk ? 'ok' : 'error',
    },
    memory: {
      used: `${Math.round(memUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memTotal / 1024 / 1024)}MB`,
      pct: Math.round((memUsed / memTotal) * 100),
    },
    cpu: {
      cores: cpuCount,
      load1m: loadAvg[0].toFixed(2),
      load5m: loadAvg[1].toFixed(2),
    },
    disk: {
      root: rootDisk ? { used: `${Math.round(rootDisk.used / 1024 / 1024 / 1024)}GB`, total: `${Math.round(rootDisk.total / 1024 / 1024 / 1024)}GB`, pct: rootDisk.pct } : null,
      data: dataDisk ? { used: `${Math.round(dataDisk.used / 1024 / 1024 / 1024)}GB`, total: `${Math.round(dataDisk.total / 1024 / 1024 / 1024)}GB`, pct: dataDisk.pct } : null,
    },
    alerts: [
      ...(!dbOk ? ['Database connection failed'] : []),
      ...(diskCritical ? ['Disk usage critical (≥90%)'] : diskWarning ? ['Disk usage high (≥80%)'] : []),
    ],
  };

  res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload, null, 2));
  return true;
}
