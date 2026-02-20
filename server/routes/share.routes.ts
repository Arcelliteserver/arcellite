/**
 * File Sharing Routes
 * Enables sharing files/folders between family members on the server
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { pool } from '../db/connection.js';
import { createNotification } from '../services/auth.service.js';
import path from 'path';
import fs from 'fs';

// ── Helpers ───────────────────────────────────────────────────────

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, error: string, status = 500) {
  sendJson(res, { error }, status);
}

function getUserId(req: IncomingMessage): number | null {
  return (req as any).user?.id ?? null;
}

/** Extract user ID — also checks ?token= query param for direct browser access (e.g. window.open, img src) */
async function getUserIdWithTokenFallback(req: IncomingMessage): Promise<number | null> {
  // First try normal auth
  const id = getUserId(req);
  if (id) return id;

  // Fallback: check for ?token= query parameter
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');
    if (token) {
      const { validateSession } = await import('../services/auth.service.js');
      const user = await validateSession(token);
      if (user) {
        (req as any).user = user;
        return user.id;
      }
    }
  } catch { /* ignore */ }
  return null;
}

// ── Schema init ──────────────────────────────────────────────────

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shared_files (
        id SERIAL PRIMARY KEY,
        shared_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        shared_with INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        file_name VARCHAR(512) NOT NULL,
        file_type VARCHAR(50),
        category VARCHAR(50),
        size_bytes BIGINT DEFAULT 0,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        kept_at TIMESTAMP,
        UNIQUE(shared_by, shared_with, file_path)
      );
      CREATE INDEX IF NOT EXISTS idx_shared_files_with ON shared_files(shared_with, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_shared_files_by   ON shared_files(shared_by, created_at DESC);
      -- Add kept_at column if missing (existing tables)
      DO $$ BEGIN
        ALTER TABLE shared_files ADD COLUMN IF NOT EXISTS kept_at TIMESTAMP;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    schemaReady = true;
  } catch (e) {
    console.error('[Share] Schema init error:', (e as Error).message);
  }
}

// ── Resolve storage path for a user ─────────────────────────────

async function getUserStoragePath(userId: number): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `SELECT storage_path FROM users WHERE id = $1`,
      [userId],
    );
    if (!rows[0]?.storage_path) return null;
    let p = rows[0].storage_path as string;
    if (p.startsWith('~/') || p === '~') {
      const { homedir } = await import('os');
      p = path.join(homedir(), p === '~' ? '' : p.slice(2));
    }
    return p;
  } catch {
    return null;
  }
}

/** Get list of family members that the current user can share with */
async function getShareableUsers(userId: number): Promise<{ id: number; name: string; avatarUrl: string | null }[]> {
  // Admin can share with all family members; family member can share with admin + other family members
  const { rows } = await pool.query(`
    SELECT u.id, u.first_name, u.last_name, u.avatar_url
    FROM users u
    WHERE u.id != $1
      AND u.is_setup_complete = true
    ORDER BY u.first_name ASC
  `, [userId]);
  return rows.map((r: any) => ({
    id: r.id,
    name: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'User',
    avatarUrl: r.avatar_url,
  }));
}

// ── Route handler ────────────────────────────────────────────────

