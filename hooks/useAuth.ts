import { useState, useEffect } from 'react';
import type { UserData } from '@/types';
import { authApi, setSessionToken, getSessionToken } from '@/services/api.client';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [showAccessDenied, setShowAccessDenied] = useState(() => {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('accessDenied') === 'ip') {
        sessionStorage.removeItem('accessDenied');
        return true;
      }
    } catch {}
    return false;
  });
  const [accessStatus, setAccessStatus] = useState<'pending' | 'login' | 'denied'>('pending');

  // Pre-auth: check if this IP is allowed to see the login page
  useEffect(() => {
    if (checkingSetup || isAuthenticated || setupNeeded || showAccessDenied || accessStatus !== 'pending') return;
    let cancelled = false;
    fetch('/api/auth/access-status')
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setAccessStatus(data.access === 'denied' ? 'denied' : 'login'); })
      .catch(() => { if (!cancelled) setAccessStatus('login'); });
    return () => { cancelled = true; };
  }, [checkingSetup, isAuthenticated, setupNeeded, showAccessDenied, accessStatus]);

  // Check setup status and restore session on mount
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const response = await fetch('/api/auth/setup-status');
        const data = await response.json();
        if (data.setupNeeded) {
          setSetupNeeded(true);
        } else if (getSessionToken()) {
          try {
            const { user } = await authApi.getCurrentUser();
            setCurrentUser(user);
            if (user.isSetupComplete === false) {
              setSetupNeeded(true);
            } else {
              setIsAuthenticated(true);
            }
          } catch {
            setSessionToken(null);
          }
        }
      } catch {
        // Silent
      } finally {
        setCheckingSetup(false);
      }
    };
    checkSetup();
  }, []);

  const handleLogin = async () => {
    try {
      const { user } = await authApi.getCurrentUser();
      setCurrentUser(user);
    } catch {}
    setIsAuthenticated(true);
  };

  const handleSignOut = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('connectedApps');
    localStorage.removeItem('connectedAppIds');
    localStorage.removeItem('mountedDevice');
    localStorage.removeItem('myapps_state');
    localStorage.removeItem('activeTab');
    localStorage.removeItem('theme');
    localStorage.removeItem('arcellite_screen_locked');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const handleDeleteAccount = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setSetupNeeded(true);
  };

  return {
    isAuthenticated,
    currentUser,
    setupNeeded,
    checkingSetup,
    showAccessDenied,
    accessStatus,
    setCurrentUser,
    setIsAuthenticated,
    setSetupNeeded,
    setShowAccessDenied,
    handleLogin,
    handleSignOut,
    handleDeleteAccount,
  };
}
