import { useState, useEffect, useRef } from 'react';

export function useScreenLock() {
  const [isScreenLocked, setIsScreenLocked] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('arcellite_screen_locked') === 'true'
  );
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState(5);
  const [autoLockPin, setAutoLockPin] = useState('');
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist lock state to localStorage (cross-tab)
  useEffect(() => {
    if (isScreenLocked) {
      localStorage.setItem('arcellite_screen_locked', 'true');
    } else {
      localStorage.removeItem('arcellite_screen_locked');
    }
  }, [isScreenLocked]);

  // Sync lock across all browser tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'arcellite_screen_locked') {
        setIsScreenLocked(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const initFromSettings = (settings: Record<string, any>) => {
    if (settings.secAutoLock) {
      setAutoLockEnabled(true);
      setAutoLockTimeout(settings.secAutoLockTimeout ?? 5);
      setAutoLockPin(settings.secAutoLockPin ?? '');
    } else {
      setAutoLockEnabled(false);
    }
  };

  return {
    isScreenLocked,
    setIsScreenLocked,
    autoLockEnabled,
    setAutoLockEnabled,
    autoLockTimeout,
    setAutoLockTimeout,
    autoLockPin,
    setAutoLockPin,
    autoLockTimerRef,
    initFromSettings,
  };
}
