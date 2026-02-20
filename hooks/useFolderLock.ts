import { useState, useEffect, useRef, useCallback } from 'react';

interface FolderLockParams {
  setActiveTab: (tab: string) => void;
  setCurrentFolderId: (id: string | null) => void;
  handleNavigate: (id: string | null) => void;
  activeTab: string;
}

export function useFolderLock({ setActiveTab, setCurrentFolderId, handleNavigate, activeTab }: FolderLockParams) {
  const [lockedFolders, setLockedFolders] = useState<string[]>([]);
  const [folderLockPin, setFolderLockPin] = useState('');
  const [ghostFolders, setGhostFolders] = useState<string[]>([]);
  const [folderLockPrompt, setFolderLockPrompt] = useState<{ show: boolean; folderPath: string; folderId: string }>({
    show: false, folderPath: '', folderId: '',
  });
  const [folderLockInput, setFolderLockInput] = useState('');
  const [folderLockError, setFolderLockError] = useState('');
  const [folderLockAttempts, setFolderLockAttempts] = useState(0);
  const [folderLockoutUntil, setFolderLockoutUntil] = useState<number | null>(null);
  const [folderLockoutLevel, setFolderLockoutLevel] = useState(0);
  const [folderLockCountdown, setFolderLockCountdown] = useState('');

  const folderLockAttemptsRef = useRef(0);
  const folderLockoutUntilRef = useRef<number | null>(null);
  const folderLockoutLevelRef = useRef(0);
  const folderLockCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore lockout state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('arcellite_folder_lockout');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.until && data.until > Date.now()) {
          folderLockoutUntilRef.current = data.until;
          folderLockoutLevelRef.current = data.level || 0;
          folderLockAttemptsRef.current = 4;
          setFolderLockoutUntil(data.until);
          setFolderLockoutLevel(data.level || 0);
          setFolderLockAttempts(4);
        } else {
          localStorage.removeItem('arcellite_folder_lockout');
          if (data.level) {
            folderLockoutLevelRef.current = data.level;
            setFolderLockoutLevel(data.level);
          }
        }
      }
    } catch {}
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (folderLockCountdownRef.current) {
      clearInterval(folderLockCountdownRef.current);
      folderLockCountdownRef.current = null;
    }
    if (!folderLockoutUntil) { setFolderLockCountdown(''); return; }

    const tick = () => {
      const remaining = folderLockoutUntilRef.current ? folderLockoutUntilRef.current - Date.now() : 0;
      if (remaining <= 0) {
        setFolderLockoutUntil(null);
        folderLockoutUntilRef.current = null;
        setFolderLockCountdown('');
        if (folderLockCountdownRef.current) clearInterval(folderLockCountdownRef.current);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setFolderLockCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    tick();
    folderLockCountdownRef.current = setInterval(tick, 1000);
    return () => { if (folderLockCountdownRef.current) clearInterval(folderLockCountdownRef.current); };
  }, [folderLockoutUntil]);

  const promptFolderUnlock = useCallback((folderPath: string, folderId: string) => {
    setFolderLockPrompt({ show: true, folderPath, folderId });
    setFolderLockInput('');
    setFolderLockError('');
  }, []);

  const handleFolderLockPinSubmit = useCallback(() => {
    if (folderLockoutUntilRef.current && folderLockoutUntilRef.current > Date.now()) return;

    if (folderLockInput !== folderLockPin) {
      const newAttempts = folderLockAttemptsRef.current + 1;
      folderLockAttemptsRef.current = newAttempts;
      setFolderLockAttempts(newAttempts);

      if (newAttempts >= 4) {
        const newLevel = folderLockoutLevelRef.current + 1;
        const lockoutMs = Math.pow(2, newLevel - 1) * 60 * 1000;
        const until = Date.now() + lockoutMs;
        folderLockoutLevelRef.current = newLevel;
        folderLockoutUntilRef.current = until;
        setFolderLockoutLevel(newLevel);
        setFolderLockoutUntil(until);
        const mins = Math.pow(2, newLevel - 1);
        setFolderLockError(`Too many failed attempts. Locked for ${mins} minute${mins > 1 ? 's' : ''}.`);
        setFolderLockInput('');
        localStorage.setItem('arcellite_folder_lockout', JSON.stringify({ until, level: newLevel }));
      } else if (newAttempts === 3) {
        setFolderLockError('Incorrect PIN — 1 attempt remaining');
      } else {
        setFolderLockError(`Incorrect PIN — ${4 - newAttempts} attempts remaining`);
      }
      return;
    }

    // PIN correct
    folderLockAttemptsRef.current = 0;
    setFolderLockAttempts(0);
    const folderId = folderLockPrompt.folderId;
    if (activeTab === 'overview') {
      const cat = folderId.split('-')[1];
      if (cat === 'media') setActiveTab('photos');
      else if (cat === 'video_vault') setActiveTab('videos');
      else setActiveTab('all');
      setCurrentFolderId(folderId);
    } else {
      handleNavigate(folderId);
    }
    setFolderLockPrompt({ show: false, folderPath: '', folderId: '' });
    setFolderLockInput('');
    setFolderLockError('');
  }, [folderLockInput, folderLockPin, folderLockPrompt.folderId, activeTab, handleNavigate, setActiveTab, setCurrentFolderId]);

  const initFromSettings = (settings: Record<string, any>) => {
    if (settings.secLockedFolders) setLockedFolders(settings.secLockedFolders);
    if (settings.secFolderLockPin) setFolderLockPin(settings.secFolderLockPin);
  };

  const initFromSecurity = (secStatus: { ghostFolders?: string[] }) => {
    setGhostFolders(secStatus.ghostFolders || []);
  };

  return {
    lockedFolders,
    setLockedFolders,
    folderLockPin,
    setFolderLockPin,
    ghostFolders,
    setGhostFolders,
    folderLockPrompt,
    setFolderLockPrompt,
    folderLockInput,
    setFolderLockInput,
    folderLockError,
    setFolderLockError,
    folderLockAttempts,
    folderLockoutUntil,
    folderLockoutLevel,
    folderLockCountdown,
    promptFolderUnlock,
    handleFolderLockPinSubmit,
    initFromSettings,
    initFromSecurity,
  };
}
