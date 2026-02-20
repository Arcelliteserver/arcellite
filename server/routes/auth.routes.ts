/**
 * Authentication Routes
 * Handles all authentication-related API endpoints
 */

import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Busboy from 'busboy';
import * as authService from '../services/auth.service.js';
import * as securityService from '../services/security.service.js';
import { sendVerificationEmail } from '../services/email.service.js';
import { ensureBaseExists } from '../files.js';
import { pool } from '../db/connection.js';

/**
 * Parse JSON body from request
 */
async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/** Simple in-memory rate limiter: max 10 requests per IP per 60 s (SEC-006) */
const _rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(req: IncomingMessage): boolean {
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
  const now = Date.now();
  const entry = _rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    _rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT;
}

/**
 * POST /api/auth/register
 * Create new admin user (only if no users exist)
 */
export async function handleRegister(req: IncomingMessage, res: ServerResponse) {
  if (!checkRateLimit(req)) {
    sendJson(res, 429, { error: 'Too many requests. Please wait before trying again.' });
    return;
  }
  try {
    const { email, password, firstName, lastName } = await parseBody(req);

    if (!email || !password) {
      sendJson(res, 400, { error: 'Email and password are required' });
      return;
    }

    // Check if setup is still needed
    const { isSetupNeeded } = await import('../db/connection.js');
    const setupNeeded = await isSetupNeeded();

    if (!setupNeeded) {
      sendJson(res, 403, { error: 'Registration is closed. User already exists.' });
      return;
    }

    // Create user
    const user = await authService.createUser(email, password, firstName, lastName);

    // Create session with device info
    const ua = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || '';
    const session = await authService.createSession(user.id, { userAgent: ua, ipAddress: ip, isCurrentHost: true });

    // Generate verification code
    const verificationCode = authService.generateVerificationCode();
    await authService.setVerificationCode(user.id, verificationCode);

    // Log registration
    authService.logActivity(user.id, 'register', 'Account created').catch(() => {});

    // Create welcome notification
    authService.createNotification(
      user.id,
      'Welcome to Arcellite',
      'Your account has been created successfully. Complete the setup wizard to get started.',
      'success',
      'system'
    ).catch(() => {});

    // Send verification email (async, don't wait)
    sendVerificationEmail(email, verificationCode).catch(err =>
      console.error('[Auth] Failed to send verification email:', err)
    );

    sendJson(res, 201, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSetupComplete: user.isSetupComplete,
        emailVerified: user.emailVerified,
      },
      sessionToken: session.sessionToken,
    });
  } catch (error: any) {
    console.error('[Auth] Register error:', error);
    sendJson(res, 500, { error: error.message || 'Registration failed' });
  }
}

/**
 * POST /api/auth/login
 * Authenticate user
 */
export async function handleLogin(req: IncomingMessage, res: ServerResponse) {
  if (!checkRateLimit(req)) {
    sendJson(res, 429, { error: 'Too many requests. Please wait before trying again.' });
    return;
  }
  try {
    const { email, password, totpCode } = await parseBody(req);

    if (!email || !password) {
      sendJson(res, 400, { error: 'Email and password are required' });
      return;
    }

    const user = await authService.authenticateUser(email, password);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid email or password' });
      return;
    }

    // Check if 2FA is enabled
    const has2FA = await securityService.is2FAEnabled(user.id);
    if (has2FA) {
      if (!totpCode) {
        // Return a challenge — user must provide TOTP code
        sendJson(res, 200, { requires2FA: true, userId: user.id });
        return;
      }
      // Verify the TOTP code
      const secret = await securityService.getTotpSecret(user.id);
      if (!secret || !securityService.verifyTotpCode(secret, totpCode)) {
        sendJson(res, 401, { error: 'Invalid verification code' });
        return;
      }
    }

    const loginUa = req.headers['user-agent'] || '';
    const loginIp = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || '';

    // Strict Isolation: block login from unauthorized IPs
    const ipAllowed = await securityService.isIpAllowed(user.id, loginIp);
    if (!ipAllowed) {
      sendJson(res, 403, { error: 'Access denied: your IP address is not authorized. Contact the administrator.' });
      return;
    }

    const session = await authService.createSession(user.id, { userAgent: loginUa, ipAddress: loginIp });

    // Log login activity
    const deviceInfo = authService.parseDeviceForNotification(loginUa);
    authService.logActivity(user.id, 'login', `Signed in from ${deviceInfo}`).catch(() => {});

    // Create login notification
    authService.createNotification(
      user.id,
      'New Sign-in Detected',
      `Your account was accessed from ${deviceInfo}${loginIp ? ` (${loginIp})` : ''}.`,
      'info',
      'security'
    ).catch(() => {});

    const { rows: fmLoginRows } = await pool.query(
      `SELECT id FROM family_members WHERE user_id = $1 LIMIT 1`,
      [user.id],
    );
    sendJson(res, 200, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        isSetupComplete: user.isSetupComplete,
        emailVerified: user.emailVerified,
        isFamilyMember: fmLoginRows.length > 0,
      },
      sessionToken: session.sessionToken,
    });
  } catch (error: any) {
    console.error('[Auth] Login error:', error);
    sendJson(res, 500, { error: error.message || 'Login failed' });
  }
}

/**
 * GET /api/auth/access-status
 * Pre-auth check: should this IP see access-denied (no login) or login page?
 * No authentication required. Used to block unauthorized IPs before showing login.
 */
export async function handleAccessStatus(req: IncomingMessage, res: ServerResponse) {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress || '';
    const deny = await securityService.shouldDenyAccessByIp(clientIp);
    sendJson(res, 200, { access: deny ? 'denied' : 'login' });
  } catch (err: any) {
    sendJson(res, 500, { access: 'login' });
  }
}

/**
 * POST /api/auth/verify-email
 * Verify email with code
 */
export async function handleVerifyEmail(req: IncomingMessage, res: ServerResponse) {
  if (!checkRateLimit(req)) {
    sendJson(res, 429, { error: 'Too many requests. Please wait before trying again.' });
    return;
  }
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    const { code } = await parseBody(req);

    if (!code) {
      sendJson(res, 400, { error: 'Verification code is required' });
      return;
    }

    const isValid = await authService.verifyEmailCode(user.id, code);

    if (!isValid) {
      sendJson(res, 400, { error: 'Invalid or expired verification code' });
      return;
    }

    // Create notification
    authService.createNotification(
      user.id,
      'Email Verified',
      'Your email address has been verified successfully.',
      'success',
      'security'
    ).catch(() => {});

    sendJson(res, 200, { success: true, message: 'Email verified successfully' });
  } catch (error: any) {
    console.error('[Auth] Verify email error:', error);
    sendJson(res, 500, { error: error.message || 'Verification failed' });
  }
}

/**
 * POST /api/auth/resend-code
 * Resend verification code
 */
export async function handleResendCode(req: IncomingMessage, res: ServerResponse) {
  if (!checkRateLimit(req)) {
    sendJson(res, 429, { error: 'Too many requests. Please wait before trying again.' });
    return;
  }
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    if (user.emailVerified) {
      sendJson(res, 400, { error: 'Email already verified' });
      return;
    }

    const verificationCode = authService.generateVerificationCode();
    await authService.setVerificationCode(user.id, verificationCode);

    await sendVerificationEmail(user.email, verificationCode);

    sendJson(res, 200, { success: true, message: 'Verification code sent' });
  } catch (error: any) {
    console.error('[Auth] Resend code error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to resend code' });
  }
}

