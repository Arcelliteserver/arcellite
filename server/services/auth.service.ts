/**
 * Authentication Service
 * Handles user authentication, session management, and profile operations
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../db/connection.js';

const SALT_ROUNDS = 12;
const SESSION_DURATION_DAYS = 14; // Reduced from 30 for tighter session security
const MAX_DEVICES = 4;

export interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  storagePath: string;
  isSetupComplete: boolean;
  emailVerified: boolean;
  isFamilyMember: boolean;
  isSuspended: boolean;
  createdAt: Date;
}

export interface Session {
  id: number;
  userId: number;
  sessionToken: string;
  expiresAt: Date;
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate random session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate random verification code (6 digits)
 */
export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Create new user (signup)
 */
export async function createUser(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<User> {
  const passwordHash = await hashPassword(password);

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, first_name, last_name, avatar_url, storage_path,
               is_setup_complete, email_verified, created_at`,
    [email, passwordHash, firstName || null, lastName || null]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    storagePath: row.storage_path,
    isSetupComplete: row.is_setup_complete,
    emailVerified: row.email_verified,
    isFamilyMember: false,
    isSuspended: false,
    createdAt: row.created_at,
  };
}

/**
 * Authenticate user (login)
 */
export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const result = await pool.query(
    `SELECT id, email, password_hash, first_name, last_name, avatar_url,
            storage_path, is_setup_complete, email_verified, created_at
     FROM users WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const isValid = await verifyPassword(password, row.password_hash);

  if (!isValid) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    storagePath: row.storage_path,
    isSetupComplete: row.is_setup_complete,
    emailVerified: row.email_verified,
    isFamilyMember: !!row.is_family_member,
    isSuspended: false,
    createdAt: row.created_at,
  };
}

/**
 * Parse user-agent to determine device name and type
 */
function parseDevice(userAgent?: string): { deviceName: string; deviceType: string } {
  if (!userAgent) return { deviceName: 'Unknown Device', deviceType: 'unknown' };
  const ua = userAgent.toLowerCase();

  // Detect device type
  let deviceType = 'desktop';
  if (/iphone|android.*mobile|windows phone/i.test(ua)) deviceType = 'mobile';
  else if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) deviceType = 'tablet';

  // Detect browser/OS for device name
  let browser = 'Browser';
  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome') && !ua.includes('edg/')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';

  let os = '';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('iphone')) os = 'iPhone';
  else if (ua.includes('ipad')) os = 'iPad';
  else if (ua.includes('android')) os = 'Android';

  const deviceName = os ? `${browser} on ${os}` : browser;
  return { deviceName, deviceType };
}

/**
 * Parse user-agent into a human-readable device string (for notifications)
 */
export function parseDeviceForNotification(userAgent?: string): string {
  const { deviceName } = parseDevice(userAgent);
  return deviceName;
}

/**
 * Create session for user with device tracking
 */
export async function createSession(
  userId: number,
  options?: { userAgent?: string; ipAddress?: string; isCurrentHost?: boolean }
): Promise<Session> {
  // Enforce max device limit — remove oldest session if at limit
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM sessions WHERE user_id = $1 AND expires_at > NOW()`,
    [userId]
  );
  const activeCount = parseInt(countResult.rows[0].count);
  if (activeCount >= MAX_DEVICES) {
    // Delete the oldest session(s) to make room
    await pool.query(
      `DELETE FROM sessions WHERE id IN (
        SELECT id FROM sessions WHERE user_id = $1 AND expires_at > NOW()
        ORDER BY last_activity ASC
        LIMIT $2
      )`,
      [userId, activeCount - MAX_DEVICES + 1]
    );
  }

  const sessionToken = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  // SEC-SESSION: Clamp User-Agent to 500 chars to prevent oversized DB entries
  const safeUserAgent = (options?.userAgent || '').substring(0, 500) || null;
  const { deviceName, deviceType } = parseDevice(safeUserAgent || undefined);

  const result = await pool.query(
    `INSERT INTO sessions (user_id, session_token, device_name, device_type, ip_address, user_agent, is_current_host, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, user_id, session_token, expires_at`,
    [userId, sessionToken, deviceName, deviceType, options?.ipAddress || null, safeUserAgent, options?.isCurrentHost || false, expiresAt]
  );

  // Login Alerts: notify user about new login if enabled (autoMirroring setting)
  try {
    const settingsRow = await pool.query(
      `SELECT preferences FROM user_settings WHERE user_id = $1`,
      [userId]
    );
    const prefs = settingsRow.rows[0]?.preferences || {};
    const loginAlertsEnabled = prefs.autoMirroring ?? true;
    if (loginAlertsEnabled) {
      const ipInfo = options?.ipAddress ? ` from ${options.ipAddress}` : '';
      await createNotification(
        userId,
        'New Login Detected',
        `New session started on ${deviceName}${ipInfo}`,
        'info',
        'security'
      );
    }
  } catch { /* Login alert should never break session creation */ }

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    sessionToken: row.session_token,
    expiresAt: row.expires_at,
  };
}

/**
 * Validate session token and return user
 */
export async function validateSession(sessionToken: string): Promise<User | null> {
  const result = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url,
            u.storage_path, u.is_setup_complete, u.email_verified, u.created_at,
            fm.id AS fm_id, fm.status AS fm_status
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     LEFT JOIN family_members fm ON fm.user_id = u.id
     WHERE s.session_token = $1 AND s.expires_at > NOW()`,
    [sessionToken]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Update last activity
  await pool.query(
    `UPDATE sessions SET last_activity = NOW() WHERE session_token = $1`,
    [sessionToken]
  );

  const row = result.rows[0];
  const isFamilyMember = row.fm_id != null;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    storagePath: row.storage_path,
    isSetupComplete: row.is_setup_complete,
    emailVerified: row.email_verified,
    isFamilyMember,
    isSuspended: isFamilyMember && row.fm_status === 'disabled',
    createdAt: row.created_at,
  };
}

