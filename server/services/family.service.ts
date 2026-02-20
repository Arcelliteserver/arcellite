/**
 * Family Sharing Service
 * Manages family member sub-accounts for shared server/storage access
 */

import { pool } from '../db/connection.js';
import crypto from 'crypto';
import { getRootStorage } from '../storage.js';

export interface FamilyMember {
  id: number;
  ownerId: number;
  name: string;
  email: string;
  role: 'viewer' | 'editor' | 'admin';
  storageQuota: number;
  storageUsed: number;
  status: 'pending' | 'active' | 'disabled';
  inviteToken: string | null;
  userId: number | null;
  avatarUrl: string | null;
  notes: string | null;
  lastActive: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToMember(row: any): FamilyMember {
  // Prefer linked user's live profile data over stale family_members snapshot
  const liveAvatar = row.user_avatar_url ?? null;
  const liveName = row.user_display_name ?? null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: liveName || row.name,
    email: row.email,
    role: row.role,
    storageQuota: Number(row.storage_quota),
    storageUsed: Number(row.storage_used),
    status: row.status,
    inviteToken: row.invite_token,
    userId: row.user_id ?? null,
    avatarUrl: liveAvatar || row.avatar_url,
    notes: row.notes,
    lastActive: row.last_active?.toISOString() ?? null,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
}

/** List all family members for an owner */
export async function listMembers(ownerId: number): Promise<FamilyMember[]> {
  const { rows } = await pool.query(
    `SELECT fm.*,
            u.avatar_url  AS user_avatar_url,
            NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS user_display_name
     FROM family_members fm
     LEFT JOIN users u ON u.id = fm.user_id
     WHERE fm.owner_id = $1
     ORDER BY fm.created_at DESC`,
    [ownerId],
  );
  return rows.map(rowToMember);
}

/** Get a single member by ID (must belong to owner) */
export async function getMember(ownerId: number, memberId: number): Promise<FamilyMember | null> {
  const { rows } = await pool.query(
    `SELECT fm.*,
            u.avatar_url  AS user_avatar_url,
            NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS user_display_name
     FROM family_members fm
     LEFT JOIN users u ON u.id = fm.user_id
     WHERE fm.id = $1 AND fm.owner_id = $2`,
    [memberId, ownerId],
  );
  return rows.length ? rowToMember(rows[0]) : null;
}

/** Invite / add a new family member */
export async function inviteMember(
  ownerId: number,
  data: { name: string; email: string; role?: string; storageQuota?: number; notes?: string },
): Promise<FamilyMember> {
  const inviteToken = crypto.randomBytes(32).toString('hex');
  const role = data.role || 'viewer';
  const quota = data.storageQuota ?? 5368709120; // 5 GB
  const { rows } = await pool.query(
    `INSERT INTO family_members (owner_id, name, email, role, storage_quota, invite_token, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [ownerId, data.name, data.email, role, quota, inviteToken, data.notes ?? null],
  );
  return rowToMember(rows[0]);
}

/** Update member details (role, quota, status, notes) */
export async function updateMember(
  ownerId: number,
  memberId: number,
  updates: { name?: string; role?: string; storageQuota?: number; status?: string; notes?: string },
): Promise<FamilyMember | null> {
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (updates.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(updates.name); }
  if (updates.role !== undefined) { sets.push(`role = $${idx++}`); vals.push(updates.role); }
  if (updates.storageQuota !== undefined) { sets.push(`storage_quota = $${idx++}`); vals.push(updates.storageQuota); }
  if (updates.status !== undefined) { sets.push(`status = $${idx++}`); vals.push(updates.status); }
  if (updates.notes !== undefined) { sets.push(`notes = $${idx++}`); vals.push(updates.notes); }

  if (sets.length === 0) return getMember(ownerId, memberId);

  sets.push(`updated_at = NOW()`);
  vals.push(memberId, ownerId);

  const { rows } = await pool.query(
    `UPDATE family_members SET ${sets.join(', ')} WHERE id = $${idx++} AND owner_id = $${idx} RETURNING *`,
    vals,
  );
  return rows.length ? rowToMember(rows[0]) : null;
}

/** Remove a family member */
export async function removeMember(ownerId: number, memberId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM family_members WHERE id = $1 AND owner_id = $2',
    [memberId, ownerId],
  );
  return (rowCount ?? 0) > 0;
}

/** Get summary stats for the owner */
export async function getFamilyStats(ownerId: number) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total_members,
       COUNT(*) FILTER (WHERE status = 'active')::int AS active_members,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_members,
       COALESCE(SUM(storage_used), 0)::bigint AS total_storage_used,
       COALESCE(SUM(storage_quota), 0)::bigint AS total_storage_allocated
     FROM family_members WHERE owner_id = $1`,
    [ownerId],
  );
  const r = rows[0];
  return {
    totalMembers: r.total_members,
    activeMembers: r.active_members,
    pendingMembers: r.pending_members,
    totalStorageUsed: Number(r.total_storage_used),
    totalStorageAllocated: Number(r.total_storage_allocated),
  };
}

/** Resend invitation (regenerate token) */
export async function resendInvite(ownerId: number, memberId: number): Promise<string | null> {
  const newToken = crypto.randomBytes(32).toString('hex');
  const { rowCount } = await pool.query(
    `UPDATE family_members SET invite_token = $1, status = 'pending', updated_at = NOW()
     WHERE id = $2 AND owner_id = $3`,
    [newToken, memberId, ownerId],
  );
  return (rowCount ?? 0) > 0 ? newToken : null;
}

/* ═══════════════════════════════════════════════════
   Storage Pool Management
   ═══════════════════════════════════════════════════ */

export interface PoolInfo {
  poolSize: number;      // Total shareable pool in bytes (0 = not configured)
  allocated: number;     // Sum of all member storage_quota
  available: number;     // poolSize - allocated
  diskTotal: number;     // Total disk space in bytes
  diskUsed: number;      // Disk used bytes
  diskAvailable: number; // Disk available bytes
}

/** Get the configured shareable storage pool size from user_settings */
export async function getPoolSettings(ownerId: number): Promise<PoolInfo> {
  // Get pool size from preferences
  await pool.query(
    `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [ownerId],
  );
  const { rows } = await pool.query(
    `SELECT preferences FROM user_settings WHERE user_id = $1`,
    [ownerId],
  );
  const prefs = rows[0]?.preferences || {};
  const poolSize: number = prefs.familySharingPool ?? 0;

  // Get total allocated across all members
  const statsRes = await pool.query(
    `SELECT COALESCE(SUM(storage_quota), 0)::bigint AS allocated FROM family_members WHERE owner_id = $1`,
    [ownerId],
  );
  const allocated = Number(statsRes.rows[0].allocated);

  // Get disk info
  const disk = getRootStorage();
  const diskTotal = disk?.totalBytes ?? 0;
  const diskUsed = disk?.usedBytes ?? 0;
  const diskAvailable = disk?.availableBytes ?? 0;

  return {
    poolSize,
    allocated,
    available: Math.max(poolSize - allocated, 0),
    diskTotal,
    diskUsed,
    diskAvailable,
  };
}

/** Set the shareable storage pool size */
export async function setPoolSettings(ownerId: number, poolSize: number): Promise<PoolInfo> {
  // Validate: pool can't exceed available disk space
  const disk = getRootStorage();
  const diskAvailable = disk?.availableBytes ?? 0;
  if (poolSize > diskAvailable && diskAvailable > 0) {
    throw new Error(`Pool size cannot exceed available disk space (${formatBytesServer(diskAvailable)})`);
  }

  // Validate: pool can't be less than what's already allocated
  const statsRes = await pool.query(
    `SELECT COALESCE(SUM(storage_quota), 0)::bigint AS allocated FROM family_members WHERE owner_id = $1`,
    [ownerId],
  );
  const allocated = Number(statsRes.rows[0].allocated);
  if (poolSize > 0 && poolSize < allocated) {
    throw new Error(`Pool size cannot be less than already allocated (${formatBytesServer(allocated)})`);
  }

  // Store in preferences
  await pool.query(
    `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [ownerId],
  );
  const current = await pool.query(
    `SELECT preferences FROM user_settings WHERE user_id = $1`,
    [ownerId],
  );
  const prefs = current.rows[0]?.preferences || {};
  prefs.familySharingPool = poolSize;
  await pool.query(
    `UPDATE user_settings SET preferences = $1, updated_at = NOW() WHERE user_id = $2`,
    [JSON.stringify(prefs), ownerId],
  );

  return getPoolSettings(ownerId);
}

/** Validate that a quota fits within the available pool (for invite/update) */
export async function validatePoolQuota(
  ownerId: number,
  requestedQuota: number,
  excludeMemberId?: number,
): Promise<{ ok: boolean; available: number; poolSize: number }> {
  const info = await getPoolSettings(ownerId);
  if (info.poolSize === 0) return { ok: true, available: 0, poolSize: 0 }; // No pool configured, allow anything

  // Exclude current member's quota if updating
  let currentQuota = 0;
  if (excludeMemberId) {
    const memberRes = await pool.query(
      `SELECT storage_quota FROM family_members WHERE id = $1 AND owner_id = $2`,
      [excludeMemberId, ownerId],
    );
    currentQuota = Number(memberRes.rows[0]?.storage_quota ?? 0);
  }

  const effectiveAvailable = info.available + currentQuota;
  return {
    ok: requestedQuota <= effectiveAvailable,
    available: effectiveAvailable,
    poolSize: info.poolSize,
  };
}

function formatBytesServer(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