/**
 * GET /api/auth/me
 * Get current user
 */
export async function handleGetCurrentUser(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    const { rows: fmMeRows } = await pool.query(
      `SELECT id, status FROM family_members WHERE user_id = $1 LIMIT 1`,
      [user.id],
    );
    const isFamilyMember = fmMeRows.length > 0;
    const isSuspended = isFamilyMember && fmMeRows[0].status === 'disabled';
    sendJson(res, 200, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        storagePath: user.storagePath,
        isSetupComplete: user.isSetupComplete,
        emailVerified: user.emailVerified,
        isFamilyMember,
        isSuspended,
      },
    });
  } catch (error: any) {
    console.error('[Auth] Get current user error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to get user' });
  }
}

/**
 * POST /api/auth/logout
 * Destroy session
 */
export async function handleLogout(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    await authService.destroySession(sessionToken);

    sendJson(res, 200, { success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('[Auth] Logout error:', error);
    sendJson(res, 500, { error: error.message || 'Logout failed' });
  }
}

/**
 * PUT /api/auth/profile
 * Update user profile
 */
export async function handleUpdateProfile(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    const { firstName, lastName, avatarUrl, storagePath } = await parseBody(req);

    // Validate storagePath cannot point to sensitive system directories
    if (storagePath) {
      const os = await import('os');
      let resolvedPath = storagePath as string;
      if (resolvedPath.startsWith('~/') || resolvedPath === '~') {
        resolvedPath = path.join(os.homedir(), resolvedPath.slice(1));
      }
      const absPath = path.resolve(resolvedPath);
      const blockedPaths = ['/root', '/etc', '/sys', '/proc', '/boot', '/bin', '/sbin', '/usr/bin', '/usr/sbin', '/lib', '/dev'];
      if (blockedPaths.some(blocked => absPath === blocked || absPath.startsWith(blocked + '/'))) {
        sendJson(res, 400, { error: 'Storage path cannot be in a system directory' });
        return;
      }
    }

    await authService.updateUserProfile(user.id, {
      firstName,
      lastName,
      avatarUrl,
      storagePath,
    });

    // When storage path changes, invalidate cache and create directories
    if (storagePath) {
      // Clear the global cache so all modules pick up the new path
      (globalThis as any).__arcellite_storage_path = null;

      // Resolve and create data directories on the new path
      try {
        const os = await import('os');
        let resolved = storagePath as string;
        if (resolved.startsWith('~/') || resolved === '~') {
          resolved = path.join(os.homedir(), resolved.slice(1));
        }
        const dirs = ['files', 'photos', 'videos', 'music', 'shared', 'databases', 'databases/sqlite'];
        for (const sub of dirs) {
          const dir = path.join(resolved, sub);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        }
        // Set the new path in global cache
        (globalThis as any).__arcellite_storage_path = resolved;
        console.log(`[Storage] Data directory set to: ${resolved}`);
      } catch (e) {
        console.error('[Storage] Failed to create directories at new path:', e);
      }
    }

    sendJson(res, 200, { success: true, message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('[Auth] Update profile error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to update profile' });
  }
}

/**
 * POST /api/auth/complete-setup
 * Mark setup as complete
 */
export async function handleCompleteSetup(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    await authService.markSetupComplete(user.id);

    // Create all standard folders on disk
    ensureBaseExists();

    // Create notification
    authService.createNotification(
      user.id,
      'Setup Complete',
      'Your Arcellite server is ready. All default folders have been created.',
      'success',
      'system'
    ).catch(() => {});

    sendJson(res, 200, { success: true, message: 'Setup completed successfully' });
  } catch (error: any) {
    console.error('[Auth] Complete setup error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to complete setup' });
  }
}

/**
 * GET /api/auth/activity
 * Get activity log for current user
 */
export async function handleGetActivityLog(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    const url = new URL(req.url || '', 'http://localhost');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const activities = await authService.getActivityLog(user.id, limit);

    sendJson(res, 200, { activities });
  } catch (error: any) {
    console.error('[Auth] Get activity log error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to get activity log' });
  }
}

/**
 * GET /api/files/recent
 * Get recent files for current user
 */
export async function handleGetRecentFiles(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    const recentFiles = await authService.getRecentFiles(user.id, limit);
    sendJson(res, 200, { recentFiles });
  } catch (error: any) {
    console.error('[Files] Get recent files error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to get recent files' });
  }
}

/**
 * POST /api/files/track-recent
 * Track a file access as recent
 */
export async function handleTrackRecentFile(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    const body = await parseBody(req);
    const { filePath, fileName, fileType, category, sizeBytes } = body;

    if (!filePath || !fileName) {
      sendJson(res, 400, { error: 'filePath and fileName are required' });
      return;
    }

    await authService.trackRecentFile(user.id, filePath, fileName, fileType, category, sizeBytes);
    sendJson(res, 200, { success: true });
  } catch (error: any) {
    console.error('[Files] Track recent file error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to track recent file' });
  }
}

/**
 * GET /api/auth/sessions
 * Get all active device sessions for the current user
 */
export async function handleGetSessions(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    const sessions = await authService.getUserSessions(user.id, sessionToken);
    sendJson(res, 200, { sessions });
  } catch (error: any) {
    console.error('[Auth] Get sessions error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to get sessions' });
  }
}

/**
 * DELETE /api/auth/sessions/:id
 * Revoke a specific device session
 */
export async function handleRevokeSession(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    // Extract session ID from URL
    const url = new URL(req.url || '', 'http://localhost');
    const sessionId = parseInt(url.pathname.split('/').pop() || '0', 10);

    if (!sessionId) {
      sendJson(res, 400, { error: 'Invalid session ID' });
      return;
    }

    const revoked = await authService.revokeSession(user.id, sessionId);
    if (!revoked) {
      sendJson(res, 404, { error: 'Session not found' });
      return;
    }

    // Create notification
    authService.createNotification(
      user.id,
      'Device Removed',
      'A device session has been revoked from your account.',
      'warning',
      'security'
    ).catch(() => {});

    sendJson(res, 200, { success: true, message: 'Session revoked' });
  } catch (error: any) {
    console.error('[Auth] Revoke session error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to revoke session' });
  }
}

/**
 * DELETE /api/auth/account
 * Delete the current user's account
 */
export async function handleDeleteAccount(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    // Check if this is a family member — use safe isolated deletion that
    // does NOT touch the owner's databases, .env, or root storage directory.
    const { rows: fmCheck } = await pool.query(
      `SELECT id FROM family_members WHERE user_id = $1 LIMIT 1`,
      [user.id]
    );
    if (fmCheck.length > 0) {
      await authService.deleteFamilyMemberAccount(user.id);
    } else {
      await authService.deleteAccount(user.id);
    }
    sendJson(res, 200, { success: true, message: 'Account deleted' });
  } catch (error: any) {
    console.error('[Auth] Delete account error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to delete account' });
  }
}

/**
 * GET /api/auth/settings
 * Get user preferences/settings
 */
export async function handleGetSettings(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    const settings = await authService.getUserSettings(user.id);
    sendJson(res, 200, { settings });
  } catch (error: any) {
    console.error('[Auth] Get settings error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to get settings' });
  }
}

/**
 * PUT /api/auth/settings
 * Update user preferences/settings
 */