/**
 * Destroy session (logout)
 */
export async function destroySession(sessionToken: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE session_token = $1`, [sessionToken]);
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: number,
  updates: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
    storagePath?: string;
  }
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (updates.firstName !== undefined) {
    fields.push(`first_name = $${paramCount++}`);
    values.push(updates.firstName);
  }
  if (updates.lastName !== undefined) {
    fields.push(`last_name = $${paramCount++}`);
    values.push(updates.lastName);
  }
  if (updates.avatarUrl !== undefined) {
    fields.push(`avatar_url = $${paramCount++}`);
    values.push(updates.avatarUrl || null);
  }
  if (updates.storagePath !== undefined) {
    fields.push(`storage_path = $${paramCount++}`);
    values.push(updates.storagePath);
  }

  if (fields.length === 0) return;

  values.push(userId);
  await pool.query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramCount}`,
    values
  );
}

/**
 * Change a user's password — verifies the current password before updating.
 * Returns true on success, false if the current password is wrong.
 */
export async function changeUserPassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT password_hash FROM users WHERE id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return false;
  const isValid = await verifyPassword(currentPassword, result.rows[0].password_hash);
  if (!isValid) return false;
  const newHash = await hashPassword(newPassword);
  await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [newHash, userId]
  );
  return true;
}

/**
 * Mark setup as complete
 */
export async function markSetupComplete(userId: number): Promise<void> {
  await pool.query(
    `UPDATE users SET is_setup_complete = TRUE, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
}

/**
 * Set verification code for email verification
 */
export async function setVerificationCode(userId: number, code: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 min expiry

  await pool.query(
    `UPDATE users SET verification_code = $1, verification_expires = $2 WHERE id = $3`,
    [code, expiresAt, userId]
  );
}

/**
 * Verify email with code
 */
export async function verifyEmailCode(userId: number, code: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT verification_code, verification_expires FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return false;

  const row = result.rows[0];
  if (!row.verification_code || !row.verification_expires) return false;
  if (new Date() > new Date(row.verification_expires)) return false;
  if (!crypto.timingSafeEqual(Buffer.from(row.verification_code), Buffer.from(code))) return false;

  // Mark as verified
  await pool.query(
    `UPDATE users
     SET email_verified = TRUE, verification_code = NULL, verification_expires = NULL
     WHERE id = $1`,
    [userId]
  );

  return true;
}

/**
 * Log user activity
 */
export async function logActivity(
  userId: number,
  action: string,
  details?: string,
  ipAddress?: string
): Promise<void> {
  await pool.query(
    `INSERT INTO activity_log (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [userId, action, details || null, ipAddress || null]
  );
}

/**
 * Get activity log for user
 */
export async function getActivityLog(userId: number, limit: number = 50): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, action, details, ip_address, created_at
     FROM activity_log
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    action: row.action,
    details: row.details,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  }));
}

/**
 * Track a recent file access (upsert)
 */
export async function trackRecentFile(
  userId: number,
  filePath: string,
  fileName: string,
  fileType: string | null,
  category: string | null,
  sizeBytes: number | null
): Promise<void> {
  await pool.query(
    `INSERT INTO recent_files (user_id, file_path, file_name, file_type, category, size_bytes, accessed_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id, file_path)
     DO UPDATE SET file_name = $3, file_type = $4, category = $5, size_bytes = $6, accessed_at = NOW()`,
    [userId, filePath, fileName, fileType || null, category || null, sizeBytes || null]
  );
}

