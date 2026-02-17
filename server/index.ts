/**
 * Arcellite system API + files API + optional static app serving.
 * GET /api/system/storage → root filesystem + removable devices.
 * GET /api/files/list, POST /api/files/mkdir → folders on server.
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getRootStorage, getRemovableDevices, getFirstPartition } from './storage.js';
import { ensureBaseExists, listDir, listExternal, mkdir, getBaseDir } from './files.js';
import { getPublicIp } from './stats.js';
// Note: use .js extension so compiled output (dist/storage.js, dist/files.js) is resolved

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORTS = [Number(process.env.PORT) || 3999, 3998, 3997];

function sendJson(res: http.ServerResponse, status: number, data: object): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function handleStorage(_req: http.IncomingMessage, res: http.ServerResponse): void {
  const root = getRootStorage();
  const removable = getRemovableDevices();
  sendJson(res, 200, { rootStorage: root, removable });
}

function handleFilesList(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
  const category = (url.searchParams.get('category') || 'general') as string;
  const relativePath = url.searchParams.get('path') || '';
  const allowed = ['general', 'media', 'video_vault'];
  if (!allowed.includes(category)) {
    sendJson(res, 400, { error: 'Invalid category' });
    return;
  }
  try {
    const entries = listDir(category, relativePath);
    sendJson(res, 200, { folders: entries.filter((e) => e.isFolder), files: entries.filter((e) => !e.isFolder) });
  } catch (e) {
    sendJson(res, 500, { error: (e as Error).message });
  }
}

async function handleFilesMkdir(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const body = await parseBody(req);
  const category = (body.category as string) || 'general';
  const relativePath = (body.path as string) || (body.name as string);
  const allowed = ['general', 'media', 'video_vault'];
  if (!allowed.includes(category) || typeof relativePath !== 'string' || !relativePath.trim()) {
    sendJson(res, 400, { error: 'Missing category or path' });
    return;
  }
  try {
    mkdir(category, relativePath.trim());
    sendJson(res, 200, { ok: true });
  } catch (e) {
    sendJson(res, 500, { error: (e as Error).message });
  }
}

function handleFilesListExternal(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
  const rawPath = url.searchParams.get('path') || '';
  if (!rawPath.trim()) {
    sendJson(res, 400, { error: 'Missing path' });
    return;
  }
  try {
    const decoded = decodeURIComponent(rawPath.trim());
    const entries = listExternal(decoded);
    sendJson(res, 200, {
      folders: entries.filter((e) => e.isFolder),
      files: entries.filter((e) => !e.isFolder),
    });
  } catch (e) {
    sendJson(res, 500, { error: (e as Error).message });
  }
}

async function handleMount(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const body = await parseBody(req);
  const device = (body.device as string)?.trim();
  if (!device || !/^[a-z0-9]+$/.test(device)) {
    sendJson(res, 400, { error: 'Missing or invalid device name (e.g. sda)' });
    return;
  }
  const partition = getFirstPartition(device);
  if (!partition) {
    sendJson(res, 400, { error: 'No partition found to mount' });
    return;
  }
  try {
    const out = execSync(`udisksctl mount -b /dev/${partition}`, { encoding: 'utf8', timeout: 10000 });
    const match = out.match(/at\s+(.+?)(?:\s|$)/);
    const mountpoint = match ? match[1].trim() : undefined;
    sendJson(res, 200, { ok: true, mountpoint });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    sendJson(res, 500, { error: msg.includes('Not authorized') ? 'Mount not authorized' : msg });
  }
}

async function handleUnmount(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const body = await parseBody(req);
  const device = (body.device as string)?.trim();
  if (!device || !/^[a-z0-9]+$/.test(device)) {
    sendJson(res, 400, { error: 'Missing or invalid device name (e.g. sda)' });
    return;
  }
  const partition = getFirstPartition(device);
  if (!partition) {
    sendJson(res, 400, { error: 'No partition found to unmount' });
    return;
  }
  try {
    execSync(`udisksctl unmount -b /dev/${partition}`, { encoding: 'utf8', timeout: 10000 });
    sendJson(res, 200, { ok: true });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    sendJson(res, 500, { error: msg.includes('Not authorized') ? 'Unmount not authorized' : msg });
  }
}

async function handleFormat(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const body = await parseBody(req);
  const device = (body.device as string)?.trim();
  const fsType = (body.filesystem as string)?.trim() || 'exfat';
  const label = (body.label as string)?.trim() || '';
  const sudoPassword = (body.password as string) || '';

  if (!device || !/^[a-z0-9]+$/.test(device)) {
    sendJson(res, 400, { error: 'Missing or invalid device name' });
    return;
  }

  const allowedFs = ['vfat', 'ext4', 'exfat', 'ntfs'];
  if (!allowedFs.includes(fsType)) {
    sendJson(res, 400, { error: `Unsupported filesystem: ${fsType}. Allowed: ${allowedFs.join(', ')}` });
    return;
  }

  const runSudo = (args: string[], timeout = 120000): { status: number | null; stderr: string; stdout: string } => {
    const noPassResult = spawnSync('sudo', ['-n', ...args], {
      encoding: 'utf8',
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (noPassResult.status === 0) return noPassResult;
    if (sudoPassword) {
      return spawnSync('sudo', ['-S', ...args], {
        input: sudoPassword + '\n',
        encoding: 'utf8',
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      });
    }
    return noPassResult;
  };

  const partition = getFirstPartition(device);
  if (!partition) {
    sendJson(res, 400, { error: 'No partition found to format' });
    return;
  }

  try {
    // Check if mounted
    let mountpoint = '';
    try {
      const lsblkOut = execSync(`lsblk -J -o NAME,MOUNTPOINT /dev/${partition}`, { encoding: 'utf8', timeout: 5000 });
      const lsblkData = JSON.parse(lsblkOut) as { blockdevices?: Array<{ mountpoint?: string }> };
      mountpoint = lsblkData.blockdevices?.[0]?.mountpoint || '';
    } catch {}

    if (mountpoint) {
      // Kill processes using the device first
      try { runSudo(['fuser', '-mk', mountpoint]); } catch {}
      await new Promise(r => setTimeout(r, 500));
      // Unmount
      let umountResult = runSudo(['umount', mountpoint]);
      if (umountResult.status !== 0) {
        umountResult = runSudo(['umount', '-l', mountpoint]);
      }
      if (umountResult.status !== 0) {
        const errMsg = (umountResult.stderr || '').trim();
        if (errMsg.includes('a password is required') || errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
          sendJson(res, 401, { error: 'Password required', requiresAuth: true });
          return;
        }
        throw new Error(errMsg || 'Failed to unmount before format');
      }
      await new Promise(r => setTimeout(r, 500));
      try { runSudo(['rmdir', mountpoint]); } catch {}
    }

    // Wipe existing filesystem signatures
    runSudo(['wipefs', '-a', `/dev/${partition}`]);

    // Format the partition
    const mkfsArgs: string[] = [];
    if (fsType === 'vfat') {
      mkfsArgs.push('mkfs.vfat', '-F', '32');
      if (label) mkfsArgs.push('-n', label.substring(0, 11).toUpperCase());
      mkfsArgs.push(`/dev/${partition}`);
    } else if (fsType === 'ext4') {
      mkfsArgs.push('mkfs.ext4', '-F');
      if (label) mkfsArgs.push('-L', label.substring(0, 16));
      mkfsArgs.push(`/dev/${partition}`);
    } else if (fsType === 'exfat') {
      mkfsArgs.push('mkfs.exfat');
      if (label) mkfsArgs.push('-L', label.substring(0, 15));
      mkfsArgs.push(`/dev/${partition}`);
    } else if (fsType === 'ntfs') {
      mkfsArgs.push('mkfs.ntfs', '-f');
      if (label) mkfsArgs.push('-L', label.substring(0, 32));
      mkfsArgs.push(`/dev/${partition}`);
    }

    const formatResult = runSudo(mkfsArgs, 300000);

    if (formatResult.status !== 0) {
      const errMsg = (formatResult.stderr || formatResult.stdout || '').trim();
      if (errMsg.includes('a password is required') || errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
        sendJson(res, 401, { error: 'Password required', requiresAuth: true });
        return;
      }
      throw new Error(errMsg || 'Format failed');
    }

    sendJson(res, 200, { ok: true, message: `Formatted /dev/${partition} as ${fsType}` });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    sendJson(res, 500, { error: msg });
  }
}

const DIST = path.join(__dirname, '..', '..', 'dist');
const HAS_DIST = fs.existsSync(DIST);

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, url: string): void {
  let p = url === '/' ? '/index.html' : url;
  const full = path.join(DIST, p);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }
  const ext = path.extname(p);
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
  };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const rawUrl = req.url ?? '';
  const [pathname, search] = rawUrl.split('?');
  const url = new URL(rawUrl, `http://localhost`);

  if (pathname === '/api/system/storage' || pathname === '/api/system/storage/') {
    handleStorage(req, res);
    return;
  }
  if (pathname === '/api/files/list') {
    handleFilesList(req, res, url);
    return;
  }
  if (pathname === '/api/files/mkdir') {
    await handleFilesMkdir(req, res);
    return;
  }
  if (pathname === '/api/files/list-external') {
    handleFilesListExternal(req, res, url);
    return;
  }
  if (pathname === '/api/system/public-ip') {
    try {
      const ip = await getPublicIp();
      sendJson(res, 200, { ip });
    } catch (e) {
      sendJson(res, 500, { error: String((e as Error).message) });
    }
    return;
  }
  if (pathname === '/api/system/mount') {
    await handleMount(req, res);
    return;
  }
  if (pathname === '/api/system/unmount') {
    await handleUnmount(req, res);
    return;
  }
  if (pathname === '/api/system/format') {
    await handleFormat(req, res);
    return;
  }
  if (HAS_DIST) {
    serveStatic(req, res, pathname);
    return;
  }
  res.writeHead(404);
  res.end();
});

function start(portIndex: number): void {
  const port = PORTS[portIndex];
  if (port == null) {
    console.error('Ports 3999, 3998, 3997 are in use. Free one or set PORT=4000 npm run server');
    process.exit(1);
  }
  ensureBaseExists();
  server.listen(port, '0.0.0.0', () => {
    console.log(`Arcellite server listening on http://0.0.0.0:${port}`);
    console.log(`  Data directory: ${getBaseDir()}`);
    console.log('  GET  /api/system/storage  → root + removable devices');
    console.log('  GET  /api/files/list      → list folders/files');
    console.log('  POST /api/files/mkdir     → create folder');
    console.log('  POST /api/system/mount    → mount USB/removable device');
    console.log('  POST /api/system/unmount  → unmount device');
    if (HAS_DIST) console.log('  Serving built app from ./dist');
  });
}

server.on('error', (err: NodeJS.ErrnoException & { port?: number }) => {
  const port = err.port ?? 0;
  if (err.code === 'EADDRINUSE' && port && PORTS.indexOf(port) < PORTS.length - 1) {
    console.warn(`Port ${port} in use, trying ${PORTS[PORTS.indexOf(port) + 1]}...`);
    start(PORTS.indexOf(port) + 1);
  } else if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} in use. Free it or set PORT=4000 npm run server`);
    process.exit(1);
  } else {
    throw err;
  }
});

start(0);