export async function handleUpdateSettings(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    const body = await parseBody(req);
    const { notificationsEnabled, autoMirroring, vaultLockdown, storageDevice,
      aiFileCreate, aiFileModify, aiFileDelete, aiFolderCreate,
      aiFileOrganize, aiTrashAccess, aiTrashRestore, aiTrashEmpty,
      aiDatabaseCreate, aiDatabaseDelete, aiDatabaseQuery,
      aiSendEmail, aiCastMedia, aiFileRead,
      aiAutoRename, pdfThumbnails,
      secTwoFactor, secFileObfuscation, secGhostFolders, secTrafficMasking, secStrictIsolation,
      secAutoLock, secAutoLockTimeout, secAutoLockPin, secFolderLock, secFolderLockPin, secLockedFolders,
      preferredModel,
    } = body;

    await authService.updateUserSettings(user.id, {
      notificationsEnabled,
      autoMirroring,
      vaultLockdown,
      storageDevice,
      aiFileCreate, aiFileModify, aiFileDelete, aiFolderCreate,
      aiFileOrganize, aiTrashAccess, aiTrashRestore, aiTrashEmpty,
      aiDatabaseCreate, aiDatabaseDelete, aiDatabaseQuery,
      aiSendEmail, aiCastMedia, aiFileRead,
      aiAutoRename, pdfThumbnails,
      secTwoFactor, secFileObfuscation, secGhostFolders, secTrafficMasking, secStrictIsolation,
      secAutoLock, secAutoLockTimeout, secAutoLockPin, secFolderLock, secFolderLockPin, secLockedFolders,
      preferredModel,
    });

    // Log the settings change
    const changedFields: string[] = [];
    if (notificationsEnabled !== undefined) changedFields.push(`Notifications: ${notificationsEnabled ? 'enabled' : 'disabled'}`);
    if (autoMirroring !== undefined) changedFields.push(`Auto Mirroring: ${autoMirroring ? 'enabled' : 'disabled'}`);
    if (vaultLockdown !== undefined) changedFields.push(`Vault Lockdown: ${vaultLockdown ? 'enabled' : 'disabled'}`);
    if (storageDevice !== undefined) changedFields.push(`Storage: ${storageDevice}`);

    // Log AI security changes
    const aiLabels: Record<string, string> = {
      aiFileCreate: 'AI File Create', aiFileModify: 'AI File Modify', aiFileDelete: 'AI File Delete',
      aiFolderCreate: 'AI Folder Create', aiFileOrganize: 'AI File Organize',
      aiTrashAccess: 'AI Trash Access', aiTrashRestore: 'AI Trash Restore', aiTrashEmpty: 'AI Trash Empty',
      aiDatabaseCreate: 'AI DB Create', aiDatabaseDelete: 'AI DB Delete', aiDatabaseQuery: 'AI DB Query',
      aiSendEmail: 'AI Send Email', aiCastMedia: 'AI Cast Media', aiFileRead: 'AI File Read',
      aiAutoRename: 'AI Auto-Rename', pdfThumbnails: 'PDF Thumbnails',
      secTwoFactor: 'Two-Factor Auth', secFileObfuscation: 'File Obfuscation',
      secGhostFolders: 'Ghost Folders', secTrafficMasking: 'Traffic Masking',
      secStrictIsolation: 'Strict Isolation',
      secAutoLock: 'Auto-Lock Screen', secAutoLockTimeout: 'Auto-Lock Timeout', secAutoLockPin: 'Auto-Lock PIN',
      secFolderLock: 'Folder Lock', secFolderLockPin: 'Folder Lock PIN', secLockedFolders: 'Locked Folders',
    };
    for (const [key, label] of Object.entries(aiLabels)) {
      if ((body as any)[key] !== undefined) {
        changedFields.push(`${label}: ${(body as any)[key] ? 'enabled' : 'disabled'}`);
      }
    }

    if (changedFields.length > 0) {
      authService.logActivity(user.id, 'settings', changedFields.join(', ')).catch(() => {});

      // Create notification for settings change
      authService.createNotification(
        user.id,
        'Settings Updated',
        changedFields.join(', '),
        'info',
        'system'
      ).catch(() => {});
    }

    const settings = await authService.getUserSettings(user.id);
    sendJson(res, 200, { settings });
  } catch (error: any) {
    console.error('[Auth] Update settings error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to update settings' });
  }
}

/**
 * POST /api/auth/reset-settings
 * Reset all user preferences back to factory defaults
 */
export async function handleResetSettings(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    await authService.resetUserSettings(user.id);

    // Log activity
    authService.logActivity(user.id, 'settings', 'Reset all preferences to factory defaults').catch(() => {});
    authService.createNotification(user.id, 'Settings Reset', 'All preferences have been restored to factory defaults', 'warning', 'system').catch(() => {});

    const settings = await authService.getUserSettings(user.id);
    sendJson(res, 200, { ok: true, settings });
  } catch (error: any) {
    console.error('[Auth] Reset settings error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to reset settings' });
  }
}

/**
 * GET /api/notifications
 * Get notifications for current user
 */
export async function handleGetNotifications(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    const url = new URL(req.url || '', 'http://localhost');
    const limit = parseInt(url.searchParams.get('limit') || '30', 10);

    const notifications = await authService.getNotifications(user.id, limit);
    sendJson(res, 200, { notifications });
  } catch (error: any) {
    console.error('[Auth] Get notifications error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to get notifications' });
  }
}

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read
 */
export async function handleMarkNotificationRead(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    const url = new URL(req.url || '', 'http://localhost');
    const parts = url.pathname.split('/');
    const notificationId = parseInt(parts[parts.length - 2], 10);

    if (!notificationId) {
      sendJson(res, 400, { error: 'Invalid notification ID' });
      return;
    }

    await authService.markNotificationRead(user.id, notificationId);
    sendJson(res, 200, { success: true });
  } catch (error: any) {
    console.error('[Auth] Mark notification read error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to mark notification read' });
  }
}

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
export async function handleMarkAllNotificationsRead(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    await authService.markAllNotificationsRead(user.id);
    sendJson(res, 200, { success: true });
  } catch (error: any) {
    console.error('[Auth] Mark all notifications read error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to mark all notifications read' });
  }
}

/**
 * DELETE /api/notifications/clear-all
 * Clear (delete) all notifications for current user
 */
export async function handleClearAllNotifications(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    await authService.clearAllNotifications(user.id);
    sendJson(res, 200, { success: true });
  } catch (error: any) {
    console.error('[Auth] Clear all notifications error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to clear notifications' });
  }
}

// ─── Security Vault Routes ─────────────────────────────────────────────────

/**
 * POST /api/security/2fa/setup
 * Generate a new TOTP secret and return the QR code URI
 */
export async function handle2FASetup(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { sendJson(res, 401, { error: 'Unauthorized' }); return; }
    const user = await authService.validateSession(authHeader.substring(7));
    if (!user) { sendJson(res, 401, { error: 'Invalid session' }); return; }

    const secret = securityService.generateTotpSecret();
    const uri = securityService.getTotpUri(secret, user.email);

    // Store the secret temporarily — it's confirmed when user verifies a code
    await securityService.saveTotpSecret(user.id, secret);

    sendJson(res, 200, { secret, uri });
  } catch (error: any) {
    console.error('[Security] 2FA setup error:', error);
    sendJson(res, 500, { error: error.message || '2FA setup failed' });
  }
}

/**
 * POST /api/security/2fa/verify
 * Verify a TOTP code to confirm 2FA setup
 */