export function handleShareRoutes(req: IncomingMessage, res: ServerResponse, url: string): boolean {
  if (!url.startsWith('/api/share')) return false;

  // ── GET /api/share/count — get count of files shared with me ──
  if (url === '/api/share/count' && req.method === 'GET') {
    (async () => {
      try {
        const userId = getUserId(req);
        if (!userId) return sendError(res, 'Unauthorized', 401);
        await ensureSchema();
        const { rows } = await pool.query(
          'SELECT COUNT(*) AS cnt FROM shared_files WHERE shared_with = $1',
          [userId],
        );
        sendJson(res, { ok: true, count: parseInt(rows[0].cnt, 10) });
      } catch (e) {
        sendError(res, (e as Error).message);
      }
    })();
    return true;
  }

  // ── GET /api/share/users — people I can share with ──
  if (url === '/api/share/users' && req.method === 'GET') {
    (async () => {
      try {
        const userId = getUserId(req);
        if (!userId) return sendError(res, 'Unauthorized', 401);
        const users = await getShareableUsers(userId);
        sendJson(res, { ok: true, users });
      } catch (e) {
        sendError(res, (e as Error).message);
      }
    })();
    return true;
  }

  // ── POST /api/share — share a file with another user ──
  if (url === '/api/share' && req.method === 'POST') {
    parseBody(req).then(async (body) => {
      try {
        const userId = getUserId(req);
        if (!userId) return sendError(res, 'Unauthorized', 401);
        await ensureSchema();

        const { sharedWith, filePath, fileName, fileType, category, sizeBytes, message } = body;
        if (!sharedWith || !filePath || !fileName) {
          return sendError(res, 'sharedWith, filePath, and fileName are required', 400);
        }

        // Verify the target user exists
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [sharedWith]);
        if (userCheck.rows.length === 0) return sendError(res, 'Target user not found', 404);

        // SEC-PT: Reject paths that could escape the storage directory
        if (typeof filePath !== 'string' || filePath.includes('..') || path.isAbsolute(filePath)) {
          return sendError(res, 'Invalid file path', 400);
        }

        // Verify the file exists on disk (and that resolved path stays within storage)
        const storagePath = await getUserStoragePath(userId);
        if (storagePath) {
          const fullPath = path.join(storagePath, filePath);
          const resolvedFull = path.resolve(fullPath);
          const resolvedBase = path.resolve(storagePath);
          if (resolvedFull !== resolvedBase && !resolvedFull.startsWith(resolvedBase + path.sep)) {
            return sendError(res, 'Invalid file path', 400);
          }
          if (!fs.existsSync(fullPath)) {
            return sendError(res, 'File not found on disk', 404);
          }
        }

        // Insert the share record
        const { rows } = await pool.query(`
          INSERT INTO shared_files (shared_by, shared_with, file_path, file_name, file_type, category, size_bytes, message)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (shared_by, shared_with, file_path) DO UPDATE SET
            file_name = EXCLUDED.file_name,
            file_type = EXCLUDED.file_type,
            size_bytes = EXCLUDED.size_bytes,
            message = EXCLUDED.message,
            created_at = CURRENT_TIMESTAMP
          RETURNING id, created_at
        `, [userId, sharedWith, filePath, fileName, fileType || null, category || null, sizeBytes || 0, message || null]);

        // Send notification to the recipient
        try {
          const senderInfo = await pool.query(
            'SELECT first_name, last_name FROM users WHERE id = $1',
            [userId],
          );
          const senderName = senderInfo.rows[0]
            ? [senderInfo.rows[0].first_name, senderInfo.rows[0].last_name].filter(Boolean).join(' ') || 'Someone'
            : 'Someone';
          await createNotification(
            sharedWith,
            'File Shared With You',
            `${senderName} shared "${fileName}" with you`,
            'info',
            'system',
          );
        } catch (notifErr) {
          console.error('[Share] Notification error:', (notifErr as Error).message);
        }

        sendJson(res, { ok: true, shareId: rows[0].id });
      } catch (e) {
        sendError(res, (e as Error).message);
      }
    }).catch(e => sendError(res, e.message));
    return true;
  }

  // ── GET /api/share/list — get all shares (sent + received) ──
  if (url === '/api/share/list' && req.method === 'GET') {
    (async () => {
      try {
        const userId = getUserId(req);
        if (!userId) return sendError(res, 'Unauthorized', 401);
        await ensureSchema();

        // Files shared WITH me (received)
        const received = await pool.query(`
          SELECT sf.*, u.first_name AS sender_first_name, u.last_name AS sender_last_name, u.avatar_url AS sender_avatar
          FROM shared_files sf
          JOIN users u ON u.id = sf.shared_by
          WHERE sf.shared_with = $1
          ORDER BY sf.created_at DESC
        `, [userId]);

        // Files I shared with others (sent)
        const sent = await pool.query(`
          SELECT sf.*, u.first_name AS recipient_first_name, u.last_name AS recipient_last_name, u.avatar_url AS recipient_avatar
          FROM shared_files sf
          JOIN users u ON u.id = sf.shared_with
          WHERE sf.shared_by = $1
          ORDER BY sf.created_at DESC
        `, [userId]);

        sendJson(res, {
          ok: true,
          received: received.rows.map(r => ({
            id: r.id,
            filePath: r.file_path,
            fileName: r.file_name,
            fileType: r.file_type,
            category: r.category,
            sizeBytes: Number(r.size_bytes),
            message: r.message,
            sharedAt: r.created_at,
            keptAt: r.kept_at || null,
            sender: {
              id: r.shared_by,
              name: [r.sender_first_name, r.sender_last_name].filter(Boolean).join(' ') || 'User',
              avatarUrl: r.sender_avatar,
            },
          })),
          sent: sent.rows.map(r => ({
            id: r.id,
            filePath: r.file_path,
            fileName: r.file_name,
            fileType: r.file_type,
            category: r.category,
            sizeBytes: Number(r.size_bytes),
            message: r.message,
            sharedAt: r.created_at,
            recipient: {
              id: r.shared_with,
              name: [r.recipient_first_name, r.recipient_last_name].filter(Boolean).join(' ') || 'User',
              avatarUrl: r.recipient_avatar,
            },
          })),
        });
      } catch (e) {
        sendError(res, (e as Error).message);
      }
    })();
    return true;
  }

  // ── DELETE /api/share/:id — remove a share ──
  if (url.match(/^\/api\/share\/\d+$/) && req.method === 'DELETE') {
    (async () => {
      try {
        const userId = getUserId(req);
        if (!userId) return sendError(res, 'Unauthorized', 401);
        await ensureSchema();

        const shareId = parseInt(url.split('/').pop()!, 10);

        // Only the person who shared or the recipient can remove
        const result = await pool.query(
          'DELETE FROM shared_files WHERE id = $1 AND (shared_by = $2 OR shared_with = $2) RETURNING id',
          [shareId, userId],
        );

        if (result.rows.length === 0) {
          return sendError(res, 'Share not found or not authorized', 404);
        }

        sendJson(res, { ok: true });
      } catch (e) {
        sendError(res, (e as Error).message);
      }
    })();
    return true;
  }

  // ── POST /api/share/keep/:id — copy shared file to recipient's own storage ──
  if (url.match(/^\/api\/share\/keep\/\d+$/) && req.method === 'POST') {
    (async () => {
      try {
        const userId = getUserId(req);
        if (!userId) return sendError(res, 'Unauthorized', 401);
        await ensureSchema();

        const shareId = parseInt(url.split('/').pop()!, 10);

        // Fetch the share — must be shared WITH current user
        const { rows } = await pool.query(
          'SELECT * FROM shared_files WHERE id = $1 AND shared_with = $2',
          [shareId, userId],
        );
        if (rows.length === 0) return sendError(res, 'Not found or not authorized', 404);

        const share = rows[0];

        // Prevent duplicate keeps
        if (share.kept_at) {
          return sendError(res, 'File already kept', 409);
        }

        const ownerStorage = await getUserStoragePath(share.shared_by);
        if (!ownerStorage) return sendError(res, 'Owner storage not found', 500);

        const srcPath = path.join(ownerStorage, share.file_path);
        if (!fs.existsSync(srcPath)) return sendError(res, 'File no longer exists on sender\'s storage', 404);

        // Determine destination category folder based on file type
        const ext = path.extname(share.file_name).toLowerCase();
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.heic'];
        const videoExts = ['.mp4', '.mkv', '.avi', '.webm', '.mov'];
        const audioExts = ['.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a'];

        let destFolder = 'files';          // general
        if (imageExts.includes(ext)) destFolder = 'photos';        // media
        else if (videoExts.includes(ext)) destFolder = 'videos';   // video_vault
        else if (audioExts.includes(ext)) destFolder = 'music';    // music

        const recipientStorage = await getUserStoragePath(userId);
        if (!recipientStorage) return sendError(res, 'Your storage path not found', 500);

        const destDir = path.join(recipientStorage, destFolder);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        // Avoid overwriting — add (1), (2), etc. if file exists
        let destName = share.file_name as string;
        let destPath = path.join(destDir, destName);
        let counter = 1;
        const baseName = path.basename(destName, ext);
        while (fs.existsSync(destPath)) {
          destName = `${baseName} (${counter})${ext}`;
          destPath = path.join(destDir, destName);
          counter++;
        }

        // Copy the file
        fs.copyFileSync(srcPath, destPath);

        // Mark as kept
        await pool.query('UPDATE shared_files SET kept_at = NOW() WHERE id = $1', [shareId]);

        sendJson(res, { ok: true, destFolder, destName });
      } catch (e) {
        sendError(res, (e as Error).message);
      }
    })();
    return true;
  }

  // ── GET /api/share/download/:id — serve a shared file ──
  if (url.match(/^\/api\/share\/download\/\d+/) && req.method === 'GET') {
    (async () => {
      try {
        const userId = await getUserIdWithTokenFallback(req);
        if (!userId) return sendError(res, 'Unauthorized', 401);
        await ensureSchema();

        const idMatch = url.match(/\/api\/share\/download\/(\d+)/);
        const shareId = idMatch ? parseInt(idMatch[1], 10) : NaN;
        if (isNaN(shareId)) return sendError(res, 'Invalid share ID', 400);

        // Fetch the share — must be sent to or by current user
        const { rows } = await pool.query(
          'SELECT * FROM shared_files WHERE id = $1 AND (shared_by = $2 OR shared_with = $2)',
          [shareId, userId],
        );
        if (rows.length === 0) return sendError(res, 'Not found or not authorized', 404);

        const share = rows[0];
        // Resolve actual path from the sharer's storage
        const ownerStorage = await getUserStoragePath(share.shared_by);
        if (!ownerStorage) return sendError(res, 'Owner storage not found', 500);

        const fullPath = path.join(ownerStorage, share.file_path);
        // SEC-PT-003: Validate resolved path stays within owner's storage
        const resolvedFull = path.resolve(fullPath);
        const resolvedOwner = path.resolve(ownerStorage);
        if (!resolvedFull.startsWith(resolvedOwner + path.sep) && resolvedFull !== resolvedOwner) {
          return sendError(res, 'Invalid file path', 403);
        }
        if (!fs.existsSync(fullPath)) return sendError(res, 'File no longer exists', 404);

        const stat = fs.statSync(fullPath);
        const ext = path.extname(share.file_name).toLowerCase();

        // Determine MIME type
        const mimeMap: Record<string, string> = {
          '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
          '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
          '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
          '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav',
          '.pdf': 'application/pdf', '.txt': 'text/plain',
          '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.zip': 'application/zip', '.rar': 'application/x-rar-compressed',
        };
        const contentType = mimeMap[ext] || 'application/octet-stream';

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(share.file_name)}"`);

        const stream = fs.createReadStream(fullPath);
        stream.pipe(res);
        stream.on('error', () => {
          if (!res.headersSent) sendError(res, 'Error reading file');
        });
      } catch (e) {
        sendError(res, (e as Error).message);
      }
    })();
    return true;
  }

  return false;
}
