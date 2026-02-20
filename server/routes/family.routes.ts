/**
 * Family Sharing Routes
 * REST endpoints for managing family member sub-accounts
 */

import type { IncomingMessage, ServerResponse } from 'http';
import * as familyService from '../services/family.service.js';
import { sendFamilyInviteEmail } from '../services/email.service.js';
import { pool as dbPool } from '../db/connection.js';

/** Parse JSON body */
async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

/** Send JSON */
function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/** Get authenticated user id from request (set by auth middleware) */
function getUserId(req: IncomingMessage): number | null {
  return (req as any).user?.id ?? null;
}

/** Format bytes for error messages */
function formatBytesRoute(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** Get owner display name */
async function getOwnerName(userId: number): Promise<string> {
  try {
    const { rows } = await dbPool.query(
      `SELECT first_name, last_name, email FROM users WHERE id = $1`,
      [userId],
    );
    if (rows.length && (rows[0].first_name || rows[0].last_name)) {
      return [rows[0].first_name, rows[0].last_name].filter(Boolean).join(' ');
    }
    return rows[0]?.email?.split('@')[0] || 'Arcellite User';
  } catch {
    return 'Arcellite User';
  }
}

export function handleFamilyRoutes(req: IncomingMessage, res: ServerResponse, url: string): boolean {
  if (!url.startsWith('/api/family')) return false;

  const userId = getUserId(req);
  if (!userId) {
    sendJson(res, 401, { error: 'Not authenticated' });
    return true;
  }

  // GET /api/family/members — list all members
  if (url === '/api/family/members' && req.method === 'GET') {
    familyService.listMembers(userId)
      .then(members => sendJson(res, 200, { ok: true, members }))
      .catch(e => sendJson(res, 500, { error: (e as Error).message }));
    return true;
  }

  // GET /api/family/stats — summary stats
  if (url === '/api/family/stats' && req.method === 'GET') {
    familyService.getFamilyStats(userId)
      .then(stats => sendJson(res, 200, { ok: true, ...stats }))
      .catch(e => sendJson(res, 500, { error: (e as Error).message }));
    return true;
  }

  // GET /api/family/pool — get storage pool settings
  if (url === '/api/family/pool' && req.method === 'GET') {
    familyService.getPoolSettings(userId)
      .then(pool => sendJson(res, 200, pool))
      .catch(e => sendJson(res, 500, { error: (e as Error).message }));
    return true;
  }

  // PUT /api/family/pool — update storage pool size
  if (url === '/api/family/pool' && req.method === 'PUT') {
    parseBody(req).then(async body => {
      const { poolSize } = body;
      if (poolSize === undefined || typeof poolSize !== 'number' || poolSize < 0) {
        return sendJson(res, 400, { error: 'poolSize must be a non-negative number' });
      }
      try {
        const updated = await familyService.setPoolSettings(userId, poolSize);
        sendJson(res, 200, updated);
      } catch (e) {
        sendJson(res, 400, { error: (e as Error).message });
      }
    }).catch(e => sendJson(res, 400, { error: (e as Error).message }));
    return true;
  }

  // POST /api/family/invite — invite new member
  if (url === '/api/family/invite' && req.method === 'POST') {
    parseBody(req).then(async body => {
      const { name, email, role, storageQuota, notes } = body;
      if (!name?.trim() || !email?.trim()) {
        return sendJson(res, 400, { error: 'Name and email are required' });
      }
      try {
        // Validate pool quota if pool is configured
        if (storageQuota) {
          const poolCheck = await familyService.validatePoolQuota(userId, storageQuota);
          if (!poolCheck.ok) {
            return sendJson(res, 400, { error: `Exceeds available pool. Only ${formatBytesRoute(poolCheck.available)} remaining in the shareable pool.` });
          }
        }
        const member = await familyService.inviteMember(userId, { name, email, role, storageQuota, notes });
        // Send invite email (non-blocking — don't fail the invite if email fails)
        const ownerName = await getOwnerName(userId);
        sendFamilyInviteEmail({
          toEmail: email,
          memberName: name,
          role: member.role,
          storageQuota: member.storageQuota,
          inviteToken: member.inviteToken || '',
          ownerName,
          notes: notes || undefined,
        }).catch(() => {});
        sendJson(res, 201, { ok: true, member });
      } catch (e: any) {
        if (e.code === '23505') {
          sendJson(res, 409, { error: 'A member with this email already exists' });
        } else {
          sendJson(res, 500, { error: e.message });
        }
      }
    }).catch(e => sendJson(res, 400, { error: (e as Error).message }));
    return true;
  }

  // PUT /api/family/members/:id — update member
  const putMatch = url.match(/^\/api\/family\/members\/(\d+)$/) ;
  if (putMatch && req.method === 'PUT') {
    const memberId = parseInt(putMatch[1], 10);
    parseBody(req).then(async body => {
      try {
        // Validate pool quota if storageQuota is being changed and pool is configured
        if (body.storageQuota !== undefined) {
          const poolCheck = await familyService.validatePoolQuota(userId, body.storageQuota, memberId);
          if (!poolCheck.ok) {
            return sendJson(res, 400, { error: `Exceeds available pool. Only ${formatBytesRoute(poolCheck.available)} remaining in the shareable pool.` });
          }
        }
        const updated = await familyService.updateMember(userId, memberId, body);
        if (!updated) return sendJson(res, 404, { error: 'Member not found' });
        sendJson(res, 200, { ok: true, member: updated });
      } catch (e) {
        sendJson(res, 500, { error: (e as Error).message });
      }
    }).catch(e => sendJson(res, 400, { error: (e as Error).message }));
    return true;
  }

  // DELETE /api/family/members/:id — remove member
  const delMatch = url.match(/^\/api\/family\/members\/(\d+)$/);
  if (delMatch && req.method === 'DELETE') {
    const memberId = parseInt(delMatch[1], 10);
    familyService.removeMember(userId, memberId)
      .then(ok => ok ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'Member not found' }))
      .catch(e => sendJson(res, 500, { error: (e as Error).message }));
    return true;
  }

  // POST /api/family/resend-invite/:id — resend invitation
  const resendMatch = url.match(/^\/api\/family\/resend-invite\/(\d+)$/);
  if (resendMatch && req.method === 'POST') {
    const memberId = parseInt(resendMatch[1], 10);
    familyService.resendInvite(userId, memberId)
      .then(async token => {
        if (!token) return sendJson(res, 404, { error: 'Member not found' });
        // Get member details for the email
        try {
          const member = await familyService.getMember(userId, memberId);
          if (member) {
            const ownerName = await getOwnerName(userId);
            sendFamilyInviteEmail({
              toEmail: member.email,
              memberName: member.name,
              role: member.role,
              storageQuota: member.storageQuota,
              inviteToken: token,
              ownerName,
              notes: member.notes || undefined,
            }).catch(() => {});
          }
        } catch {
          // silently ignore email errors
        }
        sendJson(res, 200, { ok: true });
      })
      .catch(e => sendJson(res, 500, { error: (e as Error).message }));
    return true;
  }

  return false;
}
