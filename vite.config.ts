import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApiRoutes } from './server/routes/index';
import 'dotenv/config';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['cloud.arcelliteserver.com'],
      },
      plugins: [
        react(),
        {
          name: 'arcellite-api',
          async configureServer(server) {
            // Initialize database on server start
            const { initializeDatabase, isSetupNeeded, cleanupExpiredSessions } = await import('./server/db/connection.js');
            let dbInitialized = false;
            try {
              dbInitialized = await initializeDatabase();
            } catch (error: any) {
              console.error('[Server] Database initialization failed:', error?.message || error);
              console.error('[Server] The dev server will start, but API routes requiring the database will not work.');
              console.error('[Server] Run ./install.sh to set up PostgreSQL, or check your .env configuration.');
            }

            if (dbInitialized) {
              const setupNeeded = await isSetupNeeded();
              if (setupNeeded) {
                console.log('[Server] Initial setup required - no users found');
              } else {
                console.log('[Server] Database initialized with existing users');
              }

              // Clean up expired sessions every hour
              setInterval(() => {
                cleanupExpiredSessions();
              }, 60 * 60 * 1000);
            }

            server.middlewares.use(async (req, res, next) => {
              const url = req.url?.split('?')[0];
              const fullUrl = req.url ?? '';

              // ─── Security Middleware: Traffic Masking & Strict Isolation ───
              if (fullUrl.startsWith('/api/')) {
                try {
                  const secService = await import('./server/services/security.service.js');

                  // Apply traffic masking headers if enabled
                  const maskingEnabled = await secService.isTrafficMaskingEnabled();
                  if (maskingEnabled) {
                    const headers = secService.getTrafficMaskingHeaders();
                    for (const [key, value] of Object.entries(headers)) {
                      res.setHeader(key, value);
                    }
                  }

                  // Strict Isolation: block non-authorized IPs (skip login/register so user can still auth)
                  if (url !== '/api/auth/login' && url !== '/api/auth/register') {
                    const authHeader = req.headers.authorization;
                    if (authHeader?.startsWith('Bearer ')) {
                      const authSvc = await import('./server/services/auth.service.js');
                      const user = await authSvc.validateSession(authHeader.substring(7));
                      if (user) {
                        const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                          || req.socket?.remoteAddress || '';
                        const allowed = await secService.isIpAllowed(user.id, clientIp);
                        if (!allowed) {
                          res.statusCode = 403;
                          res.setHeader('Content-Type', 'application/json');
                          res.end(JSON.stringify({ error: 'Access denied: IP not in allowlist (Strict Isolation)' }));
                          return;
                        }
                      }
                    }
                  }
                } catch { /* security middleware should never break normal flow */ }
              }

              // Auth routes
              if (url === '/api/auth/register' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleRegister(req, res);
                return;
              }
              if (url === '/api/auth/login' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleLogin(req, res);
                return;
              }
              if (url === '/api/auth/verify-email' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleVerifyEmail(req, res);
                return;
              }
              if (url === '/api/auth/resend-code' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleResendCode(req, res);
                return;
              }
              if (url === '/api/auth/me' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetCurrentUser(req, res);
                return;
              }
              if (url === '/api/auth/logout' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleLogout(req, res);
                return;
              }
              if (url === '/api/auth/profile' && req.method === 'PUT') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleUpdateProfile(req, res);
                return;
              }
              if (url === '/api/auth/complete-setup' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleCompleteSetup(req, res);
                return;
              }
              if (url === '/api/auth/sessions' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetSessions(req, res);
                return;
              }
              if (url?.startsWith('/api/auth/sessions/') && req.method === 'DELETE') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleRevokeSession(req, res);
                return;
              }
              if (url === '/api/auth/account' && req.method === 'DELETE') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleDeleteAccount(req, res);
                return;
              }
              if (url === '/api/auth/settings' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetSettings(req, res);
                return;
              }
              if (url === '/api/auth/settings' && req.method === 'PUT') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleUpdateSettings(req, res);
                return;
              }
              if (url === '/api/auth/reset-settings' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleResetSettings(req, res);
                return;
              }
              if (url === '/api/auth/activity' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetActivityLog(req, res);
                return;
              }

              // Security Vault routes
              if (url === '/api/security/2fa/setup' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handle2FASetup(req, res);
                return;
              }
              if (url === '/api/security/2fa/verify' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handle2FAVerify(req, res);
                return;
              }
              if (url === '/api/security/2fa/disable' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handle2FADisable(req, res);
                return;
              }
              if (url === '/api/security/protocol-action' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleProtocolAction(req, res);
                return;
              }
              if (url === '/api/security/status' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleSecurityStatus(req, res);
                return;
              }
              if (url === '/api/security/ghost-folders' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleAddGhostFolder(req, res);
                return;
              }
              if (url === '/api/security/ghost-folders' && req.method === 'DELETE') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleRemoveGhostFolder(req, res);
                return;
              }
              if (url === '/api/security/ip-allowlist' && req.method === 'PUT') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleUpdateIpAllowlist(req, res);
                return;
              }

              if (url?.startsWith('/api/files/recent') && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetRecentFiles(req, res);
                return;
              }
              if (url?.startsWith('/api/files/search') && req.method === 'GET') {
                try {
                  const { getBaseDir } = await import('./server/files.js');
                  const fsNode = await import('fs');
                  const pathNode = await import('path');
                  const searchParams = new URL(fullUrl, 'http://localhost').searchParams;
                  const q = (searchParams.get('q') || '').toLowerCase().trim();
                  if (!q) { res.setHeader('Content-Type', 'application/json'); res.end('[]'); return; }
                  const base = getBaseDir();
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
                  res.end(JSON.stringify({ error: 'Search failed' }));
                }
                return;
              }
              if (url === '/api/files/total-count' && req.method === 'GET') {
                try {
                  const { getBaseDir } = await import('./server/files.js');
                  const fsNode = await import('fs');
                  const pathNode = await import('path');
                  const base = getBaseDir();
                  const categories = ['files', 'photos', 'videos', 'music'];
                  let totalFiles = 0;
                  let totalFolders = 0;
                  const countRecursive = (dir: string) => {
                    if (!fsNode.existsSync(dir)) return;
                    for (const entry of fsNode.readdirSync(dir, { withFileTypes: true })) {
                      if (entry.isDirectory()) {
                        totalFolders++;
                        countRecursive(pathNode.join(dir, entry.name));
                      } else if (entry.isFile()) {
                        totalFiles++;
                      }
                    }
                  };
                  for (const cat of categories) {
                    countRecursive(pathNode.join(base, cat));
                  }
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ totalFiles, totalFolders, total: totalFiles + totalFolders }));
                } catch (err) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Failed to count files' }));
                }
                return;
              }
              if (url === '/api/files/track-recent' && req.method === 'POST') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleTrackRecentFile(req, res);
                return;
              }
              if (url === '/api/auth/setup-status' && req.method === 'GET') {
                const { isSetupNeeded } = await import('./server/db/connection.js');
                const setupNeeded = await isSetupNeeded();
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ setupNeeded }));
                return;
              }

              // Try organized route modules first
              if (handleApiRoutes(req, res, fullUrl)) {
                return;
              }

              // ── SSE: Real-time USB device events ──
              if (url === '/api/system/usb-events' && req.method === 'GET') {
                res.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive',
                  'X-Accel-Buffering': 'no',
                });
                res.write(':\n\n'); // SSE comment to keep connection alive

                let lastDevices: string[] = [];

                // Get initial snapshot
                try {
                  const { getRemovableDevices } = await import('./server/storage.ts');
                  const initial = getRemovableDevices();
                  lastDevices = initial.map(d => d.name).sort();
                  res.write(`data: ${JSON.stringify({ type: 'init', devices: initial })}\n\n`);
                } catch {}

                // Poll every 3 seconds for changes
                const pollInterval = setInterval(async () => {
                  try {
                    const { getRemovableDevices } = await import('./server/storage.ts');
                    const current = getRemovableDevices();
                    const currentNames = current.map(d => d.name).sort();
                    const prevNames = lastDevices;

                    // Detect added devices
                    const added = current.filter(d => !prevNames.includes(d.name));
                    // Detect removed devices
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

                return;
              }

              if (url === '/api/system/storage') {
                import('./server/storage.ts').then(({ getRootStorage, getRemovableDevices }) => {
                  try {
                    const root = getRootStorage();
                    const removable = getRemovableDevices();
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ rootStorage: root, removable }));
                  } catch (e) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ rootStorage: null, removable: [], error: String((e as Error).message) }));
                  }
                }).catch((e) => {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ rootStorage: null, removable: [], error: String((e as Error).message) }));
                });
                return;
              }

              if (url === '/api/system/stats') {
                import('./server/stats.ts').then(({ getSystemStats }) => {
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
                return;
              }

              if (url === '/api/files/list-external') {
                const u = new URL(fullUrl, 'http://localhost');
                const pathParam = u.searchParams.get('path') || '';
                // searchParams.get already decodes — do NOT double-decode
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

                  interface DirEntry { name: string; isFolder: boolean; mtimeMs: number; sizeBytes?: number; }
                  let entries: DirEntry[] = [];

                  // Try direct read first
                  try {
                    const names: string[] = fs.readdirSync(resolved);
                    console.log(`[list-external] readdirSync returned ${names.length} entries for "${resolved}"`);
                    for (const name of names) {
                      const full = pathModule.join(resolved, name);
                      try {
                        const stat = fs.statSync(full);
                        entries.push({
                          name,
                          isFolder: stat.isDirectory(),
                          mtimeMs: stat.mtimeMs,
                          sizeBytes: stat.isFile() ? stat.size : undefined,
                        });
                      } catch {
                        entries.push({ name, isFolder: false, mtimeMs: Date.now() });
                      }
                    }
                  } catch (directErr: any) {
                    console.error(`[list-external] Direct read failed: ${directErr.code} — ${directErr.message}`);
                    // Not a permission issue — try sudo fallback
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

                  // If STILL empty, try ls as the current user (non-sudo) as last resort
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
                return;
              }

              // Serve external files by absolute path (used for removable mounts)
              if (url?.startsWith('/api/files/serve-external') && req.method === 'GET') {
                const u = new URL(fullUrl, 'http://localhost');
                const pathParam = u.searchParams.get('path') || '';

                Promise.all([import('path'), import('fs'), import('child_process')]).then(([pathModule, fsModule, cpModule]) => {
                    try {
                      const requested = decodeURIComponent(pathParam);
                      
                      // Basic sanity checks: must be absolute and not contain parent refs
                      if (!requested || !requested.startsWith('/') || requested.includes('..')) {
                        console.warn(`[serve-external] BLOCKED: Invalid path format`);
                        res.statusCode = 403;
                        res.end('Forbidden');
                        return;
                      }

                      // Check if file is accessible — try direct stat first, then sudo stat
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
                          // Try sudo stat as fallback for root-owned mount points
                          try {
                            const statOut = cpModule.execSync(
                              `sudo -n stat --format='%s %F' ${JSON.stringify(requested)}`,
                              { encoding: 'utf8', timeout: 5000 }
                            ).trim();
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
                          // Permission denied — try sudo stat
                          try {
                            const statOut = cpModule.execSync(
                              `sudo -n stat --format='%s %F' ${JSON.stringify(requested)}`,
                              { encoding: 'utf8', timeout: 5000 }
                            ).trim();
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
                        // Direct access works
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
                return;
              }

              // Delete external file/folder (removable devices)
              if (url === '/api/files/delete-external' && req.method === 'POST') {
                const chunks: Buffer[] = [];
                req.on('data', (c: Buffer) => chunks.push(c));
                req.on('end', () => {
                  import('./server/files.ts').then(({ deleteExternal }) => {
                    try {
                      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
                      const filePath = body.path;
                      if (!filePath) {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Missing path' }));
                        return;
                      }
                      deleteExternal(filePath);
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ ok: true }));
                    } catch (e: any) {
                      res.statusCode = 500;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ error: e.message }));
                    }
                  });
                });
                return;
              }

              // Rename external file/folder (removable devices)
              if (url === '/api/files/rename-external' && req.method === 'POST') {
                const chunks: Buffer[] = [];
                req.on('data', (c: Buffer) => chunks.push(c));
                req.on('end', () => {
                  import('./server/files.ts').then(({ renameExternal }) => {
                    try {
                      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
                      const { path: oldPath, newName } = body;
                      if (!oldPath || !newName) {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Missing path or newName' }));
                        return;
                      }
                      const newPath = renameExternal(oldPath, newName);
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ ok: true, newPath }));
                    } catch (e: any) {
                      res.statusCode = 500;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ error: e.message }));
                    }
                  });
                });
                return;
              }

              // Create folder on external path (removable devices)
              if (url === '/api/files/mkdir-external' && req.method === 'POST') {
                const chunks: Buffer[] = [];
                req.on('data', (c: Buffer) => chunks.push(c));
                req.on('end', () => {
                  import('./server/files.ts').then(({ mkdirExternal }) => {
                    try {
                      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
                      const folderPath = body.path;
                      if (!folderPath) {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Missing path' }));
                        return;
                      }
                      mkdirExternal(folderPath);
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ ok: true }));
                    } catch (e: any) {
                      res.statusCode = 500;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ error: e.message }));
                    }
                  });
                });
                return;
              }

              if (url === '/api/system/mount' && req.method === 'POST') {
                const chunks: Buffer[] = [];
                req.on('data', (c: Buffer) => chunks.push(c));
                req.on('end', () => {
                  Promise.all([import('./server/storage.ts'), import('child_process'), import('path')]).then(async ([{ getFirstPartition }, { spawnSync, execSync }, pathModule]) => {
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

                      // Always require sudo password — no passwordless attempts
                      if (!sudoPassword) {
                        res.statusCode = 401;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Password required', requiresAuth: true }));
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

                      // Get volume label or UUID for a nicer mount directory name
                      let volumeLabel = '';
                      try {
                        const labelOut = execSync(`lsblk -n -o LABEL /dev/${partition}`, { encoding: 'utf8', timeout: 3000 }).trim();
                        if (labelOut && /^[a-zA-Z0-9_\-. ]+$/.test(labelOut)) {
                          volumeLabel = labelOut.replace(/\s+/g, '_');
                        }
                      } catch {}
                      
                      // If no label, try UUID (e.g. "17E3-9D78")
                      if (!volumeLabel) {
                        try {
                          const uuidOut = execSync(`lsblk -n -o UUID /dev/${partition}`, { encoding: 'utf8', timeout: 3000 }).trim();
                          if (uuidOut && /^[a-zA-Z0-9_\-]+$/.test(uuidOut)) {
                            volumeLabel = uuidOut;
                          }
                        } catch {}
                      }

                      // Determine mount directory — use label if available, otherwise partition name
                      const mountName = volumeLabel || partition;
                      const mountDir = `/media/arcellite/${mountName}`;

                      // Fix parent directory permissions so arcellite user can access
                      spawnSync('sudo', ['-S', 'chmod', '755', '/media/arcellite'], {
                        input: sudoPassword + '\n',
                        encoding: 'utf8',
                        timeout: 5000,
                      });

                      // Create mount dir with sudo
                      const mkdirResult = spawnSync('sudo', ['-S', 'mkdir', '-p', mountDir], {
                        input: sudoPassword + '\n',
                        encoding: 'utf8',
                        timeout: 10000,
                      });
                      if (mkdirResult.status !== 0) {
                        const errMsg = (mkdirResult.stderr || '').trim();
                        if (errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
                          res.statusCode = 401;
                          res.setHeader('Content-Type', 'application/json');
                          res.end(JSON.stringify({ error: 'Incorrect password', requiresAuth: true }));
                          return;
                        }
                        throw new Error(errMsg || 'Failed to create mount directory');
                      }

                      // Mount the partition using sudo mount
                      const mountResult = spawnSync('sudo', ['-S', 'mount', `-o`, `uid=1000,gid=1000,dmask=022,fmask=133`, `/dev/${partition}`, mountDir], {
                        input: sudoPassword + '\n',
                        encoding: 'utf8',
                        timeout: 60000,
                        maxBuffer: 10 * 1024 * 1024,
                      });

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
                          const retryResult = spawnSync('sudo', ['-S', 'mount', `/dev/${partition}`, mountDir], {
                            input: sudoPassword + '\n',
                            encoding: 'utf8',
                            timeout: 60000,
                            maxBuffer: 10 * 1024 * 1024,
                          });
                          if (retryResult.status !== 0) {
                            throw new Error((retryResult.stderr || '').trim() || 'Mount failed');
                          }
                          // For native Linux filesystems, chown the mount point
                          spawnSync('sudo', ['-S', 'chown', '-R', 'arcellite:arcellite', mountDir], {
                            input: sudoPassword + '\n',
                            encoding: 'utf8',
                            timeout: 15000,
                          });
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
                return;
              }

              if (url === '/api/system/unmount' && req.method === 'POST') {
                const chunks: Buffer[] = [];
                req.on('data', (c: Buffer) => chunks.push(c));
                req.on('end', () => {
                  Promise.all([import('./server/storage.ts'), import('child_process')]).then(async ([{ getFirstPartition }, { spawnSync, execSync }]) => {
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

                      // Always require sudo password
                      if (!sudoPassword) {
                        res.statusCode = 401;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Password required', requiresAuth: true }));
                        return;
                      }

                      const partition = getFirstPartition(device);
                      if (!partition) {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'No partition found to unmount' }));
                        return;
                      }

                      // Find actual mountpoint via lsblk
                      let mountpoint = '';
                      try {
                        const lsblkOut = execSync(`lsblk -J -o NAME,MOUNTPOINT /dev/${partition}`, { encoding: 'utf8', timeout: 5000 });
                        const lsblkData = JSON.parse(lsblkOut) as { blockdevices?: Array<{ mountpoint?: string }> };
                        mountpoint = lsblkData.blockdevices?.[0]?.mountpoint || '';
                      } catch {}

                      if (!mountpoint) {
                        // Not mounted — nothing to do
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ ok: true }));
                        return;
                      }

                      // Unmount using sudo umount
                      const umountResult = spawnSync('sudo', ['-S', 'umount', mountpoint], {
                        input: sudoPassword + '\n',
                        encoding: 'utf8',
                        timeout: 60000,
                        maxBuffer: 10 * 1024 * 1024,
                      });

                      if (umountResult.status !== 0) {
                        const errMsg = (umountResult.stderr || umountResult.stdout || '').trim();
                        if (errMsg.includes('Sorry, try again') || errMsg.includes('incorrect password')) {
                          res.statusCode = 401;
                          res.setHeader('Content-Type', 'application/json');
                          res.end(JSON.stringify({ error: 'Incorrect password', requiresAuth: true }));
                          return;
                        }
                        if (errMsg.includes('not mounted') || errMsg.includes('not found')) {
                          res.setHeader('Content-Type', 'application/json');
                          res.end(JSON.stringify({ ok: true }));
                          return;
                        }
                        throw new Error(errMsg || 'Unmount failed');
                      }

                      // Clean up mount directory
                      try {
                        spawnSync('sudo', ['-S', 'rmdir', mountpoint], {
                          input: sudoPassword + '\n',
                          encoding: 'utf8',
                          timeout: 5000,
                        });
                      } catch {}

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
                return;
              }

              if (url === '/api/system/restart' && req.method === 'POST') {
                import('child_process').then(({ exec }) => {
                  try {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ ok: true, message: 'Restart initiated' }));
                    // Give time for response to be sent, then restart
                    setTimeout(() => {
                      exec('sudo reboot', (error) => {
                        if (error) console.error('Reboot error:', error);
                      });
                    }, 500);
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
                return;
              }

              if (url === '/api/system/shutdown' && req.method === 'POST') {
                import('child_process').then(({ exec }) => {
                  try {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ ok: true, message: 'Shutdown initiated' }));
                    // Give time for response to be sent, then shutdown
                    setTimeout(() => {
                      exec('sudo shutdown -h now', (error) => {
                        if (error) console.error('Shutdown error:', error);
                      });
                    }, 500);
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
                return;
              }

              if (url === '/api/system/clear-cache' && req.method === 'POST') {
                import('child_process').then(({ execSync }) => {
                  try {
                    // Clear system cache (requires sudo)
                    execSync('sync; echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null', { timeout: 10000 });
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ ok: true, message: 'Cache cleared successfully' }));
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
                return;
              }

              if (url === '/api/system/logs') {
                const u = new URL(fullUrl, 'http://localhost');
                const limit = parseInt(u.searchParams.get('limit') || '50', 10);
                import('./server/stats.ts').then(({ getDetailedLogs }) => {
                  try {
                    const logs = getDetailedLogs(limit);
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
                return;
              }

              if (url === '/api/vault/analytics') {
                import('./server/analytics.ts').then(({ getVaultAnalytics }) => {
                  try {
                    const analytics = getVaultAnalytics();
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(analytics));
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
                return;
              }

              if (url === '/api/vault/audit') {
                import('./server/analytics.ts').then(({ generateAuditReport }) => {
                  try {
                    const report = generateAuditReport();
                    const timestamp = new Date().toISOString().split('T')[0];
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Content-Disposition', `attachment; filename="vault-audit-${timestamp}.json"`);
                    res.end(report);
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
                return;
              }

              if (url === '/api/notifications/read-all' && req.method === 'PUT') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleMarkAllNotificationsRead(req, res);
                return;
              }
              if (url === '/api/notifications/clear-all' && req.method === 'DELETE') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleClearAllNotifications(req, res);
                return;
              }
              if (url?.match(/^\/api\/notifications\/\d+\/read$/) && req.method === 'PUT') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleMarkNotificationRead(req, res);
                return;
              }
              if (url === '/api/notifications' && req.method === 'GET') {
                const authRoutes = await import('./server/routes/auth.routes.js');
                authRoutes.handleGetNotifications(req, res);
                return;
              }

              if (url === '/api/system/info') {
                import('./server/notifications.ts').then(({ getSystemInfo }) => {
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
                return;
              }

              // n8n/MCP workflows API endpoint (bypasses CORS)
              if (url?.startsWith('/api/apps/n8n/workflows') && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => {
                  body += chunk.toString();
                });
                req.on('end', () => {
                  try {
                    const { apiUrl, apiKey, apiType } = JSON.parse(body);
                    
                    if (!apiUrl || !apiKey) {
                      res.statusCode = 400;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ error: 'Missing apiUrl or apiKey' }));
                      return;
                    }

                    // For MCP servers, just accept the connection without verification
                    // MCP uses a streaming protocol (Server-Sent Events) which doesn't work with simple HTTP requests
                    if (apiType === 'mcp') {
                      try {
                        // Validate that URL and API key are provided
                        if (!apiUrl || !apiKey) {
                          res.statusCode = 400;
                          res.setHeader('Content-Type', 'application/json');
                          res.end(JSON.stringify({ error: 'MCP URL and Bearer token are required' }));
                          return;
                        }

                        // Try to parse URL to validate format
                        try {
                          new URL(apiUrl);
                        } catch {
                          res.statusCode = 400;
                          res.setHeader('Content-Type', 'application/json');
                          res.end(JSON.stringify({ error: `Invalid MCP URL format. Please use full URL like "https://your-domain.com/mcp-server/http"` }));
                          return;
                        }

                        // MCP connections are accepted without verification since they use streaming protocol
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ data: [], statusMessage: 'MCP server connection configured' }));
                      } catch (e) {
                        console.error('[MCP] Error:', e);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: String((e as Error).message) }));
                      }
                      return;
                    }

                    // For n8n servers, fetch workflows
                    import('https').then((https) => {
                      import('http').then((http) => {
                        try {
                          const baseUrl = new URL(apiUrl);
                          const protocol = baseUrl.protocol === 'https:' ? https : http;
                          
                          // Build the path correctly - if pathname is /, use /api/v1/workflows
                          // Otherwise append /api/v1/workflows to the pathname
                          let path = '/api/v1/workflows';
                          if (baseUrl.pathname && baseUrl.pathname !== '/') {
                            // Remove trailing slash if present
                            const basePath = baseUrl.pathname.replace(/\/$/, '');
                            path = `${basePath}/api/v1/workflows`;
                          }
                          
                          const port = baseUrl.port || (baseUrl.protocol === 'https:' ? 443 : 80);
                          
                          const options = {
                            hostname: baseUrl.hostname,
                            port: port,
                            path: path,
                            method: 'GET',
                            headers: {
                              'X-N8N-API-KEY': apiKey,
                              'Content-Type': 'application/json',
                            },
                            timeout: 10000,
                          };

                          const request = protocol.request(options, (n8nRes) => {
                            let data = '';
                            n8nRes.on('data', chunk => {
                              data += chunk;
                            });
                            n8nRes.on('end', () => {
                              res.setHeader('Content-Type', 'application/json');
                              res.statusCode = n8nRes.statusCode || 200;
                              
                              if (n8nRes.statusCode === 401) {
                                console.error(`[n8n] 401 Unauthorized - Invalid API key or endpoint`);
                                res.end(JSON.stringify({ error: 'Unauthorized (401): Invalid API key or endpoint', statusCode: 401 }));
                              } else if (n8nRes.statusCode && n8nRes.statusCode >= 400) {
                                console.error(`[n8n] Error ${n8nRes.statusCode}: ${data}`);
                                res.end(data || JSON.stringify({ error: `HTTP ${n8nRes.statusCode}` }));
                              } else {
                                res.end(data);
                              }
                            });
                          });

                          request.on('error', (err) => {
                            console.error('[n8n] Request error:', err.message);
                            res.statusCode = 500;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ error: `Connection error: ${(err as Error).message}` }));
                          });

                          request.on('timeout', () => {
                            request.destroy();
                            console.error('[n8n] Request timeout');
                            res.statusCode = 504;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ error: 'Request timeout - API server not responding' }));
                          });

                          request.end();
                        } catch (parseErr) {
                          console.error('[n8n] URL parse error:', parseErr);
                          res.statusCode = 400;
                          res.setHeader('Content-Type', 'application/json');
                          res.end(JSON.stringify({ error: `Invalid API URL format: ${(parseErr as Error).message}` }));
                        }
                      });
                    }).catch((err) => {
                      console.error('[n8n] Import error:', err);
                      res.statusCode = 500;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ error: String((err as Error).message) }));
                    });
                  } catch (e) {
                    console.error('[n8n] Parse error:', e);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: String((e as Error).message) }));
                  }
                });
                return;
              }

              // PostgreSQL/MySQL Database API - Fetch available databases
              if ((url?.startsWith('/api/apps/database/connect') || url?.startsWith('/api/apps/database/databases')) && req.method === 'POST') {
                const chunks: Buffer[] = [];
                req.on('data', (c: Buffer) => chunks.push(c));
                req.on('end', () => {
                  try {
                    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
                    const { type, host, port, username, password, database } = body;
                    
                    if (!type || !host || !port || !username) {
                      res.statusCode = 400;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ error: 'Missing required credentials: type, host, port, username' }));
                      return;
                    }

                    if (!type || !host || !port || !username) {
                      res.statusCode = 400;
                      // Use postgres driver
                      import('pg').then(({ Client }) => {
                        const client = new Client({
                          host,
                          port: parseInt(port),
                          user: username,
                          password: password || undefined,
                          database: database || 'postgres',
                          connectionTimeoutMillis: 5000,
                          command_timeout: 5000,
                        });

                        client.connect()
                          .then(() => {
                            // Fetch list of databases
                            if (url?.includes('/databases')) {
                              client.query('SELECT datname FROM pg_database WHERE datistemplate = false AND datname != \'postgres\' ORDER BY datname', (err, result) => {
                                client.end();
                                if (err) {
                                  console.error('[Database] Query error:', err.message);
                                  res.statusCode = 500;
                                  res.setHeader('Content-Type', 'application/json');
                                  res.end(JSON.stringify({ error: `Query failed: ${err.message}` }));
                                } else {
                                  const databases = result ? result.rows.map((r: any) => r.datname) : [];
                                  res.statusCode = 200;
                                  res.setHeader('Content-Type', 'application/json');
                                  res.end(JSON.stringify({ success: true, databases, type: 'postgresql' }));
                                }
                              });
                            } else {
                              // Just test connection
                              client.query('SELECT 1', (err) => {
                                client.end();
                                if (err) {
                                  console.error('[Database] Connection test failed:', err.message);
                                  res.statusCode = 500;
                                  res.setHeader('Content-Type', 'application/json');
                                  res.end(JSON.stringify({ error: `Connection failed: ${err.message}` }));
                                } else {
                                  res.statusCode = 200;
                                  res.setHeader('Content-Type', 'application/json');
                                  res.end(JSON.stringify({ success: true, message: 'Connected to PostgreSQL' }));
                                }
                              });
                            }
                          })
                          .catch((err) => {
                            console.error('[Database] Connection error:', err.message);
                            res.statusCode = 500;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ error: `Connection failed: ${err.message}` }));
                          });
                      }).catch((err) => {
                        console.error('[Database] PostgreSQL driver not available:', err);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'PostgreSQL driver not available. Install with: npm install pg' }));
                      });
                    } else if (type === 'mysql') {
                      // Use mysql2 driver for MySQL
                      import('mysql2/promise').then(async (mysql) => {
                        try {
                          const connection = await mysql.createConnection({
                            host,
                            port: parseInt(port),
                            user: username,
                            password: password || '',
                            connectionLimit: 1,
                            waitForConnections: true,
                            enableKeepAlive: true,
                          });

                          if (url?.includes('/databases')) {
                            const [rows] = await connection.query('SHOW DATABASES');
                            await connection.end();
                            
                            const databases = (rows as any[])
                              .map((r: any) => r.Database)
                              .filter((db: string) => !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db));
                            
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true, databases, type: 'mysql' }));
                          } else {
                            await connection.ping();
                            await connection.end();
                            
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true, message: 'Connected to MySQL' }));
                          }
                        } catch (err: any) {
                          console.error('[Database] MySQL error:', err.message);
                          res.statusCode = 500;
                          res.setHeader('Content-Type', 'application/json');
                          res.end(JSON.stringify({ error: `Connection failed: ${err.message}` }));
                        }
                      }).catch((err) => {
                        console.error('[Database] MySQL driver not available:', err);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'MySQL driver not available. Install with: npm install mysql2' }));
                      });
                    } else {
                      res.statusCode = 400;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ error: 'Unsupported database type' }));
                    }
                  } catch (e) {
                    console.error('[Database] Parse error:', e);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: String((e as Error).message) }));
                  }
                });
                return;
              }

              // ─── Connected Apps: GET (load from DB) ───
              if (url === '/api/apps/connections' && req.method === 'GET') {
                const authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                  res.statusCode = 401;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Unauthorized' }));
                  return;
                }
                const sessionToken = authHeader.substring(7);
                import('./server/services/auth.service.js').then(async (authService) => {
                  const user = await authService.validateSession(sessionToken);
                  if (!user) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Invalid session' })); return; }
                  const { pool } = await import('./server/db/connection.js');
                  const result = await pool.query(
                    `SELECT config FROM connected_apps WHERE user_id = $1 AND app_type = 'myapps_state' AND is_active = true ORDER BY updated_at DESC LIMIT 1`,
                    [user.id]
                  );
                  if (result.rows.length > 0 && result.rows[0].config) {
                    res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(result.rows[0].config));
                  } else {
                    res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ apps: null, connectedAppIds: null }));
                  }
                }).catch(e => { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: String(e) })); });
                return;
              }

              // ─── Connected Apps: PUT (save to DB) ───
              if (url === '/api/apps/connections' && req.method === 'PUT') {
                const authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                  res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Unauthorized' })); return;
                }
                const sessionToken = authHeader.substring(7);
                const chunks: Buffer[] = [];
                req.on('data', (c: Buffer) => chunks.push(c));
                req.on('end', async () => {
                  try {
                    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    const authService = await import('./server/services/auth.service.js');
                    const user = await authService.validateSession(sessionToken);
                    if (!user) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Invalid session' })); return; }
                    const { pool } = await import('./server/db/connection.js');
                    // Upsert — one row per user for the full myapps state
                    const existing = await pool.query(`SELECT id FROM connected_apps WHERE user_id = $1 AND app_type = 'myapps_state'`, [user.id]);
                    if (existing.rows.length > 0) {
                      await pool.query(`UPDATE connected_apps SET config = $1, updated_at = NOW() WHERE user_id = $2 AND app_type = 'myapps_state'`, [JSON.stringify(body), user.id]);
                    } else {
                      await pool.query(`INSERT INTO connected_apps (user_id, app_type, app_name, config) VALUES ($1, 'myapps_state', 'My Apps State', $2)`, [user.id, JSON.stringify(body)]);
                    }
                    res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true }));
                  } catch (e) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: String(e) })); }
                });
                return;
              }

              // ─── Webhook Proxy: POST (connects to external webhooks server-side for CORS/phone) ───
              if (url === '/api/apps/webhook-proxy' && req.method === 'POST') {
                const chunks: Buffer[] = [];
                req.on('data', (c: Buffer) => chunks.push(c));
                req.on('end', async () => {
                  try {
                    const { webhookUrl } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    if (!webhookUrl) { res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Missing webhookUrl' })); return; }
                    const https = await import('https');
                    const http = await import('http');
                    const parsedUrl = new URL(webhookUrl);
                    const protocol = parsedUrl.protocol === 'https:' ? https : http;
                    const options = {
                      hostname: parsedUrl.hostname,
                      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                      path: parsedUrl.pathname + parsedUrl.search,
                      method: 'GET',
                      headers: { 'Content-Type': 'application/json' },
                      timeout: 15000,
                    };
                    const proxyReq = protocol.request(options, (proxyRes) => {
                      let data = '';
                      proxyRes.on('data', (chunk: string) => { data += chunk; });
                      proxyRes.on('end', () => {
                        res.statusCode = proxyRes.statusCode || 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(data);
                      });
                    });
                    proxyReq.on('error', (err: Error) => { res.statusCode = 502; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `Webhook unreachable: ${err.message}` })); });
                    proxyReq.on('timeout', () => { proxyReq.destroy(); res.statusCode = 504; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Webhook timeout' })); });
                    proxyReq.end();
                  } catch (e) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: String(e) })); }
                });
                return;
              }

              next();
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        cssCodeSplit: false,
      },
      publicDir: 'public',
    };
});