export async function handle2FAVerify(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { sendJson(res, 401, { error: 'Unauthorized' }); return; }
    const user = await authService.validateSession(authHeader.substring(7));
    if (!user) { sendJson(res, 401, { error: 'Invalid session' }); return; }

    const { code } = await parseBody(req);
    if (!code) { sendJson(res, 400, { error: 'Verification code required' }); return; }

    const secret = await securityService.getTotpSecret(user.id);
    if (!secret) { sendJson(res, 400, { error: 'No 2FA secret found. Run setup first.' }); return; }

    const isValid = securityService.verifyTotpCode(secret, code);
    if (!isValid) { sendJson(res, 400, { error: 'Invalid verification code' }); return; }

    // Enable 2FA in user settings
    await authService.updateUserSettings(user.id, { secTwoFactor: true });

    authService.logActivity(user.id, 'security', 'Two-Factor Authentication enabled').catch(() => {});
    authService.createNotification(user.id, 'Two-Factor Auth Enabled', 'Your account is now protected with 2FA.', 'success', 'security').catch(() => {});

    sendJson(res, 200, { success: true, message: '2FA enabled successfully' });
  } catch (error: any) {
    console.error('[Security] 2FA verify error:', error);
    sendJson(res, 500, { error: error.message || '2FA verification failed' });
  }
}

/**
 * POST /api/security/2fa/disable
 * Disable 2FA
 */
export async function handle2FADisable(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { sendJson(res, 401, { error: 'Unauthorized' }); return; }
    const user = await authService.validateSession(authHeader.substring(7));
    if (!user) { sendJson(res, 401, { error: 'Invalid session' }); return; }

    const { code } = await parseBody(req);
    const secret = await securityService.getTotpSecret(user.id);

    // Require a valid code to disable (security measure)
    if (secret && code) {
      const isValid = securityService.verifyTotpCode(secret, code);
      if (!isValid) { sendJson(res, 400, { error: 'Invalid verification code' }); return; }
    }

    await securityService.removeTotpSecret(user.id);
    await authService.updateUserSettings(user.id, { secTwoFactor: false });

    authService.logActivity(user.id, 'security', 'Two-Factor Authentication disabled').catch(() => {});
    authService.createNotification(user.id, 'Two-Factor Auth Disabled', 'Two-factor authentication has been removed from your account.', 'warning', 'security').catch(() => {});

    sendJson(res, 200, { success: true });
  } catch (error: any) {
    console.error('[Security] 2FA disable error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to disable 2FA' });
  }
}

/**
 * POST /api/security/protocol-action
 * Execute a protocol action (rotate keys, regenerate SSL, integrity check)
 */
export async function handleProtocolAction(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { sendJson(res, 401, { error: 'Unauthorized' }); return; }
    const user = await authService.validateSession(authHeader.substring(7));
    if (!user) { sendJson(res, 401, { error: 'Invalid session' }); return; }

    const { action } = await parseBody(req);

    switch (action) {
      case 'rotate': {
        const result = securityService.rotateRSAKeys();
        authService.logActivity(user.id, 'security', `RSA keys rotated. Fingerprint: ${result.fingerprint}`).catch(() => {});
        authService.createNotification(user.id, 'RSA Keys Rotated', `New 4096-bit RSA key pair generated. Fingerprint: ${result.fingerprint.substring(0, 20)}...`, 'success', 'security').catch(() => {});
        sendJson(res, 200, { success: true, fingerprint: result.fingerprint, message: 'RSA keys rotated successfully' });
        break;
      }
      case 'ssl': {
        const result = securityService.regenerateSSL();
        authService.logActivity(user.id, 'security', `SSL certificate regenerated. Subject: ${result.subject}`).catch(() => {});
        authService.createNotification(user.id, 'SSL Certificate Regenerated', `New SSL certificate generated. Valid until ${new Date(result.validUntil).toLocaleDateString()}.`, 'success', 'security').catch(() => {});
        sendJson(res, 200, { success: true, ...result, message: 'SSL certificate regenerated' });
        break;
      }
      case 'integrity': {
        const result = await securityService.runIntegrityCheck();
        const status = result.errors.length === 0 ? 'passed' : 'issues found';
        authService.logActivity(user.id, 'security', `Integrity check ${status}: ${result.checkedFiles}/${result.totalFiles} files verified, ${result.errors.length} issues`).catch(() => {});
        authService.createNotification(
          user.id,
          result.errors.length === 0 ? 'Integrity Check Passed' : 'Integrity Check — Issues Found',
          `Checked ${result.checkedFiles} of ${result.totalFiles} files. ${result.errors.length} issues detected.`,
          result.errors.length === 0 ? 'success' : 'warning',
          'security'
        ).catch(() => {});
        sendJson(res, 200, {
          success: true,
          ...result,
          hasIssues: result.errors.length > 0,
          message: result.errors.length === 0
            ? `Integrity check passed — ${result.checkedFiles} files verified, no issues found`
            : `Integrity check complete — ${result.errors.length} issue${result.errors.length !== 1 ? 's' : ''} detected in ${result.checkedFiles} files`
        });
        break;
      }
      default:
        sendJson(res, 400, { error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    console.error('[Security] Protocol action error:', error);
    sendJson(res, 500, { error: error.message || 'Protocol action failed' });
  }
}

/**
 * GET /api/security/status
 * Get the current security status (key info, SSL info, etc.)
 */
export async function handleSecurityStatus(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { sendJson(res, 401, { error: 'Unauthorized' }); return; }
    const user = await authService.validateSession(authHeader.substring(7));
    if (!user) { sendJson(res, 401, { error: 'Invalid session' }); return; }

    const has2FA = await securityService.is2FAEnabled(user.id);
    const rsaInfo = securityService.getRSAKeyInfo();
    const sslInfo = securityService.getSSLInfo();
    const ghostFolders = await securityService.getGhostFolders(user.id);
    const ipAllowlist = await securityService.getIpAllowlist(user.id);

    sendJson(res, 200, {
      twoFactor: { enabled: has2FA },
      rsaKeys: rsaInfo,
      ssl: sslInfo,
      ghostFolders,
      ipAllowlist,
    });
  } catch (error: any) {
    console.error('[Security] Status error:', error);
    sendJson(res, 500, { error: error.message || 'Failed to get security status' });
  }
}

/**
 * POST /api/security/ghost-folders
 * Add a ghost folder
 */
export async function handleAddGhostFolder(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { sendJson(res, 401, { error: 'Unauthorized' }); return; }
    const user = await authService.validateSession(authHeader.substring(7));
    if (!user) { sendJson(res, 401, { error: 'Invalid session' }); return; }

    const { folderPath } = await parseBody(req);
    if (!folderPath) { sendJson(res, 400, { error: 'folderPath is required' }); return; }

    await securityService.addGhostFolder(user.id, folderPath);
    const ghostFolders = await securityService.getGhostFolders(user.id);

    authService.logActivity(user.id, 'security', `Ghost folder added: ${folderPath}`).catch(() => {});
    sendJson(res, 200, { success: true, ghostFolders });
  } catch (error: any) {
    sendJson(res, 500, { error: error.message || 'Failed to add ghost folder' });
  }
}

/**
 * DELETE /api/security/ghost-folders
 * Remove a ghost folder
 */
export async function handleRemoveGhostFolder(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { sendJson(res, 401, { error: 'Unauthorized' }); return; }
    const user = await authService.validateSession(authHeader.substring(7));
    if (!user) { sendJson(res, 401, { error: 'Invalid session' }); return; }

    const { folderPath } = await parseBody(req);
    if (!folderPath) { sendJson(res, 400, { error: 'folderPath is required' }); return; }

    await securityService.removeGhostFolder(user.id, folderPath);
    const ghostFolders = await securityService.getGhostFolders(user.id);

    authService.logActivity(user.id, 'security', `Ghost folder removed: ${folderPath}`).catch(() => {});
    sendJson(res, 200, { success: true, ghostFolders });
  } catch (error: any) {
    sendJson(res, 500, { error: error.message || 'Failed to remove ghost folder' });
  }
}

