import type { IncomingMessage, ServerResponse } from 'http';
import * as authService from '../services/auth.service.js';

/** Send vault-locked error response */
function sendVaultLockedError(res: ServerResponse): void {
  res.statusCode = 403;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Vault is in lockdown mode. Disable Vault Lockdown in Account Settings to make changes.' }));
}

export function handleTrashRoutes(req: IncomingMessage, res: ServerResponse, url: string) {
  // List trash items
  if (url === '/api/trash/list' && req.method === 'GET') {
    import('../trash.js').then(({ listTrash }) => {
      try {
        const items = listTrash();
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

          restoreFromTrash(trashId.trim());
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

          permanentlyDelete(trashId.trim());
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
          const deletedCount = emptyTrash();
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

          const trashId = moveToTrash(category, path.trim());
          // Clean up from recent files database
          import('../services/auth.service.js').then(({ removeRecentFile, removeRecentFilesUnderPath }) => {
            // Remove exact path and any children (if it's a folder)
            removeRecentFilesUnderPath(path.trim(), category);
          }).catch(err => console.error('[Trash] Failed to clean recent files:', err));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, trashId }));
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
