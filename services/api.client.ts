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

  login: (email: string, password: string) =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((data) => {
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

  updateSettings: (settings: { notificationsEnabled?: boolean; autoMirroring?: boolean; vaultLockdown?: boolean; storageDevice?: string }) =>
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
};
