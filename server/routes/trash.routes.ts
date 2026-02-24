import type { IncomingMessage, ServerResponse } from 'http';
import os from 'os';
import fs from 'fs';
import nodePath from 'path';
import * as authService from '../services/auth.service.js';

/** Send vault-locked error response */
function sendVaultLockedError(res: ServerResponse): void {
  res.statusCode = 403;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Vault is in lockdown mode. Disable Vault Lockdown in Account Settings to make changes.' }));
}

/** Block write ops for suspended family members */
function sendSuspendedError(res: ServerResponse): void {
  res.statusCode = 403;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Your account is suspended. Contact the account administrator.' }));
}

/**
 * Pin the global storage path cache to the request user's storage path for the
 * duration of a synchronous trash operation, then restore it.
 * All trash.ts functions are synchronous, so this is safe within a single event-loop turn.
 */
function withUserBaseDir<T>(req: IncomingMessage, fn: () => T): T {
  const userPath = (req as any).user?.storagePath as string | undefined;
  if (!userPath || userPath === 'pending') return fn();

  let dir = userPath;
  if (dir.startsWith('~/') || dir === '~') {
    dir = nodePath.join(os.homedir(), dir.slice(dir === '~' ? 1 : 2));
  }
  const prev = (globalThis as any).__arcellite_storage_path;
  (globalThis as any).__arcellite_storage_path = dir;
  try {
    return fn();
  } finally {
    (globalThis as any).__arcellite_storage_path = prev;
  }
}

export function handleTrashRoutes(req: IncomingMessage, res: ServerResponse, url: string) {
  // List trash items
  if (url === '/api/trash/list' && req.method === 'GET') {
    import('../trash.js').then(({ listTrash }) => {
      try {
        const items = withUserBaseDir(req, () => listTrash());
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, items }));
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

  // Serve trash file for preview (thumbnail)
  if (url.startsWith('/api/trash/serve/') && req.method === 'GET') {
    const trashId = decodeURIComponent(url.replace('/api/trash/serve/', ''));
    if (!trashId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing trashId' }));
      return true;
    }
    import('../trash.js').then(({ getTrashDir }) => {
      const trashDir = withUserBaseDir(req, () => getTrashDir());
      const filePath = nodePath.join(trashDir, trashId);
      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }
      const ext = trashId.split('.').pop()?.toLowerCase() || '';
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
        webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', heic: 'image/heic',
        avif: 'image/avif', tiff: 'image/tiff',
        mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
        avi: 'video/x-msvideo', m4v: 'video/mp4',
        mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg',
        pdf: 'application/pdf',
      };
      const contentType = mimeMap[ext] || 'application/octet-stream';
      const stat = fs.statSync(filePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      fs.createReadStream(filePath).pipe(res);
    }).catch((e) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e as Error).message) }));
    });
    return true;
  }

  // Restore from trash
  if (url === '/api/trash/restore' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      import('../trash.js').then(({ restoreFromTrash }) => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const trashId = (body.trashId as string) || '';

          if (!trashId.trim()) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing trashId' }));
            return;
          }

          withUserBaseDir(req, () => restoreFromTrash(trashId.trim()));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
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
    });
    return true;
  }

  // Permanently delete from trash
  if (url === '/api/trash/delete' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      if (await authService.isVaultLocked()) { sendVaultLockedError(res); return; }
      import('../trash.js').then(({ permanentlyDelete }) => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const trashId = (body.trashId as string) || '';

          if (!trashId.trim()) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing trashId' }));
            return;
          }

          withUserBaseDir(req, () => permanentlyDelete(trashId.trim()));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
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
    });
    return true;
  }

  // Empty trash
  if (url === '/api/trash/empty' && req.method === 'POST') {
    authService.isVaultLocked().then(locked => {
      if (locked) { sendVaultLockedError(res); return; }
      import('../trash.js').then(({ emptyTrash }) => {
        try {
          const deletedCount = withUserBaseDir(req, () => emptyTrash());
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, deletedCount }));
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
    }).catch(() => { sendVaultLockedError(res); });
    return true;
  }

  // Move to trash
  if (url === '/api/trash/move-to-trash' && req.method === 'POST') {
    if ((req as any).user?.isSuspended) { sendSuspendedError(res); return true; }
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      if (await authService.isVaultLocked()) { sendVaultLockedError(res); return; }
      import('../trash.js').then(({ moveToTrash }) => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const category = (body.category as string) || 'general';
          const path = (body.path as string) || '';

          if (!path.trim()) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing path' }));
            return;
          }

          let trashId: string | undefined;
          let fileGone = false;
          try {
            trashId = withUserBaseDir(req, () => moveToTrash(category, path.trim()));
          } catch (moveErr: any) {
            const msg = String(moveErr?.message || moveErr || '');
            // If the file simply doesn't exist on disk, still clean up recents
            if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('enoent') || msg.toLowerCase().includes('no such file')) {
              fileGone = true;
            } else {
              throw moveErr;
            }
          }

          // Always clean up from recent files database (whether trashed or already gone)
          import('../services/auth.service.js').then(({ removeRecentFilesUnderPath }) => {
            removeRecentFilesUnderPath(path.trim(), category);
          }).catch(err => console.error('[Trash] Failed to clean recent files:', err));

          if (fileGone) {
            // File was already gone — report success so frontend can clean up
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, alreadyGone: true }));
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, trashId }));
          }
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
    });
    return true;
  }

  return false;
}