/**
 * PUT /api/security/ip-allowlist
 * Update the IP allowlist for strict isolation
 */
export async function handleUpdateIpAllowlist(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { sendJson(res, 401, { error: 'Unauthorized' }); return; }
    const user = await authService.validateSession(authHeader.substring(7));
    if (!user) { sendJson(res, 401, { error: 'Invalid session' }); return; }

    const { ips } = await parseBody(req);
    if (!Array.isArray(ips)) { sendJson(res, 400, { error: 'ips must be an array of IP addresses' }); return; }

    await securityService.setIpAllowlist(user.id, ips);

    authService.logActivity(user.id, 'security', `IP allowlist updated: ${ips.length} addresses`).catch(() => {});
    sendJson(res, 200, { success: true, ipAllowlist: ips });
  } catch (error: any) {
    sendJson(res, 500, { error: error.message || 'Failed to update IP allowlist' });
  }
}

// ── Storage transfer: only these subdirectories are transferred ───────────────
const ARCELLITE_DATA_DIRS = ['files', 'photos', 'videos', 'music', 'shared', 'databases', '.trash', 'config'];

// ── Helper: recursively count files under specific subdirectories ─────────────
function countFilesRecursive(baseDir: string, subDirs?: string[]): number {
  const dirsToCount = subDirs
    ? subDirs.map(d => path.join(baseDir, d)).filter(d => fs.existsSync(d))
    : [baseDir];

  let count = 0;
  const countDir = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        countDir(path.join(dir, entry.name));
      } else {
        count++;
      }
    }
  };
  for (const d of dirsToCount) countDir(d);
  return count;
}

// ── Helper: yield to event loop so SSE writes can be flushed ─────────────────
function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

// ── Helper: Phase 1 — recursively COPY all contents from src to dest (async) ──
// Yields to the event loop between file copies so SSE progress events flush.
// Returns { copied: number, failed: string[] }
async function copyContentsRecursive(
  srcDir: string, destDir: string,
  onProgress: (file: string) => void
): Promise<{ copied: number; failed: string[] }> {
  const result = { copied: 0, failed: [] as string[] };
  if (!fs.existsSync(srcDir)) return result;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  let entries: import('fs').Dirent[];
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch (e: any) {
    console.error(`[Storage] Cannot read directory ${srcDir}: ${e.message}`);
    result.failed.push(srcDir);
    return result;
  }

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      const sub = await copyContentsRecursive(srcPath, destPath, onProgress);
      result.copied += sub.copied;
      result.failed.push(...sub.failed);
    } else {
      try {
        // Async copy — does not block the event loop
        await fs.promises.copyFile(srcPath, destPath);
        // Verify: check destination size matches
        const [srcStat, destStat] = await Promise.all([
          fs.promises.stat(srcPath),
          fs.promises.stat(destPath),
        ]);
        if (destStat.size !== srcStat.size) {
          // Size mismatch — remove bad copy, mark as failed
          try { fs.unlinkSync(destPath); } catch {}
          result.failed.push(srcPath);
          console.error(`[Storage] Size mismatch for ${entry.name}: src=${srcStat.size} dest=${destStat.size}`);
        } else {
          result.copied++;
          onProgress(entry.name);
        }
      } catch (e: any) {
        console.error(`[Storage] Failed to copy ${srcPath}: ${e.message}`);
        result.failed.push(srcPath);
        // Continue with next file — don't abort the entire transfer
      }
      // Yield after every file so queued SSE writes can be flushed to the network
      await yieldToEventLoop();
    }
  }
  return result;
}

// ── Helper: Phase 2 — recursively DELETE source files that exist at dest ──────
async function deleteSourceAfterVerifiedCopy(
  srcDir: string, destDir: string
): Promise<void> {
  if (!fs.existsSync(srcDir)) return;

  let entries: import('fs').Dirent[];
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch { return; }

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await deleteSourceAfterVerifiedCopy(srcPath, destPath);
      // Remove dir only if empty now
      try { fs.rmdirSync(srcPath); } catch { /* not empty or permission */ }
    } else {
      // Only delete source if destination file exists with matching size
      try {
        if (fs.existsSync(destPath)) {
          const srcStat = fs.statSync(srcPath);
          const destStat = fs.statSync(destPath);
          if (destStat.size === srcStat.size) {
            await fs.promises.unlink(srcPath);
          }
        }
      } catch { /* leave source intact on any error */ }
      await yieldToEventLoop();
    }
  }
}

/**
 * POST /api/auth/transfer-storage
 * Transfer (move) all files from current storage path to a new one.
 * Uses SSE to stream progress back to the client.
 */
