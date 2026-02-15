/**
 * API Client
 * Handles API requests with automatic session token management
 */

const API_BASE = '';

let sessionToken: string | null = localStorage.getItem('sessionToken');

export function setSessionToken(token: string | null) {
  sessionToken = token;
  if (token) {
    localStorage.setItem('sessionToken', token);
  } else {
    localStorage.removeItem('sessionToken');
  }
}

export function getSessionToken(): string | null {
  return sessionToken;
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

// Auth API
export const authApi = {
  register: (email: string, password: string, firstName?: string, lastName?: string) =>
    apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    }).then((data) => {
      if (data.sessionToken) {
        setSessionToken(data.sessionToken);
      }
      return data;
    }),

  login: (email: string, password: string, totpCode?: string) =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totpCode }),
    }).then((data) => {
      if (data.requires2FA) {
        // Return 2FA challenge — no session token yet
        return data;
      }
      if (data.sessionToken) {
        setSessionToken(data.sessionToken);
      }
      return data;
    }),

  verifyEmail: (code: string) =>
    apiRequest('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  resendCode: () =>
    apiRequest('/api/auth/resend-code', { method: 'POST' }),

  getCurrentUser: () =>
    apiRequest('/api/auth/me'),

  logout: () =>
    apiRequest('/api/auth/logout', { method: 'POST' }).then(() => {
      setSessionToken(null);
    }),

  updateProfile: (updates: { firstName?: string; lastName?: string; avatarUrl?: string; storagePath?: string }) =>
    apiRequest('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  completeSetup: () =>
    apiRequest('/api/auth/complete-setup', { method: 'POST' }),

  getActivityLog: (limit: number = 50) =>
    apiRequest(`/api/auth/activity?limit=${limit}`),

  getRecentFiles: (limit: number = 20) =>
    apiRequest(`/api/files/recent?limit=${limit}`),

  trackRecentFile: (data: { filePath: string; fileName: string; fileType?: string; category?: string; sizeBytes?: number }) =>
    apiRequest('/api/files/track-recent', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSessions: () =>
    apiRequest('/api/auth/sessions'),

  revokeSession: (sessionId: number) =>
    apiRequest(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' }),

  deleteAccount: () =>
    apiRequest('/api/auth/account', { method: 'DELETE' }),

  getSettings: () =>
    apiRequest('/api/auth/settings'),

  updateSettings: (settings: {
    notificationsEnabled?: boolean; autoMirroring?: boolean; vaultLockdown?: boolean; storageDevice?: string;
    aiFileCreate?: boolean; aiFileModify?: boolean; aiFileDelete?: boolean; aiFolderCreate?: boolean;
    aiFileOrganize?: boolean; aiTrashAccess?: boolean; aiTrashRestore?: boolean; aiTrashEmpty?: boolean;
    aiDatabaseCreate?: boolean; aiDatabaseDelete?: boolean; aiDatabaseQuery?: boolean;
    aiSendEmail?: boolean; aiCastMedia?: boolean; aiFileRead?: boolean;
    aiAutoRename?: boolean; pdfThumbnails?: boolean;
    secTwoFactor?: boolean; secFileObfuscation?: boolean; secGhostFolders?: boolean;
    secTrafficMasking?: boolean; secStrictIsolation?: boolean;
  }) =>
    apiRequest('/api/auth/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  getNotifications: (limit: number = 30) =>
    apiRequest(`/api/notifications?limit=${limit}`),

  markNotificationRead: (notificationId: number) =>
    apiRequest(`/api/notifications/${notificationId}/read`, { method: 'PUT' }),

  markAllNotificationsRead: () =>
    apiRequest('/api/notifications/read-all', { method: 'PUT' }),

  clearAllNotifications: () =>
    apiRequest('/api/notifications/clear-all', { method: 'DELETE' }),

  // Security Vault API
  setup2FA: () =>
    apiRequest('/api/security/2fa/setup', { method: 'POST' }),

  verify2FA: (code: string) =>
    apiRequest('/api/security/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  disable2FA: (code?: string) =>
    apiRequest('/api/security/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  runProtocolAction: (action: string) =>
    apiRequest('/api/security/protocol-action', {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  getSecurityStatus: () =>
    apiRequest('/api/security/status'),

  addGhostFolder: (folderPath: string) =>
    apiRequest('/api/security/ghost-folders', {
      method: 'POST',
      body: JSON.stringify({ folderPath }),
    }),

  removeGhostFolder: (folderPath: string) =>
    apiRequest('/api/security/ghost-folders', {
      method: 'DELETE',
      body: JSON.stringify({ folderPath }),
    }),

  updateIpAllowlist: (ips: string[]) =>
    apiRequest('/api/security/ip-allowlist', {
      method: 'PUT',
      body: JSON.stringify({ ips }),
    }),
};