/**
 * Remove a file from recent files (when file is deleted/trashed)
 */
export async function removeRecentFile(filePath: string, category?: string): Promise<void> {
  try {
    if (category) {
      await pool.query(
        `DELETE FROM recent_files WHERE file_path = $1 AND category = $2`,
        [filePath, category]
      );
    } else {
      await pool.query(
        `DELETE FROM recent_files WHERE file_path = $1`,
        [filePath]
      );
    }
  } catch (err) {
    console.error('[Auth] Failed to remove recent file:', err);
  }
}

/**
 * Remove all recent files under a folder path (when folder is deleted/trashed)
 */
export async function removeRecentFilesUnderPath(pathPrefix: string, category?: string): Promise<void> {
  try {
    if (category) {
      await pool.query(
        `DELETE FROM recent_files WHERE (file_path = $1 OR file_path LIKE $2) AND category = $3`,
        [pathPrefix, `${pathPrefix}/%`, category]
      );
    } else {
      await pool.query(
        `DELETE FROM recent_files WHERE file_path = $1 OR file_path LIKE $2`,
        [pathPrefix, `${pathPrefix}/%`]
      );
    }
  } catch (err) {
    console.error('[Auth] Failed to remove recent files under path:', err);
  }
}

/**
 * Get recent files for user — validates files still exist on disk
 */
export async function getRecentFiles(userId: number, limit: number = 20): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, file_path, file_name, file_type, category, size_bytes, accessed_at
     FROM recent_files
     WHERE user_id = $1
     ORDER BY accessed_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  // Validate files still exist on disk and filter out stale entries
  const fs = await import('fs');
  const path = await import('path');

  // Use the specific user's storage path (critical for family members who have isolated storage)
  let dataDir: string;
  try {
    const userRow = await pool.query(`SELECT storage_path FROM users WHERE id = $1`, [userId]);
    if (userRow.rows.length > 0 && userRow.rows[0].storage_path && userRow.rows[0].storage_path !== 'pending') {
      dataDir = userRow.rows[0].storage_path;
      const os = await import('os');
      if (dataDir.startsWith('~/') || dataDir === '~') {
        dataDir = path.default.join(os.default.homedir(), dataDir.slice(dataDir === '~' ? 1 : 2));
      }
    } else {
      dataDir = await getActiveStoragePath();
    }
  } catch {
    const os = await import('os');
    dataDir = process.env.ARCELLITE_DATA || path.default.join(os.default.homedir(), 'arcellite-data');
    if (dataDir.startsWith('~/') || dataDir === '~') {
      dataDir = path.default.join(os.default.homedir(), dataDir.slice(2));
    }
  }
  const catDirMap: Record<string, string> = {
    general: 'files',
    media: 'photos',
    video_vault: 'videos',
    music: 'music',
  };

  const staleIds: number[] = [];
  const validRows = result.rows.filter(row => {
    if (!row.category || !row.file_path) return true; // keep rows without category info
    // External files (USB/SD) — file_path is the absolute path
    if (row.category === 'external') {
      if (!fs.default.existsSync(row.file_path)) {
        staleIds.push(row.id);
        return false;
      }
      return true;
    }
    const dirName = catDirMap[row.category];
    if (!dirName) return true;
    const fullPath = path.default.join(dataDir, dirName, row.file_path);
    if (!fs.default.existsSync(fullPath)) {
      staleIds.push(row.id);
      return false;
    }
    return true;
  });

  // Clean up stale entries in background
  if (staleIds.length > 0) {
    pool.query(
      `DELETE FROM recent_files WHERE id = ANY($1)`,
      [staleIds]
    ).catch(err => console.error('[Auth] Failed to clean stale recent files:', err));
  }

  return validRows.map(row => {
    // For folders, compute item count and subfolder status from disk
    let itemCount: number | undefined;
    let hasSubfolders: boolean | undefined;
    if (row.file_type === 'folder' && row.category && row.file_path) {
      const dirName = catDirMap[row.category];
      if (dirName) {
        const fullPath = path.default.join(dataDir, dirName, row.file_path);
        try {
          const children = fs.default.readdirSync(fullPath, { withFileTypes: true });
          itemCount = children.length;
          hasSubfolders = children.some(c => c.isDirectory());
        } catch {
          itemCount = 0;
          hasSubfolders = false;
        }
      }
    }

    return {
      id: row.id,
      filePath: row.file_path,
      fileName: row.file_name,
      fileType: row.file_type,
      category: row.category,
      sizeBytes: row.size_bytes ? Number(row.size_bytes) : null,
      accessedAt: row.accessed_at,
      ...(itemCount !== undefined && { itemCount }),
      ...(hasSubfolders !== undefined && { hasSubfolders }),
    };
  });
}

