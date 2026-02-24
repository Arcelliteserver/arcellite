import type { IncomingMessage, ServerResponse } from 'http';
import Busboy from 'busboy';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as authService from '../services/auth.service.js';
import * as securityService from '../services/security.service.js';

/** Send vault-locked error response */
function sendVaultLockedError(res: ServerResponse): void {
  res.statusCode = 403;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Vault is in lockdown mode. Disable Vault Lockdown in Account Settings to make changes.' }));
}

const homeDir = os.homedir();

/** Cached resolved storage path (from user's DB setting) */
let _cachedBaseDir: string | null = null;
let _baseDirLastCheck = 0;

/**
 * Get the active storage directory.
 * Reads the user's storage_path from the database (cached for 30s).
 * Falls back to ARCELLITE_DATA env or ~/arcellite-data.
 */
async function getBaseDir(): Promise<string> {
  const now = Date.now();
  if (_cachedBaseDir && now - _baseDirLastCheck < 30_000) {
    return _cachedBaseDir;
  }
  try {
    _cachedBaseDir = await authService.getActiveStoragePath();
    _baseDirLastCheck = now;
    // Share with other modules (trash.ts, files.ts) via global
    (globalThis as any).__arcellite_storage_path = _cachedBaseDir;
    return _cachedBaseDir;
  } catch {
    // Fallback if DB isn't ready
    let dir = process.env.ARCELLITE_DATA || path.join(homeDir, 'arcellite-data');
    if (dir.startsWith('~/') || dir === '~') {
      dir = path.join(homeDir, dir.slice(2));
    }
    return dir;
  }
}

/** Synchronous fallback for non-async contexts */
function getBaseDirSync(): string {
  // Always prefer the globalThis cache (set by transfer and startup) over local cache
  const globalCached = (globalThis as any).__arcellite_storage_path;
  if (globalCached) {
    _cachedBaseDir = globalCached;
    return globalCached;
  }
  if (_cachedBaseDir) return _cachedBaseDir;
  let dir = process.env.ARCELLITE_DATA || path.join(homeDir, 'arcellite-data');
  if (dir.startsWith('~/') || dir === '~') {
    dir = path.join(homeDir, dir.slice(2));
  }
  return dir;
}

/** Resolve and expand a raw storage path string */
function expandStoragePath(raw: string): string {
  if (raw.startsWith('~/') || raw === '~') {
    return path.join(homeDir, raw.slice(raw === '~' ? 1 : 2));
  }
  return raw;
}

/**
 * Resolve storage base dir for the authenticated user on this request.
 * Uses req.user.storagePath set by the security middleware; falls back to
 * a direct session validation if the middleware didn't run (e.g. error in
 * security service). This guarantees family member isolation is never bypassed.
 */