export async function handleTransferStorage(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { sendJson(res, 401, { error: 'Unauthorized' }); return; }
    const user = await authService.validateSession(authHeader.substring(7));
    if (!user) { sendJson(res, 401, { error: 'Invalid session' }); return; }

    // SEC-AUTHZ: Storage transfer is an owner-only operation.
    // Family members have their storage path set at account creation and cannot change it.
    if (user.isFamilyMember) {
      sendJson(res, 403, { error: 'Family members cannot change storage location' });
      return;
    }

    const { newPath } = await parseBody(req);
    if (!newPath || typeof newPath !== 'string') {
      sendJson(res, 400, { error: 'newPath is required' });
      return;
    }

    // Resolve current storage path
    const os = await import('os');
    const currentStoragePath = await authService.getActiveStoragePath();
    let resolvedNew = newPath;
    if (resolvedNew.startsWith('~/') || resolvedNew === '~') {
      resolvedNew = path.join(os.homedir(), resolvedNew.slice(1));
    }

    // Don't transfer to same location
    if (path.resolve(currentStoragePath) === path.resolve(resolvedNew)) {
      sendJson(res, 400, { error: 'New path is the same as current storage path' });
      return;
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendSSE = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // 1. Create directories at new path
      sendSSE('progress', { phase: 'preparing', message: 'Creating directories...', percent: 0 });
      await yieldToEventLoop();
      const dirs = ['files', 'photos', 'videos', 'music', 'shared', 'databases', 'databases/sqlite', '.trash'];
      for (const sub of dirs) {
        const dir = path.join(resolvedNew, sub);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      // 2. Count total files to move (only arcellite data dirs, not .security etc.)
      sendSSE('progress', { phase: 'counting', message: 'Counting files...', percent: 5 });
      await yieldToEventLoop();
      const totalFiles = countFilesRecursive(currentStoragePath, ARCELLITE_DATA_DIRS);

      if (totalFiles === 0) {
        // No files to transfer, just update the path
        sendSSE('progress', { phase: 'updating', message: 'Updating storage path...', percent: 90 });
        await yieldToEventLoop();
      } else {
        // 3. PHASE 1: Copy files with progress (don't delete source yet)
        let copiedCount = 0;
        const allFailed: string[] = [];
        sendSSE('progress', { phase: 'copying', message: `Copying ${totalFiles} files...`, percent: 10, totalFiles });
        await yieldToEventLoop();

        for (const subDir of ARCELLITE_DATA_DIRS) {
          const srcSub = path.join(currentStoragePath, subDir);
          const destSub = path.join(resolvedNew, subDir);
          if (!fs.existsSync(srcSub)) continue;

          const result = await copyContentsRecursive(srcSub, destSub, (fileName) => {
            copiedCount++;
            const percent = Math.round(10 + (copiedCount / totalFiles) * 55);
            // Send SSE update for every file (event loop yields ensure these flush)
            sendSSE('progress', { phase: 'copying', message: `Copying: ${fileName}`, percent, copiedCount, totalFiles });
          });
          allFailed.push(...result.failed);
        }

        // 4. PHASE 2: Verify and delete source files
        sendSSE('progress', { phase: 'verifying', message: 'Verifying copied files...', percent: 70 });

        if (allFailed.length > 0) {
          console.error(`[Storage] ${allFailed.length} files failed to copy:`, allFailed.slice(0, 10));
          sendSSE('progress', { phase: 'verifying', message: `${allFailed.length} file(s) could not be copied — originals preserved`, percent: 72 });
        }

        sendSSE('progress', { phase: 'cleanup', message: 'Removing source files...', percent: 75 });
        for (const subDir of ARCELLITE_DATA_DIRS) {
          const srcSub = path.join(currentStoragePath, subDir);
          const destSub = path.join(resolvedNew, subDir);
          if (!fs.existsSync(srcSub)) continue;
          await deleteSourceAfterVerifiedCopy(srcSub, destSub);
        }

        // 5. Clean up empty dirs from old path (only arcellite data dirs)
        sendSSE('progress', { phase: 'cleanup', message: 'Cleaning up old storage...', percent: 85 });
        try {
          const removeEmptyDirs = (dir: string) => {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory()) {
                removeEmptyDirs(path.join(dir, entry.name));
              }
            }
            const remaining = fs.readdirSync(dir);
            if (remaining.length === 0) {
              try { fs.rmdirSync(dir); } catch { /* ok */ }
            }
          };
          for (const subDir of ARCELLITE_DATA_DIRS) {
            const srcSub = path.join(currentStoragePath, subDir);
            removeEmptyDirs(srcSub);
          }
        } catch (e) {
          console.error('[Storage] Cleanup warning:', e);
        }
      }

      // 6. Update DB storage_path
      sendSSE('progress', { phase: 'updating', message: 'Updating storage configuration...', percent: 92 });
      await authService.updateUserProfile(user.id, { storagePath: newPath });

      // 7. Update global cache
      (globalThis as any).__arcellite_storage_path = resolvedNew;

      // 8. Update storageDevice preference
      const isExternal = resolvedNew.startsWith('/media/') || resolvedNew.startsWith('/mnt/');
      await authService.updateUserSettings(user.id, { storageDevice: isExternal ? 'external' : 'builtin' });

      sendSSE('progress', { phase: 'done', message: 'Transfer complete!', percent: 100, totalFiles });
      sendSSE('done', { success: true, newPath: resolvedNew, totalFiles });

      authService.logActivity(user.id, 'storage', `Storage transferred to: ${newPath} (${totalFiles} files moved)`).catch(() => {});
      authService.createNotification(
        user.id,
        'Storage Transferred',
        `Your files have been moved to ${isExternal ? 'external USB' : 'built-in'} storage. ${totalFiles} files transferred.`,
        'success'
      ).catch(() => {});
    } catch (transferError: any) {
      console.error('[Storage] Transfer error:', transferError);
      sendSSE('error', { error: transferError.message || 'Transfer failed' });
    }

    res.end();
  } catch (error: any) {
    console.error('[Auth] Transfer storage error:', error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: error.message || 'Failed to transfer storage' });
    }
  }
}

/**
 * GET /api/auth/invite-info?token=<hex64>
 * Public — look up a pending invite by token. Returns display info without auth.
 */
export async function handleGetInviteInfo(req: IncomingMessage, res: ServerResponse) {
  try {
    const urlObj = new URL(req.url || '', 'http://localhost');
    const token = urlObj.searchParams.get('token') || '';
    if (!token || !/^[0-9a-f]{64}$/.test(token)) {
      return sendJson(res, 400, { error: 'Invalid token' });
    }
    const { rows } = await pool.query(
      `SELECT fm.name, fm.email, fm.role, fm.storage_quota, fm.status, fm.user_id,
              u.first_name AS owner_first, u.last_name AS owner_last
       FROM family_members fm
       JOIN users u ON fm.owner_id = u.id
       WHERE fm.invite_token = $1`,
      [token],
    );
    if (!rows.length) return sendJson(res, 404, { error: 'Invite not found or expired' });
    const r = rows[0];
    if (r.status === 'active' || r.user_id !== null) {
      return sendJson(res, 409, { error: 'This invitation has already been accepted' });
    }
    sendJson(res, 200, {
      name: r.name,
      email: r.email,
      role: r.role,
      storageQuota: Number(r.storage_quota),
      ownerName: [r.owner_first, r.owner_last].filter(Boolean).join(' ') || 'Server Owner',
    });
  } catch (e) {
    console.error('[Auth] Invite info error:', e);
    sendJson(res, 500, { error: 'Failed to look up invite' });
  }
}

/**
 * POST /api/auth/accept-invite
 * Public (rate-limited) — create a real user account from a pending invite.
 */
export async function handleAcceptInvite(req: IncomingMessage, res: ServerResponse) {
  if (!checkRateLimit(req)) {
    return sendJson(res, 429, { error: 'Too many requests. Please wait.' });
  }
  try {
    const { token, firstName, lastName, password } = await parseBody(req);

    if (!token || !firstName?.trim() || !lastName?.trim() || !password) {
      return sendJson(res, 400, { error: 'All fields are required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return sendJson(res, 400, { error: 'Password must be at least 8 characters' });
    }
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
      return sendJson(res, 400, { error: 'Invalid invite token' });
    }

    // Look up the invite together with the owner's storage path
    const { rows: memberRows } = await pool.query(
      `SELECT fm.id, fm.email, fm.owner_id, fm.status, fm.user_id,
              u.storage_path AS owner_storage_path
       FROM family_members fm
       JOIN users u ON fm.owner_id = u.id
       WHERE fm.invite_token = $1`,
      [token],
    );
    if (!memberRows.length) return sendJson(res, 404, { error: 'Invite not found or expired' });
    const member = memberRows[0];
    if (member.status === 'active' || member.user_id !== null) {
      return sendJson(res, 409, { error: 'Invitation already accepted' });
    }

    // Guard: email must not already exist in users
    const { rows: existing } = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [member.email],
    );
    if (existing.length) {
      return sendJson(res, 409, { error: 'An account with this email already exists' });
    }

    // Create user account with isolated storage subdirectory
    const user = await authService.createFamilyUser({
      email: member.email,
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      ownerStoragePath: member.owner_storage_path,
    });

    // Activate family_members row — clear token (single-use)
    await pool.query(
      `UPDATE family_members
       SET user_id = $1, status = 'active', invite_token = NULL, updated_at = NOW()
       WHERE id = $2`,
      [user.id, member.id],
    );

    // Create session
    const ua = req.headers['user-agent'] || '';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress || '';
    const session = await authService.createSession(user.id, { userAgent: ua, ipAddress: ip });

    authService.logActivity(user.id, 'register', 'Family member account created').catch(() => {});

    sendJson(res, 201, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSetupComplete: true,
        emailVerified: true,
        isFamilyMember: true,
      },
      sessionToken: session.sessionToken,
    });
  } catch (e: any) {
    console.error('[Auth] Accept invite error:', e);
    sendJson(res, 500, { error: e.message || 'Failed to accept invitation' });
  }
}