/**
 * Get all active sessions for a user (device list)
 */
export async function getUserSessions(userId: number, currentToken: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, session_token, device_name, device_type, ip_address, is_current_host, created_at, last_activity
     FROM sessions
     WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY last_activity DESC`,
    [userId]
  );

  return result.rows.map(row => ({
    id: row.id,
    deviceName: row.device_name || 'Unknown Device',
    deviceType: row.device_type || 'unknown',
    ipAddress: row.ip_address,
    isCurrentHost: row.is_current_host || false,
    isCurrent: row.session_token === currentToken,
    createdAt: row.created_at,
    lastActivity: row.last_activity,
  }));
}

/**
 * Revoke a specific session by ID (for the same user)
 */
export async function revokeSession(userId: number, sessionId: number): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id`,
    [sessionId, userId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Get user settings (upserts default row if none exists)
 */
export async function getUserSettings(userId: number): Promise<{
  notificationsEnabled: boolean;
  autoMirroring: boolean;
  vaultLockdown: boolean;
  storageDevice: string;
  aiFileCreate: boolean;
  aiFileModify: boolean;
  aiFileDelete: boolean;
  aiFolderCreate: boolean;
  aiFileOrganize: boolean;
  aiTrashAccess: boolean;
  aiTrashRestore: boolean;
  aiTrashEmpty: boolean;
  aiDatabaseCreate: boolean;
  aiDatabaseDelete: boolean;
  aiDatabaseQuery: boolean;
  aiSendEmail: boolean;
  aiCastMedia: boolean;
  aiFileRead: boolean;
  aiAutoRename: boolean;
  pdfThumbnails: boolean;
  videoThumbnails: boolean;
  castMode: string;
  castWebhookUrl: string;
  secTwoFactor: boolean;
  secFileObfuscation: boolean;
  secGhostFolders: boolean;
  secTrafficMasking: boolean;
  secStrictIsolation: boolean;
  secAutoLock: boolean;
  secAutoLockTimeout: number;
  secAutoLockPin: string;
  secFolderLock: boolean;
  secFolderLockPin: string;
  secLockedFolders: string[];
  domainConfig: { tunnelToken?: string; customDomain?: string; tunnelName?: string };
  preferredModel: string;
}> {
  // Ensure a settings row exists
  await pool.query(
    `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  const result = await pool.query(
    `SELECT notifications_enabled, preferences FROM user_settings WHERE user_id = $1`,
    [userId]
  );

  const row = result.rows[0];
  const prefs = row?.preferences || {};

  return {
    notificationsEnabled: row?.notifications_enabled ?? true,
    autoMirroring: prefs.autoMirroring ?? true,
    vaultLockdown: prefs.vaultLockdown ?? false,
    storageDevice: prefs.storageDevice ?? 'builtin',
    // AI Security permissions (default to sensible values)
    aiFileCreate: prefs.aiFileCreate ?? true,
    aiFileModify: prefs.aiFileModify ?? true,
    aiFileDelete: prefs.aiFileDelete ?? true,
    aiFolderCreate: prefs.aiFolderCreate ?? true,
    aiFileOrganize: prefs.aiFileOrganize ?? true,
    aiTrashAccess: prefs.aiTrashAccess ?? true,
    aiTrashRestore: prefs.aiTrashRestore ?? true,
    aiTrashEmpty: prefs.aiTrashEmpty ?? false,
    aiDatabaseCreate: prefs.aiDatabaseCreate ?? true,
    aiDatabaseDelete: prefs.aiDatabaseDelete ?? false,
    aiDatabaseQuery: prefs.aiDatabaseQuery ?? true,
    aiSendEmail: prefs.aiSendEmail ?? true,
    aiCastMedia: prefs.aiCastMedia ?? true,
    aiFileRead: prefs.aiFileRead ?? true,
    // Smart features
    aiAutoRename: prefs.aiAutoRename ?? false,
    pdfThumbnails: prefs.pdfThumbnails ?? true,
    videoThumbnails: prefs.videoThumbnails ?? true,
    castMode: (prefs.castMode as string) ?? 'scan',
    castWebhookUrl: (prefs.castWebhookUrl as string) ?? '',
    // Security vault features
    secTwoFactor: prefs.secTwoFactor ?? false,
    secFileObfuscation: prefs.secFileObfuscation ?? false,
    secGhostFolders: prefs.secGhostFolders ?? false,
    secTrafficMasking: prefs.secTrafficMasking ?? false,
    secStrictIsolation: prefs.secStrictIsolation ?? false,
    secAutoLock: prefs.secAutoLock ?? false,
    secAutoLockTimeout: prefs.secAutoLockTimeout ?? 5,
    secAutoLockPin: prefs.secAutoLockPin ?? '',
    secFolderLock: prefs.secFolderLock ?? false,
    secFolderLockPin: prefs.secFolderLockPin ?? '',
    secLockedFolders: prefs.secLockedFolders ?? [],
    domainConfig: prefs.domainConfig ?? {},
    preferredModel: prefs.preferredModel ?? '',
  };
}

/**
 * Check if vault lockdown (read-only mode) is active for the first user.
 * When enabled, all file modifications (upload, delete, move, rename, mkdir) are blocked.
 */
export async function isVaultLocked(): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT us.preferences FROM user_settings us
       JOIN users u ON us.user_id = u.id
       ORDER BY u.id ASC LIMIT 1`
    );
    if (result.rows.length === 0) return false;
    const prefs = result.rows[0].preferences || {};
    return prefs.vaultLockdown === true;
  } catch {
    return false; // If check fails, allow operations
  }
}

/**
 * Get AI permissions by user email (for AI action enforcement)
 */
export async function getAIPermissionsByEmail(email: string): Promise<Record<string, boolean>> {
  try {
    const userResult = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );
    if (userResult.rows.length === 0) {
      // No user found — fail-secure: deny all AI actions
      return {
        aiFileCreate: false, aiFileModify: false, aiFileDelete: false,
        aiFolderCreate: false, aiFileOrganize: false,
        aiTrashAccess: false, aiTrashRestore: false, aiTrashEmpty: false,
        aiDatabaseCreate: false, aiDatabaseDelete: false,
        aiDatabaseQuery: false, aiSendEmail: false, aiCastMedia: false, aiFileRead: false,
      };
    }
    const settings = await getUserSettings(userResult.rows[0].id);
    return {
      aiFileCreate: settings.aiFileCreate,
      aiFileModify: settings.aiFileModify,
      aiFileDelete: settings.aiFileDelete,
      aiFolderCreate: settings.aiFolderCreate,
      aiFileOrganize: settings.aiFileOrganize,
      aiTrashAccess: settings.aiTrashAccess,
      aiTrashRestore: settings.aiTrashRestore,
      aiTrashEmpty: settings.aiTrashEmpty,
      aiDatabaseCreate: settings.aiDatabaseCreate,
      aiDatabaseDelete: settings.aiDatabaseDelete,
      aiDatabaseQuery: settings.aiDatabaseQuery,
      aiSendEmail: settings.aiSendEmail,
      aiCastMedia: settings.aiCastMedia,
      aiFileRead: settings.aiFileRead,
    };
  } catch (e) {
    console.error('[Auth] Failed to get AI permissions:', e);
    // On error, fail-secure: deny all AI actions rather than granting access
    return {
      aiFileCreate: false, aiFileModify: false, aiFileDelete: false,
      aiFolderCreate: false, aiFileOrganize: false,
      aiTrashAccess: false, aiTrashRestore: false, aiTrashEmpty: false,
      aiDatabaseCreate: false, aiDatabaseDelete: false,
      aiDatabaseQuery: false, aiSendEmail: false, aiCastMedia: false, aiFileRead: false,
    };
  }
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: number,
  settings: {
    notificationsEnabled?: boolean;
    autoMirroring?: boolean;
    vaultLockdown?: boolean;
    storageDevice?: string;
    aiFileCreate?: boolean;
    aiFileModify?: boolean;
    aiFileDelete?: boolean;
    aiFolderCreate?: boolean;
    aiFileOrganize?: boolean;
    aiTrashAccess?: boolean;
    aiTrashRestore?: boolean;
    aiTrashEmpty?: boolean;
    aiDatabaseCreate?: boolean;
    aiDatabaseDelete?: boolean;
    aiDatabaseQuery?: boolean;
    aiSendEmail?: boolean;
    aiCastMedia?: boolean;
    aiFileRead?: boolean;
    aiAutoRename?: boolean;
    pdfThumbnails?: boolean;
    videoThumbnails?: boolean;
    castMode?: string;
    castWebhookUrl?: string;
    secTwoFactor?: boolean;
    secFileObfuscation?: boolean;
    secGhostFolders?: boolean;
    secTrafficMasking?: boolean;
    secStrictIsolation?: boolean;
    secAutoLock?: boolean;
    secAutoLockTimeout?: number;
    secAutoLockPin?: string;
    secFolderLock?: boolean;
    secFolderLockPin?: string;
    secLockedFolders?: string[];
    preferredModel?: string;
  }
): Promise<void> {
  // Ensure row exists
  await pool.query(
    `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  // Get current preferences
  const current = await pool.query(
    `SELECT notifications_enabled, preferences FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  const currentPrefs = current.rows[0]?.preferences || {};

  // Build updated preferences JSONB
  const updatedPrefs = { ...currentPrefs };
  if (settings.autoMirroring !== undefined) updatedPrefs.autoMirroring = settings.autoMirroring;
  if (settings.vaultLockdown !== undefined) updatedPrefs.vaultLockdown = settings.vaultLockdown;
  if (settings.storageDevice !== undefined) updatedPrefs.storageDevice = settings.storageDevice;
  // AI Security permissions and other preference fields
  const aiKeys = [
    'aiFileCreate', 'aiFileModify', 'aiFileDelete', 'aiFolderCreate',
    'aiFileOrganize', 'aiTrashAccess', 'aiTrashRestore', 'aiTrashEmpty',
    'aiDatabaseCreate', 'aiDatabaseDelete', 'aiDatabaseQuery',
    'aiSendEmail', 'aiCastMedia', 'aiFileRead',
    'aiAutoRename', 'pdfThumbnails', 'videoThumbnails', 'castMode', 'castWebhookUrl',
    'secTwoFactor', 'secFileObfuscation', 'secGhostFolders', 'secTrafficMasking', 'secStrictIsolation',
    'secAutoLock', 'secAutoLockTimeout', 'secAutoLockPin',
    'secFolderLock', 'secFolderLockPin', 'secLockedFolders',
    'preferredModel',
  ] as const;
  for (const key of aiKeys) {
    if (settings[key] !== undefined) updatedPrefs[key] = settings[key];
  }

  const notif = settings.notificationsEnabled !== undefined
    ? settings.notificationsEnabled
    : (current.rows[0]?.notifications_enabled ?? true);

  await pool.query(
    `UPDATE user_settings
     SET notifications_enabled = $1, preferences = $2, updated_at = NOW()
     WHERE user_id = $3`,
    [notif, JSON.stringify(updatedPrefs), userId]
  );
}

/**
 * Update domain configuration (Cloudflare tunnel settings)
 */
export async function updateDomainConfig(userId: number, domainConfig: Record<string, any>) {
  await pool.query(
    `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  const current = await pool.query(
    `SELECT preferences FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  const currentPrefs = current.rows[0]?.preferences || {};
  currentPrefs.domainConfig = domainConfig;
  await pool.query(
    `UPDATE user_settings SET preferences = $1, updated_at = NOW() WHERE user_id = $2`,
    [JSON.stringify(currentPrefs), userId]
  );
}

/**
 * Create a notification for a user
 * Respects the user's notificationsEnabled setting — if OFF, notifications are suppressed.
 */
export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: 'info' | 'warning' | 'success' | 'error' = 'info',
  category: 'system' | 'security' | 'storage' | 'update' = 'system'
): Promise<void> {
  // Check if user has notifications enabled
  try {
    const settingsResult = await pool.query(
      `SELECT notifications_enabled FROM user_settings WHERE user_id = $1`,
      [userId]
    );
    if (settingsResult.rows.length > 0 && settingsResult.rows[0].notifications_enabled === false) {
      return; // Notifications suppressed
    }
  } catch { /* If settings check fails, allow notification through */ }

  // SEC-NOTIFY: Rate limit — drop if more than 30 notifications created in the last minute
  try {
    const recentCount = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
      [userId]
    );
    if (parseInt(recentCount.rows[0].count, 10) >= 30) {
      return; // Silently drop to prevent notification flood
    }
  } catch { /* Never block the insert on rate-limit check failure */ }

  await pool.query(
    `INSERT INTO notifications (user_id, title, message, type, category)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, title, message, type, category]
  );
}

/**
 * Get notifications for a user
 */
export async function getNotifications(userId: number, limit: number = 30): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, title, message, type, category, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map(row => ({
    id: row.id.toString(),
    title: row.title,
    message: row.message,
    type: row.type,
    category: row.category,
    read: row.is_read,
    timestamp: new Date(row.created_at).getTime(),
    time: formatTimeAgo(row.created_at),
    createdAt: row.created_at,
  }));
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(userId: number, notificationId: number): Promise<void> {
  await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: number): Promise<void> {
  await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
}

/**
 * Clear (delete) all notifications for a user
 */
export async function clearAllNotifications(userId: number): Promise<void> {
  await pool.query(
    `DELETE FROM notifications WHERE user_id = $1`,
    [userId]
  );
}

/**
 * Helper: format timestamp as relative time
 */
function formatTimeAgo(dateStr: string | Date): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Reset all user settings/preferences back to factory defaults.
 */
export async function resetUserSettings(userId: number): Promise<void> {
  // Default preferences — matches the defaults in getUserSettings
  const defaultPrefs = {
    autoMirroring: true,
    vaultLockdown: false,
    storageDevice: 'builtin',
    aiFileCreate: true,
    aiFileModify: true,
    aiFileDelete: true,
    aiFolderCreate: true,
    aiFileOrganize: true,
    aiTrashAccess: true,
    aiTrashRestore: true,
    aiTrashEmpty: false,
    aiDatabaseCreate: true,
    aiDatabaseDelete: false,
    aiDatabaseQuery: true,
    aiSendEmail: true,
    aiCastMedia: true,
    aiFileRead: true,
    aiAutoRename: false,
    pdfThumbnails: true,
    secTwoFactor: false,
    secFileObfuscation: false,
    secGhostFolders: false,
    secTrafficMasking: false,
    secStrictIsolation: false,
  };

  await pool.query(
    `INSERT INTO user_settings (user_id, notifications_enabled, preferences)
     VALUES ($1, true, $2)
     ON CONFLICT (user_id) DO UPDATE
     SET notifications_enabled = true, preferences = $2, updated_at = NOW()`,
    [userId, JSON.stringify(defaultPrefs)]
  );
}

/**
 * Delete user account and all associated data (DB + files on disk + user databases)
 */
export async function deleteAccount(userId: number): Promise<void> {
  // Get the user's storage path before deleting
  const userResult = await pool.query(
    `SELECT storage_path FROM users WHERE id = $1`,
    [userId]
  );

  // ── 1. Drop user-created PostgreSQL databases & chat history ──
  try {
    // Find all arcellite_* databases (user-created) and the chat history DB
    const dbListResult = await pool.query(
      `SELECT datname FROM pg_database
       WHERE datname LIKE 'arcellite_%' AND datname != $1`,
      [process.env.DB_NAME || 'arcellite']
    );
    for (const row of dbListResult.rows) {
      const dbName = row.datname;
      try {
        // Terminate active connections first
        await pool.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [dbName]
        );
        await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        console.log(`[Auth] Dropped database: ${dbName}`);
      } catch (err) {
        console.error(`[Auth] Failed to drop database ${dbName}:`, err);
      }
    }
  } catch (err) {
    console.error('[Auth] Failed to clean up user databases:', err);
  }

  // ── 2. Drop user-created MySQL databases ──
  try {
    const mysql = await import('mysql2/promise');
    const mysqlConn = await mysql.default.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'arcellite_user',
      password: process.env.MYSQL_PASSWORD,
    });
    try {
      const [rows] = await mysqlConn.query(
        `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE 'arcellite_%'`
      ) as any[];
      for (const row of rows) {
        try {
          await mysqlConn.query(`DROP DATABASE IF EXISTS \`${row.SCHEMA_NAME}\``);
          console.log(`[Auth] Dropped MySQL database: ${row.SCHEMA_NAME}`);
        } catch (err) {
          console.error(`[Auth] Failed to drop MySQL database ${row.SCHEMA_NAME}:`, err);
        }
      }
    } finally {
      await mysqlConn.end();
    }
  } catch {
    // MySQL may not be installed or accessible — that's fine
  }

  // ── 3. Delete user row (CASCADE handles sessions, recent_files, activity_log, etc.) ──
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

  // ── 4. Delete storage files from disk ──
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  if (userResult.rows.length > 0) {
    const storagePath = userResult.rows[0].storage_path || '~/arcellite-data';

    // Resolve ~ to home directory
    const resolvedPath = storagePath.startsWith('~')
      ? path.join(os.homedir(), storagePath.slice(1))
      : storagePath;

    // Also delete the default arcellite-data directory
    let defaultDataDir = process.env.ARCELLITE_DATA || path.join(os.homedir(), 'arcellite-data');
    if (defaultDataDir.startsWith('~/') || defaultDataDir === '~') {
      defaultDataDir = path.join(os.homedir(), defaultDataDir.slice(2));
    }

    const dirsToClean = [resolvedPath];
    if (defaultDataDir !== resolvedPath) {
      dirsToClean.push(defaultDataDir);
    }

    for (const dir of dirsToClean) {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (err) {
        console.error(`[Auth] Failed to delete storage directory ${dir}:`, err);
      }
    }
  }

  // ── 5. Clean up .env file (contains secrets specific to this installation) ──
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      fs.unlinkSync(envPath);
      console.log('[Auth] Removed .env file');
    }
  } catch (err) {
    console.error('[Auth] Failed to remove .env file:', err);
  }
}

