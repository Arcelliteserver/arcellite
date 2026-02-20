import type { IncomingMessage, ServerResponse } from 'http';
import os from 'os';
import nodePath from 'path';
import fs from 'fs';
import * as authService from '../services/auth.service.js';
import { pool } from '../db/connection.js';

/** Resolve the storage base directory for the current request's user.
 *  Falls back to the global path for unauthenticated or owner requests. */
async function resolveUserBaseDir(req: IncomingMessage): Promise<string> {
  let storagePath = (req as any).user?.storagePath as string | undefined;
  if (!storagePath || storagePath === 'pending') {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const user = await authService.validateSession(authHeader.substring(7));
        if (user?.storagePath) {
          (req as any).user = user;
          storagePath = user.storagePath;
        }
      }
    } catch { /* fall through */ }
  }
  if (storagePath && storagePath !== 'pending') {
    if (storagePath.startsWith('~/') || storagePath === '~') {
      return nodePath.join(os.homedir(), storagePath.slice(storagePath === '~' ? 1 : 2));
    }
    return storagePath;
  }
  // Global fallback
  const { getBaseDir } = await import('../files.js');
  return getBaseDir();
}

/** Calculate total bytes used in a directory tree (recursive) */
function calcDirSize(dir: string): number {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += calcDirSize(full);
      } else if (entry.isFile()) {
        try { total += fs.statSync(full).size; } catch {}
      }
    }
  } catch {}
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function handleSystemRoutes(req: IncomingMessage, res: ServerResponse, url: string): boolean {
  const path = url.split('?')[0];

  // ── File search across all categories ──
  if (path === '/api/files/search' && req.method === 'GET') {
    try {
      Promise.all([resolveUserBaseDir(req), import('fs'), import('path')]).then(([base, fsNode, pathNode]) => {
        try {
          const searchParams = new URL(url, 'http://localhost').searchParams;
          const q = (searchParams.get('q') || '').toLowerCase().trim();
          if (!q) { res.setHeader('Content-Type', 'application/json'); res.end('[]'); return; }
          const CATEGORY_MAP: Record<string, string> = { files: 'general', photos: 'media', videos: 'video_vault', music: 'music' };
          const results: any[] = [];
          const searchRecursive = (dir: string, catFolder: string, relPath: string) => {
            if (!fsNode.existsSync(dir)) return;
            for (const entry of fsNode.readdirSync(dir, { withFileTypes: true })) {
              const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
              if (entry.name.toLowerCase().includes(q)) {
                const full = pathNode.join(dir, entry.name);
                const stat = fsNode.statSync(full);
                const category = CATEGORY_MAP[catFolder] || 'general';
                results.push({
                  name: entry.name,
                  isFolder: entry.isDirectory(),
                  sizeBytes: entry.isFile() ? stat.size : undefined,
                  mtimeMs: stat.mtimeMs,
                  category,
                  path: entryRelPath,
                });
              }
              if (entry.isDirectory()) {
                searchRecursive(pathNode.join(dir, entry.name), catFolder, entryRelPath);
              }
            }
          };
          for (const catFolder of ['files', 'photos', 'videos', 'music']) {
            searchRecursive(pathNode.join(base, catFolder), catFolder, '');
          }
          // Sort: starts-with first, then folders first, then alphabetical; limit 30
          results.sort((a, b) => {
            const aS = a.name.toLowerCase().startsWith(q) ? 0 : 1;
            const bS = b.name.toLowerCase().startsWith(q) ? 0 : 1;
            if (aS !== bS) return aS - bS;
            if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(results.slice(0, 30)));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Search failed' }));
        }
      }).catch(() => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Search failed' }));
      });
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Search failed' }));
    }
    return true;
  }

  // ── Total file/folder count across all categories ──
  if (path === '/api/files/total-count' && req.method === 'GET') {
    resolveUserBaseDir(req).then((base) => {
      try {
        const categories = ['files', 'photos', 'videos', 'music'];
        let totalFiles = 0;
        let totalFolders = 0;
        const countRecursive = (dir: string) => {
          if (!fs.existsSync(dir)) return;
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              totalFolders++;
              countRecursive(nodePath.join(dir, entry.name));
            } else if (entry.isFile()) {
              totalFiles++;
            }
          }
        };
        for (const cat of categories) {
          countRecursive(nodePath.join(base, cat));
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ totalFiles, totalFolders, total: totalFiles + totalFolders }));
      } catch {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Failed to count files' }));
      }
    }).catch(() => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Failed to count files' }));
    });
    return true;
  }

  // ── SSE: Real-time USB device events ──
  if (path === '/api/system/usb-events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(':\n\n'); // SSE comment to keep connection alive

    let lastDevices: string[] = [];

    // Get initial snapshot
    import('../storage.js').then(({ getRemovableDevices }) => {
      try {
        const initial = getRemovableDevices();
        lastDevices = initial.map(d => d.name).sort();
        res.write(`data: ${JSON.stringify({ type: 'init', devices: initial })}\n\n`);
      } catch {}
    }).catch(() => {});

    // Poll every 3 seconds for changes
    const pollInterval = setInterval(async () => {
      try {
        const { getRemovableDevices } = await import('../storage.js');
        const current = getRemovableDevices();
        const currentNames = current.map(d => d.name).sort();
        const prevNames = lastDevices;

        const added = current.filter(d => !prevNames.includes(d.name));
        const removed = prevNames.filter(n => !currentNames.includes(n));

        if (added.length > 0 || removed.length > 0) {
          lastDevices = currentNames;
          const event = {
            type: 'change',
            added: added.map(d => ({ name: d.name, model: d.model, label: d.label, sizeHuman: d.sizeHuman, deviceType: d.deviceType })),
            removed,
            devices: current,
          };
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch {}
    }, 3000);

    // Keep-alive ping every 30s
    const keepAlive = setInterval(() => {
      try { res.write(':\n\n'); } catch {}
    }, 30000);

    req.on('close', () => {
      clearInterval(pollInterval);
      clearInterval(keepAlive);
    });

    return true;
  }

  // ── Storage: root + removable devices (family-aware) ──
  if (path === '/api/system/storage') {
    (async () => {
      try {
        const [{ getRootStorage, getRemovableDevices }] = await Promise.all([import('../storage.js')]);
        const root = getRootStorage();
        const removable = getRemovableDevices();

        // Ensure req.user is populated (session-validation fallback)
        await resolveUserBaseDir(req);
        const userId = (req as any).user?.id as number | undefined;

        if (userId) {
          // Check if this user is an active family member
          const { rows: fmRows } = await pool.query(
            `SELECT fm.id, fm.storage_quota, fm.owner_id
             FROM family_members fm
             WHERE fm.user_id = $1 AND fm.status = 'active'
             LIMIT 1`,
            [userId],
          );

          if (fmRows.length > 0) {
            // ── Family member: return quota-based storage view ──
            const fm = fmRows[0];
            const quota: number = Number(fm.storage_quota);
            const userDir = (req as any).user?.storagePath as string | undefined;
            const expandedDir = userDir && userDir !== 'pending'
              ? (userDir.startsWith('~/') || userDir === '~'
                ? nodePath.join(os.homedir(), userDir.slice(userDir === '~' ? 1 : 2))
                : userDir)
              : null;
            const used = expandedDir ? calcDirSize(expandedDir) : 0;
            const free = Math.max(0, quota - used);
            const usedPercent = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

            // Persist updated usage (fire-and-forget)
            pool.query('UPDATE family_members SET storage_used = $1 WHERE id = $2', [used, fm.id]).catch(() => {});

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              rootStorage: root,
              removable,
              familyMemberStorage: {
                quota,
                used,
                free,
                usedPercent,
                quotaHuman: formatBytes(quota),
                usedHuman: formatBytes(used),
                freeHuman: formatBytes(free),
              },
            }));
            return;
          }

          // ── Owner: add total family-allocated bytes ──
          const { rows: allocRows } = await pool.query(
            `SELECT COALESCE(SUM(storage_quota), 0) AS total_allocated
             FROM family_members
             WHERE owner_id = $1 AND status = 'active'`,
            [userId],
          );
          const familyAllocated = Number(allocRows[0]?.total_allocated ?? 0);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ rootStorage: root, removable, familyAllocated }));
          return;
        }

        // Unauthenticated / fallback
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ rootStorage: root, removable }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ rootStorage: null, removable: [], error: String((e as Error).message) }));
      }
    })();
    return true;
  }

  // ── System stats: CPU, memory, network, uptime ──
  if (path === '/api/system/stats') {
    import('../stats.js').then(({ getSystemStats }) => {
      try {
        const stats = getSystemStats();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(stats));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    }).catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // ── Public IP lookup ──
  if (path === '/api/system/public-ip') {
    import('../stats.js').then(({ getPublicIp }) => {
      getPublicIp().then((ip) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ip }));
      }).catch((e) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      });
    }).catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // ── System log entries ──
  if (path === '/api/system/logs') {
    const limitParam = parseInt(new URL(url, 'http://localhost').searchParams.get('limit') || '50', 10);
    import('../stats.js').then(({ getDetailedLogs }) => {
      try {
        const logs = getDetailedLogs(limitParam);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ logs }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    }).catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // ── System information ──
  if (path === '/api/system/info') {
    import('../notifications.js').then(({ getSystemInfo }) => {
      try {
        const info = getSystemInfo();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(info));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    }).catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // ── List files on external/removable device ──
  if (path === '/api/files/list-external') {
    const pathParam = new URL(url, 'http://localhost').searchParams.get('path') || '';
    const decodedPath = pathParam;

    console.log(`[list-external] Requested path: "${decodedPath}"`);

    Promise.all([import('fs'), import('path'), import('child_process')]).then(([fs, pathModule, cp]) => {
      try {
        const { execSync } = cp;

        const normalized = pathModule.normalize(decodedPath);
        const resolved = pathModule.resolve(normalized);
        const ALLOWED = ['/media/', '/run/media/', '/mnt/'];
        const allowed = ALLOWED.some((p: string) => resolved.startsWith(p) || resolved === p.replace(/\/$/, ''));
        if (!allowed) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Path not allowed' }));
          return;
        }

        interface DirEntry { name: string; isFolder: boolean; mtimeMs: number; sizeBytes?: number; hasSubfolders?: boolean; }
        let entries: DirEntry[] = [];

        // Try direct read first
        try {
          const names: string[] = fs.readdirSync(resolved);
          console.log(`[list-external] readdirSync returned ${names.length} entries for "${resolved}"`);
          for (const name of names) {
            const full = pathModule.join(resolved, name);
            try {
              const stat = fs.statSync(full);
              const isDir = stat.isDirectory();
              let hasSubfolders: boolean | undefined;
              if (isDir) {
                try {
                  const children = fs.readdirSync(full, { withFileTypes: true });
                  hasSubfolders = children.some((c: any) => c.isDirectory());
                } catch { hasSubfolders = undefined; }
              }
              entries.push({
                name,
                isFolder: isDir,
                mtimeMs: stat.mtimeMs,
                sizeBytes: stat.isFile() ? stat.size : undefined,
                hasSubfolders,
              });
            } catch {
              entries.push({ name, isFolder: false, mtimeMs: Date.now() });
            }
          }
        } catch (directErr: any) {
          console.error(`[list-external] Direct read failed: ${directErr.code} — ${directErr.message}`);
          if (directErr.code === 'ENOENT') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ folders: [], files: [] }));
            return;
          }
        }

        // If empty, try sudo ls fallback
        if (entries.length === 0) {
          console.log(`[list-external] Trying sudo ls fallback for "${resolved}"`);
          try {
            const out = execSync(
              `sudo -n ls -la --time-style=+%s ${JSON.stringify(resolved)}`,
              { encoding: 'utf8', timeout: 10000 }
            );
            const lines = out.trim().split('\n');
            for (const line of lines) {
              if (line.startsWith('total ') || !line.trim()) continue;
              const parts = line.split(/\s+/);
              if (parts.length < 7) continue;
              const perms = parts[0];
              const sizeStr = parts[4];
              const timestamp = parts[5];
              const name = parts.slice(6).join(' ');
              if (name === '.' || name === '..') continue;
              const isFolder = perms.startsWith('d');
              const size = parseInt(sizeStr, 10);
              const mtimeMs = parseInt(timestamp, 10) * 1000;
              entries.push({
                name,
                isFolder,
                mtimeMs: isNaN(mtimeMs) ? Date.now() : mtimeMs,
                sizeBytes: !isFolder && !isNaN(size) ? size : undefined,
              });
            }
            if (entries.length > 0) {
              console.log(`[list-external] sudo fallback found ${entries.length} entries`);
            }
          } catch (sudoErr: any) {
            console.error('[list-external] sudo fallback failed:', sudoErr.message);
          }
        }

        // If STILL empty, try plain ls as last resort
        if (entries.length === 0) {
          console.log(`[list-external] Trying plain ls fallback for "${resolved}"`);
          try {
            const out = execSync(
              `ls -la --time-style=+%s ${JSON.stringify(resolved)}`,
              { encoding: 'utf8', timeout: 10000 }
            );
            const lines = out.trim().split('\n');
            for (const line of lines) {
              if (line.startsWith('total ') || !line.trim()) continue;
              const parts = line.split(/\s+/);
              if (parts.length < 7) continue;
              const perms = parts[0];
              const sizeStr = parts[4];
              const timestamp = parts[5];
              const name = parts.slice(6).join(' ');
              if (name === '.' || name === '..') continue;
              const isFolder = perms.startsWith('d');
              const size = parseInt(sizeStr, 10);
              const mtimeMs = parseInt(timestamp, 10) * 1000;
              entries.push({
                name,
                isFolder,
                mtimeMs: isNaN(mtimeMs) ? Date.now() : mtimeMs,
                sizeBytes: !isFolder && !isNaN(size) ? size : undefined,
              });
            }
            if (entries.length > 0) {
              console.log(`[list-external] plain ls found ${entries.length} entries`);
            }
          } catch (lsErr: any) {
            console.error('[list-external] plain ls failed:', lsErr.message);
          }
        }

        const folders = entries.filter((e: DirEntry) => e.isFolder);
        const files = entries.filter((e: DirEntry) => !e.isFolder);
        console.log(`[list-external] Returning ${folders.length} folders, ${files.length} files`);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ folders, files }));
      } catch (e) {
        console.error('[list-external] Exception:', (e as Error).message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    }).catch((e) => {
      console.error('[list-external] Import error:', (e as Error).message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // ── Serve external files by absolute path (removable mounts) ──
  if (path.startsWith('/api/files/serve-external') && req.method === 'GET') {
    const pathParam = new URL(url, 'http://localhost').searchParams.get('path') || '';

    Promise.all([import('path'), import('fs'), import('child_process')]).then(([pathModule, fsModule, cpModule]) => {
      try {
        const requested = decodeURIComponent(pathParam);

        if (!requested || !requested.startsWith('/') || requested.includes('..')) {
          console.warn(`[serve-external] BLOCKED: Invalid path format`);
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        // SEC-PT-004: Validate path is under allowed mount prefixes (same as list-external)
        const ALLOWED_SERVE = ['/media/', '/run/media/', '/mnt/'];
        const normalizedReq = pathModule.resolve(requested);
        const isAllowed = ALLOWED_SERVE.some((p: string) => normalizedReq.startsWith(p) || normalizedReq === p.replace(/\/$/, ''));
        if (!isAllowed) {
          console.warn(`[serve-external] BLOCKED: Path "${normalizedReq}" not under allowed prefixes`);
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        let fileSize = 0;
        let isDir = false;
        let canReadDirect = false;

        try {
          const stat = fsModule.default.statSync(requested);
          fileSize = stat.size;
          isDir = stat.isDirectory();
          canReadDirect = true;
        } catch (statErr: any) {
          if (statErr.code === 'ENOENT') {
            try {
              // SEC-CI-007: Use spawnSync instead of string interpolation
              const statResult = cpModule.spawnSync('sudo', ['-n', 'stat', '--format=%s %F', requested],
                { encoding: 'utf8', timeout: 5000 });
              if (statResult.error || statResult.status !== 0) throw new Error('stat failed');
              const statOut = statResult.stdout.trim();
              const [sizeStr, typeStr] = statOut.split(' ');
              fileSize = parseInt(sizeStr, 10) || 0;
              isDir = typeStr === 'directory';
            } catch {
              console.warn(`[serve-external] FILE NOT FOUND: ${requested}`);
              res.statusCode = 404;
              res.end('File not found');
              return;
            }
          } else if (statErr.code === 'EACCES' || statErr.code === 'EPERM') {
            try {
              // SEC-CI-007: Use spawnSync instead of string interpolation
              const statResult = cpModule.spawnSync('sudo', ['-n', 'stat', '--format=%s %F', requested],
                { encoding: 'utf8', timeout: 5000 });
              if (statResult.error || statResult.status !== 0) throw new Error('stat failed');
              const statOut = statResult.stdout.trim();
              const [sizeStr, typeStr] = statOut.split(' ');
              fileSize = parseInt(sizeStr, 10) || 0;
              isDir = typeStr === 'directory';
            } catch {
              res.statusCode = 403;
              res.end('Permission denied');
              return;
            }
          } else {
            throw statErr;
          }
        }

        if (isDir) {
          console.warn(`[serve-external] ERROR: Requested path is a directory`);
          res.statusCode = 400;
          res.end('Cannot serve a directory');
          return;
        }

        const ext = pathModule.default.extname(requested).toLowerCase();
        const contentTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.mov': 'video/quicktime',
          '.avi': 'video/x-msvideo',
          '.mkv': 'video/x-matroska',
          '.pdf': 'application/pdf',
          '.txt': 'text/plain',
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.json': 'application/json',
        };

        const contentType = contentTypes[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Range,Accept,Content-Type');
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Cache-Control', 'public, max-age=31536000');

        if (canReadDirect) {
          const readStream = fsModule.default.createReadStream(requested);
          readStream.on('error', (err) => {
            console.error(`[serve-external] Stream error: ${err.message}`);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.end('Error reading file');
            }
          });
          readStream.pipe(res);
        } else {
          // Use sudo cat for root-owned files
          const child = cpModule.spawn('sudo', ['-n', 'cat', requested]);
          child.stdout.pipe(res);
          child.stderr.on('data', (data: Buffer) => {
            console.error(`[serve-external] sudo cat stderr: ${data.toString()}`);
          });
          child.on('error', (err) => {
            console.error(`[serve-external] sudo cat error: ${err.message}`);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.end('Error reading file');
            }
          });
        }
      } catch (e) {
        console.error(`[serve-external] Exception: ${(e as Error).message}`);
        res.statusCode = 500;
        res.end(String((e as Error).message));
      }
    }).catch((e) => {
      res.statusCode = 500;
      res.end(String((e as Error).message));
    });
    return true;
  }

  // ── Mount removable device ──
  if (path === '/api/system/mount' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      Promise.all([import('../storage.js'), import('child_process'), import('path')]).then(async ([{ getFirstPartition }, { spawnSync, execSync }, pathModule]) => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const device = (body.device as string)?.trim();
          const sudoPassword = (body.password as string) || '';

          if (!device || !/^[a-z0-9]+$/.test(device)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing or invalid device name' }));
            return;
          }

          const partition = getFirstPartition(device);
          if (!partition) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'No partition found to mount' }));
            return;
          }

          // Check if already mounted
          try {
            const lsblkOut = execSync(`lsblk -J -o NAME,MOUNTPOINT /dev/${partition}`, { encoding: 'utf8', timeout: 5000 });
            const lsblkData = JSON.parse(lsblkOut) as { blockdevices?: Array<{ mountpoint?: string }> };
            const existingMount = lsblkData.blockdevices?.[0]?.mountpoint;
            if (existingMount) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, mountpoint: existingMount }));
              return;
            }
          } catch {}

          // Helper: run sudo command — tries passwordless (-n) first, falls back to password via stdin
          const runSudo = (args: string[]): { status: number | null; stderr: string; stdout: string } => {
            const noPassResult = spawnSync('sudo', ['-n', ...args], {
              encoding: 'utf8',
              timeout: 60000,
              maxBuffer: 10 * 1024 * 1024,
            });
            if (noPassResult.status === 0) return noPassResult;
            if (sudoPassword) {
              const passResult = spawnSync('sudo', ['-S', ...args], {
                input: sudoPassword + '\n',
                encoding: 'utf8',
                timeout: 60000,
                maxBuffer: 10 * 1024 * 1024,
              });
              return passResult;
            }
            return noPassResult;
          };

          // Get volume label for a nicer mount directory name
          let volumeLabel = '';
          try {
            const labelOut = execSync(`lsblk -n -o LABEL /dev/${partition}`, { encoding: 'utf8', timeout: 3000 }).trim();
            if (labelOut && /^[a-zA-Z0-9_\-. ]+$/.test(labelOut)) {
              volumeLabel = labelOut.replace(/\s+/g, '_');
            }
          } catch {}

          // If no label, try UUID
          if (!volumeLabel) {
            try {
              const uuidOut = execSync(`lsblk -n -o UUID /dev/${partition}`, { encoding: 'utf8', timeout: 3000 }).trim();
              if (uuidOut && /^[a-zA-Z0-9_\-]+$/.test(uuidOut)) {
                volumeLabel = uuidOut;
              }
            } catch {}
          }

          const mountName = volumeLabel || partition;
          const mountDir = `/media/arcellite/${mountName}`;

          runSudo(['chmod', '755', '/media/arcellite']);

          const mkdirResult = runSudo(['mkdir', '-p', mountDir]);
          if (mkdirResult.status !== 0) {
            const errMsg = (mkdirResult.stderr || '').trim();
            if (errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Incorrect password', requiresAuth: true }));
              return;
            }
            if (errMsg.includes('a password is required')) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Password required', requiresAuth: true }));
              return;
            }
            throw new Error(errMsg || 'Failed to create mount directory');
          }

          const mountResult = runSudo(['mount', `-o`, `uid=1000,gid=1000,dmask=022,fmask=133`, `/dev/${partition}`, mountDir]);

          if (mountResult.status !== 0) {
            const errMsg = (mountResult.stderr || mountResult.stdout || '').trim();
            if (errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Incorrect password', requiresAuth: true }));
              return;
            }
            if (errMsg.includes('already mounted')) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, mountpoint: mountDir }));
              return;
            }
            // If uid/gid mount options fail (e.g. ext4), retry without them
            if (errMsg.includes('bad option') || errMsg.includes('unrecognized mount option')) {
              const retryResult = runSudo(['mount', `/dev/${partition}`, mountDir]);
              if (retryResult.status !== 0) {
                throw new Error((retryResult.stderr || '').trim() || 'Mount failed');
              }
              runSudo(['chown', '-R', 'arcellite:arcellite', mountDir]);
            } else {
              throw new Error(errMsg || 'Mount failed');
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, mountpoint: mountDir }));
        } catch (e) {
          const msg = (e as Error).message || String(e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: msg }));
        }
      }).catch((e) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      });
    });
    return true;
  }

  // ── Unmount removable device ──
  if (path === '/api/system/unmount' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      Promise.all([import('../storage.js'), import('child_process')]).then(async ([{ getFirstPartition }, { spawnSync, execSync }]) => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const device = (body.device as string)?.trim();
          const sudoPassword = (body.password as string) || '';

          if (!device || !/^[a-z0-9]+$/.test(device)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing or invalid device name' }));
            return;
          }

          const runSudo = (args: string[]): { status: number | null; stderr: string; stdout: string } => {
            const noPassResult = spawnSync('sudo', ['-n', ...args], {
              encoding: 'utf8',
              timeout: 60000,
              maxBuffer: 10 * 1024 * 1024,
            });
            if (noPassResult.status === 0) return noPassResult;
            if (sudoPassword) {
              return spawnSync('sudo', ['-S', ...args], {
                input: sudoPassword + '\n',
                encoding: 'utf8',
                timeout: 60000,
                maxBuffer: 10 * 1024 * 1024,
              });
            }
            return noPassResult;
          };

          const partition = getFirstPartition(device);
          if (!partition) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'No partition found to unmount' }));
            return;
          }

          let mountpoint = '';
          try {
            const lsblkOut = execSync(`lsblk -J -o NAME,MOUNTPOINT /dev/${partition}`, { encoding: 'utf8', timeout: 5000 });
            const lsblkData = JSON.parse(lsblkOut) as { blockdevices?: Array<{ mountpoint?: string }> };
            mountpoint = lsblkData.blockdevices?.[0]?.mountpoint || '';
          } catch {}

          if (!mountpoint) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          try { runSudo(['fuser', '-mk', mountpoint]); } catch {}
          await new Promise(r => setTimeout(r, 500));
          let umountResult = runSudo(['umount', mountpoint]);
          if (umountResult.status !== 0) {
            umountResult = runSudo(['umount', '-l', mountpoint]);
          }

          if (umountResult.status !== 0) {
            const errMsg = (umountResult.stderr || umountResult.stdout || '').trim();
            if (errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Incorrect password', requiresAuth: true }));
              return;
            }
            if (errMsg.includes('a password is required')) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Password required', requiresAuth: true }));
              return;
            }
            if (errMsg.includes('not mounted') || errMsg.includes('not found')) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
              return;
            }
            throw new Error(errMsg || 'Unmount failed');
          }

          try { runSudo(['rmdir', mountpoint]); } catch {}

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          const msg = (e as Error).message || String(e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: msg }));
        }
      }).catch((e) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      });
    });
    return true;
  }

  // ── Format removable device ──
  if (path === '/api/system/format' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      Promise.all([import('../storage.js'), import('child_process')]).then(async ([{ getFirstPartition }, { spawnSync, execSync }]) => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const device = (body.device as string)?.trim();
          const fsType = (body.filesystem as string)?.trim() || 'exfat';
          const label = (body.label as string)?.trim() || '';
          const sudoPassword = (body.password as string) || '';

          if (!device || !/^[a-z0-9]+$/.test(device)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing or invalid device name' }));
            return;
          }

          const allowedFs = ['vfat', 'ext4', 'exfat', 'ntfs'];
          if (!allowedFs.includes(fsType)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Unsupported filesystem: ${fsType}. Allowed: ${allowedFs.join(', ')}` }));
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
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'No partition found to format' }));
            return;
          }

          let mountpoint = '';
          try {
            const lsblkOut = execSync(`lsblk -J -o NAME,MOUNTPOINT /dev/${partition}`, { encoding: 'utf8', timeout: 5000 });
            const lsblkData = JSON.parse(lsblkOut) as { blockdevices?: Array<{ mountpoint?: string }> };
            mountpoint = lsblkData.blockdevices?.[0]?.mountpoint || '';
          } catch {}

          if (mountpoint) {
            try { runSudo(['fuser', '-mk', mountpoint]); } catch {}
            await new Promise(r => setTimeout(r, 500));
            let umountResult = runSudo(['umount', mountpoint]);
            if (umountResult.status !== 0) {
              umountResult = runSudo(['umount', '-l', mountpoint]);
            }
            if (umountResult.status !== 0) {
              const errMsg = (umountResult.stderr || '').trim();
              if (errMsg.includes('a password is required') || errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Password required', requiresAuth: true }));
                return;
              }
              throw new Error(errMsg || 'Failed to unmount before format');
            }
            await new Promise(r => setTimeout(r, 500));
            try { runSudo(['rmdir', mountpoint]); } catch {}
          }

          runSudo(['wipefs', '-a', `/dev/${partition}`]);

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
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Password required', requiresAuth: true }));
              return;
            }
            throw new Error(errMsg || 'Format failed');
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, message: `Formatted /dev/${partition} as ${fsType}` }));
        } catch (e) {
          const msg = (e as Error).message || String(e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: msg }));
        }
      }).catch((e) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      });
    });
    return true;
  }

  // ── System restart (requires auth + password verification) ──
  if (path === '/api/system/restart' && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return true;
    }
    const sessionToken = authHeader.substring(7);
    let bodyStr = '';
    req.on('data', (chunk) => { bodyStr += chunk; });
    req.on('end', () => {
      Promise.all([
        import('../services/auth.service.js'),
        import('../db/connection.js'),
        import('bcrypt'),
        import('child_process'),
      ]).then(async ([authMod, { pool }, bcrypt, { exec }]) => {
        const user = await authMod.validateSession(sessionToken);
        if (!user) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid session' }));
          return;
        }
        let password = '';
        try { password = JSON.parse(bodyStr).password || ''; } catch { /* */ }
        const dbResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
        const storedHash = dbResult.rows[0]?.password_hash;
        if (!storedHash || !(await bcrypt.compare(password, storedHash))) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Incorrect password' }));
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, message: 'Restart initiated' }));
        setTimeout(() => {
          exec('sudo reboot', (error) => {
            if (error) console.error('Reboot error:', error);
          });
        }, 500);
      }).catch((e) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      });
    });
    return true;
  }

  // ── System shutdown (requires auth + password verification) ──
  if (path === '/api/system/shutdown' && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return true;
    }
    const sessionToken = authHeader.substring(7);
    let bodyStr = '';
    req.on('data', (chunk) => { bodyStr += chunk; });
    req.on('end', () => {
      Promise.all([
        import('../services/auth.service.js'),
        import('../db/connection.js'),
        import('bcrypt'),
        import('child_process'),
      ]).then(async ([authMod, { pool }, bcrypt, { exec }]) => {
        const user = await authMod.validateSession(sessionToken);
        if (!user) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid session' }));
          return;
        }
        let password = '';
        try { password = JSON.parse(bodyStr).password || ''; } catch { /* */ }
        const dbResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
        const storedHash = dbResult.rows[0]?.password_hash;
        if (!storedHash || !(await bcrypt.compare(password, storedHash))) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Incorrect password' }));
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, message: 'Shutdown initiated' }));
        setTimeout(() => {
          exec('sudo shutdown -h now', (error) => {
            if (error) console.error('Shutdown error:', error);
          });
        }, 500);
      }).catch((e) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      });
    });
    return true;
  }

  // ── Clear system cache (requires auth) ──
  if (path === '/api/system/clear-cache' && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return true;
    }
    const sessionToken = authHeader.substring(7);
    Promise.all([
      import('../services/auth.service.js'),
      import('child_process'),
    ]).then(async ([authMod, { execSync }]) => {
      const user = await authMod.validateSession(sessionToken);
      if (!user) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid session' }));
        return;
      }
      execSync('sync; echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null', { timeout: 10000 });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, message: 'Cache cleared successfully' }));
    }).catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  return false;
}
