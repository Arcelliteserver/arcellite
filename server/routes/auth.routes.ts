/**
 * Authentication Routes
 * Handles all authentication-related API endpoints
 */

import type { IncomingMessage, ServerResponse } from 'http';
import * as authService from '../services/auth.service.js';
import { sendVerificationEmail } from '../services/email.service.js';
import { ensureBaseExists } from '../files.js';

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

/**
 * POST /api/auth/register
 * Create new admin user (only if no users exist)
 */
export async function handleRegister(req: IncomingMessage, res: ServerResponse) {
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
  try {
    const { email, password } = await parseBody(req);

    if (!email || !password) {
      sendJson(res, 400, { error: 'Email and password are required' });
      return;
    }

    const user = await authService.authenticateUser(email, password);

    if (!user) {
      sendJson(res, 401, { error: 'Invalid email or password' });
      return;
    }

    const loginUa = req.headers['user-agent'] || '';
    const loginIp = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || '';
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

    sendJson(res, 200, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        isSetupComplete: user.isSetupComplete,
        emailVerified: user.emailVerified,
      },
      sessionToken: session.sessionToken,
    });
  } catch (error: any) {
    console.error('[Auth] Login error:', error);
    sendJson(res, 500, { error: error.message || 'Login failed' });
  }
}

/**
 * POST /api/auth/verify-email
 * Verify email with code
 */
export async function handleVerifyEmail(req: IncomingMessage, res: ServerResponse) {
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

    await authService.updateUserProfile(user.id, {
      firstName,
      lastName,
      avatarUrl,
      storagePath,
    });

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

    await authService.deleteAccount(user.id);
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
    const { notificationsEnabled, autoMirroring, vaultLockdown, storageDevice } = body;

    await authService.updateUserSettings(user.id, {
      notificationsEnabled,
      autoMirroring,
      vaultLockdown,
      storageDevice,
    });

    // Log the settings change
    const changedFields: string[] = [];
    if (notificationsEnabled !== undefined) changedFields.push(`Notifications: ${notificationsEnabled ? 'enabled' : 'disabled'}`);
    if (autoMirroring !== undefined) changedFields.push(`Auto Mirroring: ${autoMirroring ? 'enabled' : 'disabled'}`);
    if (vaultLockdown !== undefined) changedFields.push(`Vault Lockdown: ${vaultLockdown ? 'enabled' : 'disabled'}`);
    if (storageDevice !== undefined) changedFields.push(`Storage: ${storageDevice}`);

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