/**
 * Delete a family member's own account.
 * SAFE version: only removes the member's isolated subdirectory under family/.
 * Does NOT touch owner databases, .env, or owner storage.
 */
export async function deleteFamilyMemberAccount(userId: number): Promise<void> {
  // Get the member's isolated storage path before deleting the row
  const userResult = await pool.query(
    `SELECT u.storage_path, fm.id AS fm_id
     FROM users u
     LEFT JOIN family_members fm ON fm.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  // ── 1. Delete the users row — CASCADE removes sessions, activity_log, recent_files, etc. ──
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

  // ── 2. Clean up family_members row (user_id FK is SET NULL by CASCADE, remove the row entirely) ──
  if (userResult.rows[0]?.fm_id) {
    await pool.query(`DELETE FROM family_members WHERE id = $1`, [userResult.rows[0].fm_id]);
  }

  // ── 3. Delete only the member's isolated storage subdirectory ──
  if (userResult.rows.length > 0) {
    const storagePath: string = userResult.rows[0].storage_path || '';
    if (storagePath && storagePath !== 'pending') {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      let resolvedPath = storagePath;
      if (storagePath.startsWith('~/') || storagePath === '~') {
        resolvedPath = path.join(os.homedir(), storagePath.slice(storagePath === '~' ? 1 : 2));
      }

      // Safety guard: only delete paths that contain '/family/' to prevent
      // accidentally deleting the owner's root storage directory.
      if (resolvedPath.includes('/family/')) {
        try {
          if (fs.existsSync(resolvedPath)) {
            fs.rmSync(resolvedPath, { recursive: true, force: true });
          }
        } catch (err) {
          console.error(`[Auth] Failed to delete family member storage directory ${resolvedPath}:`, err);
        }
      }
    }
  }
}

/**
 * Create a family member user account.
 * Inserts into users table with a dedicated storage subdirectory under the owner's path.
 * is_setup_complete and email_verified are set to TRUE — no wizard or email verification needed.
 */
export async function createFamilyUser(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  ownerStoragePath: string;
}): Promise<User> {
  const passwordHash = await hashPassword(params.password);

  // Insert with placeholder path first — need the assigned id to build the subdirectory path
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name,
                        is_setup_complete, email_verified, storage_path)
     VALUES ($1, $2, $3, $4, TRUE, TRUE, 'pending')
     RETURNING id, email, first_name, last_name, avatar_url,
               storage_path, is_setup_complete, email_verified, created_at`,
    [params.email, passwordHash, params.firstName, params.lastName],
  );
  const row = result.rows[0];
  const userId: number = row.id;

  // Resolve owner base path and build isolated subdirectory for this member
  const os = await import('os');
  const path = await import('path');
  const fs = await import('fs');
  let ownerBase = params.ownerStoragePath;
  if (ownerBase === '~' || ownerBase.startsWith('~/')) {
    ownerBase = path.join(os.homedir(), ownerBase.slice(ownerBase === '~' ? 1 : 2));
  }
  const memberStoragePath = path.join(ownerBase, 'family', String(userId));

  await pool.query(
    `UPDATE users SET storage_path = $1 WHERE id = $2`,
    [memberStoragePath, userId],
  );

  // Create directory structure matching the main app's category layout
  fs.mkdirSync(path.join(memberStoragePath, 'photos'), { recursive: true });
  fs.mkdirSync(path.join(memberStoragePath, 'videos'), { recursive: true });
  fs.mkdirSync(path.join(memberStoragePath, 'music'), { recursive: true });
  fs.mkdirSync(path.join(memberStoragePath, 'files'), { recursive: true });

  return {
    id: userId,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: null,
    storagePath: memberStoragePath,
    isSetupComplete: true,
    emailVerified: true,
    isFamilyMember: true,
    isSuspended: false,
    createdAt: row.created_at,
  };
}

/**
 * Get the resolved storage path for the active user.
 * Reads storage_path from the first user in the database.
 * Falls back to ARCELLITE_DATA env var or ~/arcellite-data.
 */
export async function getActiveStoragePath(): Promise<string> {
  const os = await import('os');
  const path = await import('path');

  // Default fallback
  let defaultDir = process.env.ARCELLITE_DATA || path.join(os.homedir(), 'arcellite-data');
  if (defaultDir.startsWith('~/') || defaultDir === '~') {
    defaultDir = path.join(os.homedir(), defaultDir.slice(1));
  }

  try {
    const result = await pool.query(
      `SELECT storage_path FROM users WHERE is_setup_complete = true ORDER BY id ASC LIMIT 1`
    );
    if (result.rows.length > 0 && result.rows[0].storage_path) {
      let storagePath = result.rows[0].storage_path;
      if (storagePath.startsWith('~/') || storagePath === '~') {
        storagePath = path.join(os.homedir(), storagePath.slice(1));
      }
      return storagePath;
    }
  } catch {
    // DB not ready yet — use default
  }

  return defaultDir;
}