/** Extract session token from request — Authorization header first, cookie fallback. */
function extractToken(req: IncomingMessage): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);
  // Fallback: cookie set by the frontend for browser-initiated requests (audio/video/img)
  const cookies = req.headers.cookie;
  if (cookies) {
    const match = cookies.match(/(?:^|;\s*)arcellite_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return undefined;
}

async function getRequestBaseDir(req: IncomingMessage): Promise<string> {
  let storagePath = (req as any).user?.storagePath as string | undefined;
  if (!storagePath || storagePath === 'pending') {
    // Safety net: re-validate session directly to get the correct storage path
    try {
      const token = extractToken(req);
      if (token) {
        const user = await authService.validateSession(token);
        if (user?.storagePath) {
          (req as any).user = user; // cache on req for subsequent sync calls
          storagePath = user.storagePath;
        }
      }
    } catch { /* fall through to global */ }
  }
  if (storagePath && storagePath !== 'pending') {
    return expandStoragePath(storagePath);
  }
  return getBaseDir();
}

function getRequestBaseDirSync(req: IncomingMessage): string {
  const userPath = (req as any).user?.storagePath as string | undefined;
  if (userPath && userPath !== 'pending') {
    return expandStoragePath(userPath);
  }
  return getBaseDirSync();
}

/**
 * SEC-PT-001/002: Validate that a resolved path stays within the base directory.
 * Throws if path traversal is detected.
 */
function assertPathWithinBase(resolvedPath: string, baseDir: string): void {
  const normalizedBase = path.resolve(baseDir);
  const normalizedTarget = path.resolve(resolvedPath);
  if (normalizedTarget !== normalizedBase && !normalizedTarget.startsWith(normalizedBase + path.sep)) {
    throw new Error('Path traversal attempt detected');
  }
  // Resolve symlinks to prevent traversal via symlinks inside the storage dir
  try {
    const realBase = fs.realpathSync(normalizedBase);
    const realTarget = fs.realpathSync(normalizedTarget);
    if (realTarget !== realBase && !realTarget.startsWith(realBase + path.sep)) {
      throw new Error('Path traversal attempt detected (symlink)');
    }
  } catch (e: any) {
    if (e.message?.includes('Path traversal')) throw e;
    // File doesn't exist yet (e.g. during upload) — skip realpath check
  }
}

/** Send suspended-account error response */
function sendSuspendedError(res: ServerResponse): void {
  res.statusCode = 403;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Your account is suspended. Contact the account administrator.' }));
}

/** True when the authenticated user is a suspended family member */
function isUserSuspended(req: IncomingMessage): boolean {
  return (req as any).user?.isSuspended === true;
}

/** Send 401 for unauthenticated write operations */
function sendUnauthError(res: ServerResponse): void {
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Authentication required' }));
}

export function handleFileRoutes(req: IncomingMessage, res: ServerResponse, url: string) {
  // Warm up cache asynchronously (non-blocking)
  if (!_cachedBaseDir) getBaseDir().catch(() => {});

  // SEC-AUTHZ: All write operations require an authenticated session.
  // req.user is set by the auth middleware in vite.config.ts; absent = no valid token.
  const isWriteOp = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' || req.method === 'PATCH';
  if (isWriteOp && !(req as any).user?.id) {
    sendUnauthError(res);
    return true;
  }

  // File upload
  if (url === '/api/files/upload' && req.method === 'POST') {
    // Block suspended family members
    if (isUserSuspended(req)) { sendSuspendedError(res); return true; }
    // Check vault lockdown before processing upload
    // BUG-004: await vault lock check before touching request stream
    authService.isVaultLocked().then(async locked => {
      if (locked) { sendVaultLockedError(res); return; }

      const baseDir = await getRequestBaseDir(req);

      // SEC-005: limit individual file size to 10 GB
      // BUG-R01: stream files to temp first, then move after ALL fields are received so
      // category/path are always available regardless of multipart field ordering.
      const busboy = Busboy({ headers: req.headers as any, limits: { fileSize: 10 * 1024 * 1024 * 1024 } });
      const fields: Record<string, string> = {};
      const pendingMoves: { filename: string; tmpPath: string }[] = [];
      const writePromises: Promise<void>[] = [];
      let uploadError: Error | null = null;

      busboy.on('field', (name: string, value: string) => {
        fields[name] = value;
      });

      busboy.on('file', (_name: string, file: any, info: { filename: string }) => {
        // BUG-002: stream directly to temp file on disk — never buffer entire file in RAM
        const safeFilename = path.basename(info.filename);
        const tmpPath = path.join(os.tmpdir(), `arcellite-${Date.now()}-${Math.random().toString(36).slice(2)}-${safeFilename}`);

        const writeStream = fs.createWriteStream(tmpPath);
        pendingMoves.push({ filename: safeFilename, tmpPath });

        const p = new Promise<void>((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
          file.on('error', reject);
        });
        writePromises.push(p);
        file.pipe(writeStream);
      });

      busboy.on('finish', async () => {
        try {
          await Promise.all(writePromises);
          if (uploadError) throw uploadError;

          // BUG-R01: resolve final destination now that ALL fields are available
          const category = fields['category'] || 'general';
          const relativePath = fields['path'] || '';
          const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
          const categoryDir = catMap[category] || 'files';
          const targetDir = path.resolve(baseDir, categoryDir, relativePath);

          // BUG-003: path traversal guard on the resolved target directory
          if (!targetDir.startsWith(path.resolve(baseDir) + path.sep) && targetDir !== path.resolve(baseDir)) {
            for (const { tmpPath } of pendingMoves) {
              try { fs.unlinkSync(tmpPath); } catch {}
            }
            throw new Error('Path traversal attempt detected');
          }

          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const movedFiles: { filename: string; path: string }[] = [];
          for (const { filename, tmpPath } of pendingMoves) {
            const targetPath = path.resolve(targetDir, filename);
            if (!targetPath.startsWith(path.resolve(baseDir) + path.sep)) {
              try { fs.unlinkSync(tmpPath); } catch {}
              throw new Error('Path traversal attempt detected');
            }
            try {
              fs.renameSync(tmpPath, targetPath);
            } catch {
              // Cross-device (tmpdir on different filesystem): copy then delete
              fs.copyFileSync(tmpPath, targetPath);
              fs.unlinkSync(tmpPath);
            }
            movedFiles.push({ filename, path: targetPath });
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, files: movedFiles }));
        } catch (e) {
          for (const { tmpPath } of pendingMoves) {
            try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
          }
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String((e as Error).message) }));
        }
      });

      busboy.on('error', (e: Error) => {
        for (const { tmpPath } of pendingMoves) {
          try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
        }
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String(e.message) }));
      });

      req.pipe(busboy);
    }).catch(() => { sendVaultLockedError(res); });
    return true;
  }

  // File listing (but NOT list-external — that's handled separately in vite.config.ts middleware)
  if (url?.startsWith('/api/files/list') && !url?.startsWith('/api/files/list-external') && req.method === 'GET') {
    (async () => {
      try {
        const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
        const category = urlObj.searchParams.get('category') || 'general';
        const pathParam = urlObj.searchParams.get('path') || '';
        const searchQuery = urlObj.searchParams.get('q') || '';

        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
        const categoryDir = catMap[category] || 'files';
        const baseDir = await getRequestBaseDir(req);
        const targetDir = path.join(baseDir, categoryDir, pathParam);
        assertPathWithinBase(targetDir, baseDir);  // SEC-PT-001

        if (!fs.existsSync(targetDir)) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ folders: [], files: [] }));
          return;
        }

        // Get user for security settings
        let ghostFolders: string[] = [];
        let obfuscateFiles = false;
        try {
          const authHeader = req.headers.authorization;
          if (authHeader?.startsWith('Bearer ')) {
            const user = await authService.validateSession(authHeader.substring(7));
            if (user) {
              const settings = await authService.getUserSettings(user.id);
              if (settings.secGhostFolders) {
                ghostFolders = await securityService.getGhostFolders(user.id);
              }
              obfuscateFiles = settings.secFileObfuscation;
            }
          }
        } catch { /* continue without security features */ }

        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        let folders = entries
          .filter((e) => e.isDirectory())
          .map((e) => {
            const fullPath = path.join(targetDir, e.name);
            const stat = fs.statSync(fullPath);
            let itemCount = 0;
            let hasSubfolders = false;
            try {
              const children = fs.readdirSync(fullPath, { withFileTypes: true });
              itemCount = children.length;
              hasSubfolders = children.some(c => c.isDirectory());
            } catch {}
            return { name: e.name, mtimeMs: stat.mtimeMs, itemCount, hasSubfolders };
          });

        // Apply ghost folders filter (hide unless explicitly searched)
        if (ghostFolders.length > 0 && !searchQuery) {
          const currentPath = path.join(categoryDir, pathParam);
          folders = folders.filter(f => {
            const folderFullPath = path.join(currentPath, f.name);
            return !ghostFolders.some(gf => folderFullPath === gf || folderFullPath.startsWith(gf + '/'));
          });
        }

        let files = entries
          .filter((e) => e.isFile())
          .map((e) => {
            const fullPath = path.join(targetDir, e.name);
            const stat = fs.statSync(fullPath);
            return { name: e.name, mtimeMs: stat.mtimeMs, sizeBytes: stat.size };
          });

        // Apply file obfuscation (randomize timestamps and fuzz sizes)
        if (obfuscateFiles) {
          files = files.map(f => securityService.obfuscateFileEntry(f) as typeof f);
          folders = folders.map(f => ({
            ...securityService.obfuscateFileEntry({ name: f.name, mtimeMs: f.mtimeMs, isFolder: true }),
            itemCount: f.itemCount,
            hasSubfolders: f.hasSubfolders,
          }));
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ folders, files }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    })();
    return true;
  }

  // File serving (exclude serve-external which is handled by vite middleware)
  if (url?.startsWith('/api/files/serve') && !url?.startsWith('/api/files/serve-external') && req.method === 'GET') {
    try {
      const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
      const category = urlObj.searchParams.get('category') || 'general';
      const pathParam = urlObj.searchParams.get('path') || '';

      const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
      const categoryDir = catMap[category] || 'files';
      const baseDir = getRequestBaseDirSync(req);
      const filePath = path.join(baseDir, categoryDir, pathParam);
      assertPathWithinBase(filePath, baseDir);  // SEC-PT-001

      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end('File not found');
        return true;
      }

      // Guard against trying to read a directory
      const fileStat = fs.statSync(filePath);
      if (fileStat.isDirectory()) {
        res.statusCode = 400;
        res.end('Cannot serve a directory');
        return true;
      }

      const ext = path.extname(filePath).toLowerCase();
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
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.ogg': 'audio/ogg',
        '.aac': 'audio/aac',
        '.m4a': 'audio/mp4',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';
      const fileSize = fileStat.size;

      // ETag for browser cache validation (size + mtime fingerprint)
      const etag = `"${fileStat.size}-${Math.floor(fileStat.mtimeMs)}"`;
      const lastModified = fileStat.mtime.toUTCString();

      // 304 Not Modified — serve from browser cache if unchanged
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { ETag: etag, 'Last-Modified': lastModified, 'Cache-Control': 'public, max-age=31536000' });
        res.end();
        return true;
      }

      // Support HTTP Range requests (required for mobile video/audio playback)
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'ETag': etag,
          'Last-Modified': lastModified,
        });

        const stream = fs.createReadStream(filePath, { start, end });
        stream.on('error', (err) => { console.error('[Files] Stream error:', err.message); if (!res.headersSent) { res.statusCode = 500; } res.end(); });
        stream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000',
          'ETag': etag,
          'Last-Modified': lastModified,
        });

        const stream = fs.createReadStream(filePath);
        stream.on('error', (err) => { console.error('[Files] Stream error:', err.message); if (!res.headersSent) { res.statusCode = 500; } res.end(); });
        stream.pipe(res);
      }
    } catch (e) {
      res.statusCode = 500;
      res.end('Server error');
    }
    return true;
  }

  // File download
  if (url?.startsWith('/api/files/download') && req.method === 'GET') {
    try {
      const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
      const category = urlObj.searchParams.get('category') || 'general';
      const pathParam = urlObj.searchParams.get('path') || '';

      const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
      const categoryDir = catMap[category] || 'files';
      const baseDir = getRequestBaseDirSync(req);
      const filePath = path.join(baseDir, categoryDir, pathParam);
      assertPathWithinBase(filePath, baseDir);  // SEC-PT-001

      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end('File not found');
        return true;
      }

      const filename = path.basename(filePath);
      const encodedFilename = encodeURIComponent(filename).replace(/'/g, '%27');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
      res.setHeader('Content-Type', 'application/octet-stream');

      const stream = fs.createReadStream(filePath);
      stream.on('error', (err) => { console.error('[Files] Download stream error:', err.message); if (!res.headersSent) { res.statusCode = 500; } res.end(); });
      stream.pipe(res);
    } catch (e) {
      res.statusCode = 500;
      res.end('Server error');
    }
    return true;
  }

  // File/folder creation (mkdir)
  if (url === '/api/files/mkdir' && req.method === 'POST') {
    if (isUserSuspended(req)) { sendSuspendedError(res); return true; }
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      try {
        if (await authService.isVaultLocked()) { sendVaultLockedError(res); return; }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const category = (body.category as string) || 'general';
        const relativePath = (body.path as string) || '';

        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
        const categoryDir = catMap[category] || 'files';
        const baseDir = getRequestBaseDirSync(req);
        const targetPath = path.join(baseDir, categoryDir, relativePath);
        assertPathWithinBase(targetPath, baseDir);  // SEC-PT-002

        fs.mkdirSync(targetPath, { recursive: true });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // File/folder creation
  if (url === '/api/files/create' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const category = (body.category as string) || 'general';
        const pathParam = (body.path as string) || '';
        const name = (body.name as string) || '';

        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
        const categoryDir = catMap[category] || 'files';
        const baseDir = getRequestBaseDirSync(req);
        const targetPath = path.join(baseDir, categoryDir, pathParam, name);
        assertPathWithinBase(targetPath, baseDir);  // SEC-PT-002

        fs.mkdirSync(targetPath, { recursive: true });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // File/folder deletion
  if (url === '/api/files/delete' && req.method === 'POST') {
    if (isUserSuspended(req)) { sendSuspendedError(res); return true; }
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      try {
        if (await authService.isVaultLocked()) { sendVaultLockedError(res); return; }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const category = (body.category as string) || 'general';
        const pathParam = (body.path as string) || '';

        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
        const categoryDir = catMap[category] || 'files';
        const baseDir = getRequestBaseDirSync(req);
        const targetPath = path.join(baseDir, categoryDir, pathParam);
        assertPathWithinBase(targetPath, baseDir);  // SEC-PT-002

        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }

        // Clean up from recent files database
        import('../services/auth.service.js').then(({ removeRecentFilesUnderPath }) => {
          removeRecentFilesUnderPath(pathParam, category);
        }).catch(err => console.error('[Files] Failed to clean recent files:', err));

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // File/folder move
  if (url === '/api/files/move' && req.method === 'POST') {
    if (isUserSuspended(req)) { sendSuspendedError(res); return true; }
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      try {
        if (await authService.isVaultLocked()) { sendVaultLockedError(res); return; }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const category = (body.category as string) || 'general';
        const sourcePath = (body.sourcePath as string) || '';
        const targetPath = (body.targetPath as string) || '';

        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
        const categoryDir = catMap[category] || 'files';
        const baseDir = getRequestBaseDirSync(req);
        const sourceFullPath = path.join(baseDir, categoryDir, sourcePath);
        const targetFullPath = path.join(baseDir, categoryDir, targetPath);
        assertPathWithinBase(sourceFullPath, baseDir);  // SEC-PT-002
        assertPathWithinBase(targetFullPath, baseDir);  // SEC-PT-002

        const targetDir = path.dirname(targetFullPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        fs.renameSync(sourceFullPath, targetFullPath);

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // Cross-category file move (e.g., move a PDF from Videos to Files)
  if (url === '/api/files/move-cross' && req.method === 'POST') {
    if (isUserSuspended(req)) { sendSuspendedError(res); return true; }
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      try {
        if (await authService.isVaultLocked()) { sendVaultLockedError(res); return; }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const sourceCategory = (body.sourceCategory as string) || 'general';
        const sourcePath = (body.sourcePath as string) || '';
        const targetCategory = (body.targetCategory as string) || 'general';
        const targetPath = (body.targetPath as string) || '';

        const catMap: Record<string, string> = { media: 'photos', video_vault: 'videos', general: 'files', music: 'music' };
        const srcDir = catMap[sourceCategory] || 'files';
        const tgtDir = catMap[targetCategory] || 'files';
        const baseDir = getRequestBaseDirSync(req);
        const sourceFullPath = path.join(baseDir, srcDir, sourcePath);
        const targetFullPath = path.join(baseDir, tgtDir, targetPath);
        assertPathWithinBase(sourceFullPath, baseDir);  // SEC-PT-002
        assertPathWithinBase(targetFullPath, baseDir);  // SEC-PT-002

        if (!fs.existsSync(sourceFullPath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Source file does not exist' }));
          return;
        }

        if (fs.existsSync(targetFullPath)) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'A file with the same name already exists in the target location' }));
          return;
        }

        const targetDir = path.dirname(targetFullPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        try {
          fs.renameSync(sourceFullPath, targetFullPath);
        } catch (err: any) {
          if (err.code === 'EXDEV') {
            fs.copyFileSync(sourceFullPath, targetFullPath);
            fs.unlinkSync(sourceFullPath);
          } else {
            throw err;
          }
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // Save shared file from external service (Google Drive, etc.) to vault
  if ((url === '/api/files/save-shared' || url?.startsWith('/api/files/save-shared?')) && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { fileId, fileName, mimeType, appId, webhookUrl } = JSON.parse(body);
        if (!fileId || !fileName) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'fileId and fileName are required' }));
          return;
        }

        // Determine the download webhook — use the same webhook base with a download action
        const baseWebhookUrl = webhookUrl || 'https://n8n.arcelliteserver.com/webhook/google-files';

        // Try to download the file via n8n webhook by POSTing with download action
        let downloadResponse: Response | null = null;

        // Strategy 1: POST to the same webhook with download action
        try {
          downloadResponse = await fetch(baseWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'download', fileId, mimeType }),
          });

          // If POST returned error or HTML, try GET with query param
          if (!downloadResponse.ok || downloadResponse.headers.get('content-type')?.includes('text/html')) {
            downloadResponse = null;
          }
        } catch {
          downloadResponse = null;
        }

        // Strategy 2: GET with fileId query param
        if (!downloadResponse) {
          try {
            downloadResponse = await fetch(`${baseWebhookUrl}?action=download&fileId=${encodeURIComponent(fileId)}&mimeType=${encodeURIComponent(mimeType || '')}`, {
              method: 'GET',
            });
            if (!downloadResponse.ok) {
              downloadResponse = null;
            }
          } catch {
            downloadResponse = null;
          }
        }

        // Strategy 3: Try a dedicated download webhook
        if (!downloadResponse) {
          const downloadWebhookUrl = baseWebhookUrl.replace(/\/webhook\/.*$/, '/webhook/google-download');
          try {
            downloadResponse = await fetch(`${downloadWebhookUrl}?fileId=${encodeURIComponent(fileId)}&mimeType=${encodeURIComponent(mimeType || '')}`, {
              method: 'GET',
            });
            if (!downloadResponse.ok) {
              downloadResponse = null;
            }
          } catch {
            downloadResponse = null;
          }
        }

        if (!downloadResponse) {
          res.statusCode = 422;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Could not download file. Your n8n workflow needs to support file downloads.',
            hint: 'Update your Google Drive n8n workflow to handle POST requests with { action: "download", fileId } and return the file binary data.',
          }));
          return;
        }

        // Determine target category and file extension
        const ext = path.extname(fileName).toLowerCase();
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
        const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm'];
        const audioExts = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];

        let category = 'files';
        if (imageExts.includes(ext)) category = 'photos';
        else if (videoExts.includes(ext)) category = 'videos';
        else if (audioExts.includes(ext)) category = 'music';

        // Add extension for Google Workspace files (Docs → .pdf, Sheets → .xlsx, Slides → .pptx)
        let savedFileName = fileName;
        if (!ext || ext === '.') {
          if (mimeType?.includes('google-apps.document')) savedFileName += '.pdf';
          else if (mimeType?.includes('google-apps.spreadsheet')) savedFileName += '.xlsx';
          else if (mimeType?.includes('google-apps.presentation')) savedFileName += '.pptx';
          else savedFileName += '.pdf';
        }

        // Sanitize filename
        savedFileName = savedFileName.replace(/[<>:"|?*]/g, '_');

        // Save to vault
        const targetDir = path.join(getRequestBaseDirSync(req), category);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Avoid overwriting — add number suffix if file exists
        let finalPath = path.join(targetDir, savedFileName);
        let counter = 1;
        const baseName = path.parse(savedFileName).name;
        const finalExt = path.extname(savedFileName);
        while (fs.existsSync(finalPath)) {
          finalPath = path.join(targetDir, `${baseName} (${counter})${finalExt}`);
          counter++;
        }

        // Write file to disk
        const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());
        fs.writeFileSync(finalPath, fileBuffer);

        const savedName = path.basename(finalPath);
        const fileSizeBytes = fs.statSync(finalPath).size;

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ok: true,
          savedFileName: savedName,
          category,
          sizeBytes: fileSizeBytes,
          path: `${category}/${savedName}`,
        }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });
    return true;
  }

  // Clear all files (Danger Zone)
  if (url === '/api/files/clear-all' && req.method === 'POST') {
    import('../files.js').then(({ clearAllFiles }) => {
      try {
        const result = clearAllFiles();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, ...result }));
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

  // Delete external file/folder (removable devices)
  if (url === '/api/files/delete-external' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      try {
        const { deleteExternal } = await import('../files.js');
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!body.path) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing path' }));
          return;
        }
        deleteExternal(body.path);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return true;
  }

  // Rename external file/folder (removable devices)
  if (url === '/api/files/rename-external' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      try {
        const { renameExternal } = await import('../files.js');
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!body.path || !body.newName) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing path or newName' }));
          return;
        }
        const newPath = renameExternal(body.path, body.newName);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, newPath }));
      } catch (e: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return true;
  }

  // Create folder on external path (removable devices)
  if (url === '/api/files/mkdir-external' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      try {
        const { mkdirExternal } = await import('../files.js');
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!body.path) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing path' }));
          return;
        }
        mkdirExternal(body.path);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (e: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return true;
  }

  return false;
}