// ── Storage Request Endpoints (family members request more storage) ──────────

function formatBytesUtil(bytes: number): string {
  if (bytes >= 1024 ** 4) return (bytes / 1024 ** 4).toFixed(1) + ' TB';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

/** Ensure storage_requests table exists */
async function ensureStorageRequestsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS storage_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      family_member_id INTEGER,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      requested_bytes BIGINT NOT NULL,
      reason TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      admin_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    )
  `);
}

/**
 * POST /api/storage/request — Family member requests more storage
 */
export async function handleStorageRequest(req: IncomingMessage, res: ServerResponse) {
  const user = (req as any).user;
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  try {
    await ensureStorageRequestsTable();

    const body = await parseBody(req);
    const { requestedBytes, reason } = body;

    if (!requestedBytes || requestedBytes <= 0) {
      return sendJson(res, 400, { error: 'Invalid requested amount' });
    }

    // Find the family_member row and the owner
    const { rows: fmRows } = await pool.query(
      `SELECT fm.id, fm.owner_id FROM family_members fm WHERE fm.user_id = $1 AND fm.status = 'active' LIMIT 1`,
      [user.id],
    );
    if (!fmRows.length) {
      return sendJson(res, 403, { error: 'Only family members can request storage' });
    }

    const fm = fmRows[0];

    // Check for existing pending request
    const { rows: pendingRows } = await pool.query(
      `SELECT id FROM storage_requests WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
      [user.id],
    );
    if (pendingRows.length > 0) {
      return sendJson(res, 409, { error: 'You already have a pending storage request' });
    }

    // Create request
    await pool.query(
      `INSERT INTO storage_requests (user_id, family_member_id, owner_id, requested_bytes, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, fm.id, fm.owner_id, requestedBytes, reason || null],
    );

    // Notify the admin/owner
    const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    await authService.createNotification(
      fm.owner_id,
      'Storage Request',
      `${userName} requested ${formatBytesUtil(requestedBytes)} of additional storage.${reason ? ' Reason: ' + reason : ''}`,
      'info',
      'storage',
    );

    sendJson(res, 201, { success: true });
  } catch (e: any) {
    console.error('[Storage] Request error:', e);
    sendJson(res, 500, { error: 'Failed to submit request' });
  }
}

/**
 * GET /api/storage/requests — Get storage requests for the current user
 * Family members see their own requests; admin/owner sees all requests for their family.
 */
export async function handleGetStorageRequests(req: IncomingMessage, res: ServerResponse) {
  const user = (req as any).user;
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  try {
    await ensureStorageRequestsTable();

    // Check if family member
    const { rows: fmRows } = await pool.query(
      `SELECT id, owner_id FROM family_members WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [user.id],
    );

    let rows: any[];
    if (fmRows.length > 0) {
      // Family member: own requests
      const result = await pool.query(
        `SELECT id, requested_bytes, reason, status, admin_note, created_at, resolved_at
         FROM storage_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [user.id],
      );
      rows = result.rows;
    } else {
      // Owner : all requests from their family
      const result = await pool.query(
        `SELECT sr.id, sr.requested_bytes, sr.reason, sr.status, sr.admin_note,
                sr.created_at, sr.resolved_at, sr.user_id, sr.family_member_id,
                u.first_name, u.last_name, u.email
         FROM storage_requests sr
         JOIN users u ON sr.user_id = u.id
         WHERE sr.owner_id = $1
         ORDER BY sr.created_at DESC LIMIT 100`,
        [user.id],
      );
      rows = result.rows;
    }

    sendJson(res, 200, {
      requests: rows.map((r: any) => ({
        id: r.id,
        requestedBytes: Number(r.requested_bytes),
        requestedHuman: formatBytesUtil(Number(r.requested_bytes)),
        reason: r.reason,
        status: r.status,
        adminNote: r.admin_note,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
        ...(r.first_name !== undefined ? {
          userName: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email,
          userEmail: r.email,
          familyMemberId: r.family_member_id || null,
        } : {}),
      })),
    });
  } catch (e: any) {
    console.error('[Storage] Get requests error:', e);
    sendJson(res, 500, { error: 'Failed to fetch requests' });
  }
}

/**
 * PUT /api/storage/requests/:id — Admin approves or denies a storage request
 * Body: { action: 'approve' | 'deny', note?: string }
 */
export async function handleResolveStorageRequest(req: IncomingMessage, res: ServerResponse) {
  const user = (req as any).user;
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  try {
    await ensureStorageRequestsTable();

    const urlMatch = (req.url || '').match(/\/api\/storage\/requests\/(\d+)/);
    const requestId = urlMatch ? parseInt(urlMatch[1], 10) : 0;
    if (!requestId) return sendJson(res, 400, { error: 'Invalid request ID' });

    const body = await parseBody(req);
    const { action, note } = body;

    if (action !== 'approve' && action !== 'deny') {
      return sendJson(res, 400, { error: 'Action must be "approve" or "deny"' });
    }

    // Verify the request belongs to one of this user's family members
    const { rows: reqRows } = await pool.query(
      `SELECT sr.id, sr.user_id, sr.family_member_id, sr.requested_bytes, sr.status
       FROM storage_requests sr
       WHERE sr.id = $1 AND sr.owner_id = $2`,
      [requestId, user.id],
    );
    if (!reqRows.length) return sendJson(res, 404, { error: 'Request not found' });

    const storageReq = reqRows[0];
    if (storageReq.status !== 'pending') {
      return sendJson(res, 400, { error: 'Request already resolved' });
    }

    if (action === 'approve') {
      // Pool capacity validation: ensure approving won't exceed the owner's configured sharing pool
      const poolSettingsRes = await pool.query(
        `SELECT COALESCE((preferences->>'familySharingPool')::bigint, 0) AS pool_size
         FROM user_settings WHERE user_id = $1`,
        [user.id],
      );
      const poolSize = Number(poolSettingsRes.rows[0]?.pool_size ?? 0);

      if (poolSize > 0) {
        // Current quota of this specific member
        const memberQuotaRes = await pool.query(
          `SELECT storage_quota FROM family_members WHERE id = $1`,
          [storageReq.family_member_id],
        );
        const currentMemberQuota = Number(memberQuotaRes.rows[0]?.storage_quota ?? 0);

        // Total allocated to all OTHER members
        const allocatedRes = await pool.query(
          `SELECT COALESCE(SUM(storage_quota), 0)::bigint AS allocated
           FROM family_members WHERE owner_id = $1 AND id != $2`,
          [user.id, storageReq.family_member_id],
        );
        const otherAllocated = Number(allocatedRes.rows[0].allocated);

        const newMemberQuota = currentMemberQuota + Number(storageReq.requested_bytes);
        const totalAfterApproval = otherAllocated + newMemberQuota;

        if (totalAfterApproval > poolSize) {
          const available = Math.max(poolSize - otherAllocated - currentMemberQuota, 0);
          return sendJson(res, 400, {
            error: `Cannot approve: only ${formatBytesUtil(available)} remaining in the sharing pool. ` +
              `The member is requesting ${formatBytesUtil(Number(storageReq.requested_bytes))}.`,
          });
        }
      }

      // Increase the family member's storage quota
      await pool.query(
        `UPDATE family_members SET storage_quota = storage_quota + $1 WHERE id = $2`,
        [storageReq.requested_bytes, storageReq.family_member_id],
      );
    }

    // Update request status
    await pool.query(
      `UPDATE storage_requests SET status = $1, admin_note = $2, resolved_at = NOW() WHERE id = $3`,
      [action === 'approve' ? 'approved' : 'denied', note || null, requestId],
    );

    // Notify the family member
    const actionLabel = action === 'approve' ? 'approved' : 'denied';
    await authService.createNotification(
      storageReq.user_id,
      `Storage Request ${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)}`,
      `Your request for ${formatBytesUtil(Number(storageReq.requested_bytes))} has been ${actionLabel}.${note ? ' Note: ' + note : ''}`,
      action === 'approve' ? 'success' : 'warning',
      'storage',
    );

    sendJson(res, 200, { success: true });
  } catch (e: any) {
    console.error('[Storage] Resolve request error:', e);
    sendJson(res, 500, { error: 'Failed to resolve request' });
  }
}

/**
 * DELETE /api/storage/requests/:id — Family member cancels their own pending request
 */
export async function handleCancelStorageRequest(req: IncomingMessage, res: ServerResponse) {
  const user = (req as any).user;
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  try {
    await ensureStorageRequestsTable();

    const urlMatch = (req.url || '').match(/\/api\/storage\/requests\/(\d+)/);
    const requestId = urlMatch ? parseInt(urlMatch[1], 10) : 0;
    if (!requestId || isNaN(requestId)) return sendJson(res, 400, { error: 'Invalid request ID' });

    // Fetch request to verify ownership and status before deleting
    const { rows } = await pool.query(
      `SELECT id, user_id, status FROM storage_requests WHERE id = $1`,
      [requestId],
    );
    if (!rows.length) return sendJson(res, 404, { error: 'Request not found' });

    const storageReq = rows[0];
    // Security: only the creator may cancel their own request
    if (storageReq.user_id !== user.id) return sendJson(res, 403, { error: 'Not authorized to cancel this request' });
    if (storageReq.status !== 'pending') return sendJson(res, 400, { error: 'Only pending requests can be cancelled' });

    await pool.query(`DELETE FROM storage_requests WHERE id = $1`, [requestId]);

    sendJson(res, 200, { success: true });
  } catch (e: any) {
    console.error('[Storage] Cancel request error:', e);
    sendJson(res, 500, { error: 'Failed to cancel request' });
  }
}

/**
 * GET /api/storage/breakdown — Category breakdown for family member's storage
 */
export async function handleStorageBreakdown(req: IncomingMessage, res: ServerResponse) {
  const user = (req as any).user;
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  try {
    let baseDir = user.storagePath as string;
    if (!baseDir || baseDir === 'pending') {
      return sendJson(res, 200, { categories: [] });
    }
    if (baseDir.startsWith('~/') || baseDir === '~') {
      const os = await import('os');
      baseDir = path.join(os.homedir(), baseDir.slice(baseDir === '~' ? 1 : 2));
    }

    const categories = [
      { label: 'Photos', folder: 'photos', color: '#3B82F6' },
      { label: 'Videos', folder: 'videos', color: '#EF4444' },
      { label: 'Music',  folder: 'music',  color: '#EC4899' },
      { label: 'Files',  folder: 'files',  color: '#F59E0B' },
    ];

    const results = [];
    for (const cat of categories) {
      const catPath = path.join(baseDir, cat.folder);
      let bytes = 0;
      try {
        bytes = calcDirSizeSync(catPath);
      } catch { /* folder doesn't exist yet */ }
      if (bytes > 0) {
        results.push({ label: cat.label, bytes, color: cat.color });
      }
    }

    sendJson(res, 200, { categories: results });
  } catch (e: any) {
    console.error('[Storage] Breakdown error:', e);
    sendJson(res, 200, { categories: [] });
  }
}

/** Recursively calculate directory size */
function calcDirSizeSync(dir: string): number {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) total += calcDirSizeSync(full);
      else if (entry.isFile()) {
        try { total += fs.statSync(full).size; } catch {}
      }
    }
  } catch {}
  return total;
}

/**
 * POST /api/auth/avatar
 * Upload avatar image for the authenticated user
 */
export async function handleAvatarUpload(req: IncomingMessage, res: ServerResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const user = await authService.validateSession(sessionToken);
    if (!user) {
      sendJson(res, 401, { error: 'Invalid or expired session' });
      return;
    }

    const dataDir = await authService.getActiveStoragePath();
    const avatarsDir = path.join(dataDir, 'avatars');
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    const busboy = Busboy({ headers: req.headers as any, limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
    let savedPath = '';
    let savedExt = '';
    let uploadError: Error | null = null;
    const writePromises: Promise<void>[] = [];

    busboy.on('file', (_name: string, file: any, info: { filename: string; mimeType: string }) => {
      const mime = info.mimeType || '';
      if (!mime.startsWith('image/')) {
        uploadError = new Error('Only image files are allowed');
        file.resume();
        return;
      }

      const extMap: Record<string, string> = {
        'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
        'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif',
      };
      savedExt = extMap[mime] || path.extname(info.filename) || '.jpg';

      // Remove old avatar files for this user
      try {
        const existing = fs.readdirSync(avatarsDir).filter(f => f.startsWith(`user-${user.id}.`));
        for (const f of existing) {
          try { fs.unlinkSync(path.join(avatarsDir, f)); } catch {}
        }
      } catch {}

      savedPath = path.join(avatarsDir, `user-${user.id}${savedExt}`);
      const writeStream = fs.createWriteStream(savedPath);
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
        if (!savedPath) throw new Error('No file received');

        // Update avatar_url in database to our serve endpoint
        const avatarUrl = `/api/auth/avatar/${user.id}`;
        await authService.updateUserProfile(user.id, { avatarUrl });

        sendJson(res, 200, { success: true, avatarUrl });
      } catch (e) {
        if (savedPath) try { fs.unlinkSync(savedPath); } catch {}
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String((e as Error).message) }));
      }
    });

    busboy.on('error', (e: Error) => {
      if (savedPath) try { fs.unlinkSync(savedPath); } catch {}
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String(e.message) }));
    });

    req.pipe(busboy);
  } catch (error: any) {
    console.error('[Auth] Avatar upload error:', error);
    sendJson(res, 500, { error: error.message || 'Avatar upload failed' });
  }
}

/**
 * GET /api/auth/avatar/:userId
 * Serve avatar image for a user
 */
export async function handleAvatarServe(req: IncomingMessage, res: ServerResponse) {
  try {
    // Extract userId from URL
    const urlPath = req.url || '';
    const match = urlPath.match(/\/api\/auth\/avatar\/(\d+)/);
    if (!match) {
      res.statusCode = 400;
      res.end('Bad request');
      return;
    }

    const userId = parseInt(match[1], 10);
    const dataDir = await authService.getActiveStoragePath();
    const avatarsDir = path.join(dataDir, 'avatars');

    // Find the avatar file for this user
    let avatarFile = '';
    try {
      const files = fs.readdirSync(avatarsDir).filter(f => f.startsWith(`user-${userId}.`));
      if (files.length > 0) avatarFile = path.join(avatarsDir, files[0]);
    } catch {}

    if (!avatarFile || !fs.existsSync(avatarFile)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const ext = path.extname(avatarFile).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.avif': 'image/avif',
    };

    const stat = fs.statSync(avatarFile);
    res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.statusCode = 200;

    const stream = fs.createReadStream(avatarFile);
    stream.on('error', () => { if (!res.headersSent) { res.statusCode = 500; } res.end(); });
    stream.pipe(res);
  } catch (error: any) {
    console.error('[Auth] Avatar serve error:', error);
    res.statusCode = 500;
    res.end('Internal server error');
  }
}
