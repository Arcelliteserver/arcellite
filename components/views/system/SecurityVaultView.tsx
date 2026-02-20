import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock, ShieldCheck, Key, Activity, RefreshCw, AlertTriangle, ShieldAlert, ChevronRight, Loader2, CheckCircle2, XCircle, Copy, Check, Trash2, Plus, FolderClosed, Timer, FolderLock, ChevronDown, Folder, EyeOff, Eye, Shield } from 'lucide-react';
import { authApi } from '@/services/api.client';

interface SessionData {
  id: number;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  isCurrentHost: boolean;
  isCurrent: boolean;
  createdAt: string;
  lastActivity: string;
}

interface SecuritySettings {
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
}

interface SecurityVaultViewProps {
  onAutoLockChange?: (enabled: boolean, timeout: number, pin: string) => void;
  onFolderLockChange?: (enabled: boolean, lockedFolders: string[], pin: string) => void;
}

const SecurityVaultView: React.FC<SecurityVaultViewProps> = ({ onAutoLockChange, onFolderLockChange }) => {
  const [settings, setSettings] = useState<SecuritySettings>({
    secTwoFactor: false,
    secFileObfuscation: false,
    secGhostFolders: false,
    secTrafficMasking: false,
    secStrictIsolation: false,
    secAutoLock: false,
    secAutoLockTimeout: 5,
    secAutoLockPin: '',
    secFolderLock: false,
    secFolderLockPin: '',
    secLockedFolders: [],
  });
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ action: string; success: boolean | 'warning'; message: string } | null>(null);
  // 2FA setup state
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [totpUri, setTotpUri] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  // Ghost folder management
  const [ghostFolders, setGhostFolders] = useState<string[]>([]);
  const [newGhostFolder, setNewGhostFolder] = useState('');
  const [ghostLoading, setGhostLoading] = useState(false);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);

  // Auto-lock settings
  const [autoLockPin, setAutoLockPin] = useState('');
  const [autoLockPinConfirm, setAutoLockPinConfirm] = useState('');
  const [autoLockPinError, setAutoLockPinError] = useState('');
  const [showAutoLockSetup, setShowAutoLockSetup] = useState(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState(5);

  // Folder lock settings
  const [folderLockPin, setFolderLockPin] = useState('');
  const [folderLockPinConfirm, setFolderLockPinConfirm] = useState('');
  const [folderLockPinError, setFolderLockPinError] = useState('');
  const [showFolderLockSetup, setShowFolderLockSetup] = useState(false);
  const [lockedFolders, setLockedFolders] = useState<string[]>([]);
  const [newLockedFolder, setNewLockedFolder] = useState('');

  // Custom dropdown state
  const [showGhostDropdown, setShowGhostDropdown] = useState(false);
  const [showLockedDropdown, setShowLockedDropdown] = useState(false);
  const ghostDropdownRef = useRef<HTMLDivElement>(null);
  const lockedDropdownRef = useRef<HTMLDivElement>(null);

  // Strict isolation state
  const [currentIp, setCurrentIp] = useState<string>('');
  const [ipAllowlist, setIpAllowlist] = useState<string[]>([]);
  const [newIp, setNewIp] = useState('');
  const [ipLoading, setIpLoading] = useState(false);
  const [showIps, setShowIps] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ghostDropdownRef.current && !ghostDropdownRef.current.contains(event.target as Node)) {
        setShowGhostDropdown(false);
      }
      if (lockedDropdownRef.current && !lockedDropdownRef.current.contains(event.target as Node)) {
        setShowLockedDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load settings and sessions
  useEffect(() => {
    Promise.all([
      authApi.getSettings().catch((e) => { console.error('[SecurityVault] Failed to load settings:', e); return { settings: {} }; }),
      authApi.getSessions().catch((e) => { console.error('[SecurityVault] Failed to load sessions:', e); return { sessions: [] }; }),
      authApi.getSecurityStatus().catch((e) => { console.error('[SecurityVault] Failed to load security status:', e); return { ghostFolders: [] }; }),
    ]).then(([settingsRes, sessionsRes, secStatus]: [any, any, any]) => {
      const s = settingsRes.settings || {};
      setSettings({
        secTwoFactor: s.secTwoFactor ?? false,
        secFileObfuscation: s.secFileObfuscation ?? false,
        secGhostFolders: s.secGhostFolders ?? false,
        secTrafficMasking: s.secTrafficMasking ?? false,
        secStrictIsolation: s.secStrictIsolation ?? false,
        secAutoLock: s.secAutoLock ?? false,
        secAutoLockTimeout: s.secAutoLockTimeout ?? 5,
        secAutoLockPin: s.secAutoLockPin ?? '',
        secFolderLock: s.secFolderLock ?? false,
        secFolderLockPin: s.secFolderLockPin ?? '',
        secLockedFolders: s.secLockedFolders ?? [],
      });
      setSessions(sessionsRes.sessions || []);
      setGhostFolders(secStatus.ghostFolders || []);
      setLockedFolders(s.secLockedFolders ?? []);
      setAutoLockTimeout(s.secAutoLockTimeout ?? 5);
      setIpAllowlist(secStatus.ipAllowlist || []);
      // Get current device IP from current session
      const currentSession = (sessionsRes.sessions || []).find((s: SessionData) => s.isCurrent);
      setCurrentIp(currentSession?.ipAddress || '');
    }).finally(() => setLoading(false));
  }, []);

  // Load available top-level folders for ghost folder picker
  useEffect(() => {
    if (settings.secGhostFolders || settings.secFolderLock) {
      const categories = ['general', 'media', 'video_vault', 'music'];
      const catLabels: Record<string, string> = { general: 'files', media: 'photos', video_vault: 'videos', music: 'music' };
      Promise.all(
        categories.map(cat =>
          fetch(`/api/files/list?category=${cat}&path=`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` }
          }).then(r => r.json()).then(data =>
            (data.folders || []).map((f: any) => `${catLabels[cat]}/${f.name}`)
          ).catch(() => [])
        )
      ).then(results => {
        setAvailableFolders(results.flat());
      });
    }
  }, [settings.secGhostFolders, settings.secFolderLock]);

  const handleAddGhostFolder = useCallback(async (folderPath: string) => {
    if (!folderPath.trim() || ghostFolders.includes(folderPath)) return;
    setGhostLoading(true);
    try {
      await authApi.addGhostFolder(folderPath);
      setGhostFolders(prev => [...prev, folderPath]);
      setNewGhostFolder('');
    } catch { /* ignore */ } finally {
      setGhostLoading(false);
    }
  }, [ghostFolders]);

  const handleRemoveGhostFolder = useCallback(async (folderPath: string) => {
    setGhostLoading(true);
    try {
      await authApi.removeGhostFolder(folderPath);
      setGhostFolders(prev => prev.filter(f => f !== folderPath));
    } catch { /* ignore */ } finally {
      setGhostLoading(false);
    }
  }, []);

  const handleAddIp = useCallback(async (ip: string) => {
    if (!ip.trim() || ipAllowlist.includes(ip)) return;
    const updatedList = [...ipAllowlist, ip.trim()];
    setIpLoading(true);
    try {
      await authApi.updateIpAllowlist(updatedList);
      setIpAllowlist(updatedList);
      setNewIp('');
    } catch { /* ignore */ } finally {
      setIpLoading(false);
    }
  }, [ipAllowlist]);

  const handleRemoveIp = useCallback(async (ip: string) => {
    const updatedList = ipAllowlist.filter(i => i !== ip);
    setIpLoading(true);
    try {
      await authApi.updateIpAllowlist(updatedList);
      setIpAllowlist(updatedList);
    } catch { /* ignore */ } finally {
      setIpLoading(false);
    }
  }, [ipAllowlist]);

  const handleAddCurrentIp = useCallback(async () => {
    if (!currentIp || ipAllowlist.includes(currentIp)) return;
    await handleAddIp(currentIp);
  }, [currentIp, ipAllowlist, handleAddIp]);

  const toggleStrictIsolation = useCallback(async () => {
    const newVal = !settings.secStrictIsolation;
    if (newVal && ipAllowlist.length === 0) {
      if (!confirm('You have no authorized IPs. Enabling strict isolation without any authorized IPs will allow all IPs (no restriction). Add your current IP first?')) {
        return;
      }
    }
    if (newVal && !ipAllowlist.includes(currentIp)) {
      if (confirm(`Your current IP (${currentIp}) is not in the authorized list. Add it automatically to avoid being locked out?`)) {
        await handleAddIp(currentIp);
      }
    }
    setSavingField('secStrictIsolation');
    try {
      await authApi.updateSettings({ secStrictIsolation: newVal });
      setSettings(prev => ({ ...prev, secStrictIsolation: newVal }));
    } catch {
      setSettings(prev => ({ ...prev, secStrictIsolation: !newVal }));
    } finally {
      setSavingField(null);
    }
  }, [settings.secStrictIsolation, ipAllowlist, currentIp, handleAddIp]);

  const toggleSetting = useCallback(async (key: keyof SecuritySettings) => {
    // 2FA requires special setup flow
    if (key === 'secTwoFactor') {
      if (!settings.secTwoFactor) {
        // Enable: show setup modal
        setSetupLoading(true);
        setSetupError('');
        try {
          const res = await authApi.setup2FA();
          setTotpUri(res.uri || '');
          setTotpSecret(res.secret || '');
          setShow2FASetup(true);
        } catch (err: any) {
          setSetupError(err.message || 'Failed to setup 2FA');
        } finally {
          setSetupLoading(false);
        }
        return;
      } else {
        // Disable 2FA
        setSavingField(key);
        try {
          await authApi.disable2FA();
          setSettings(prev => ({ ...prev, secTwoFactor: false }));
          await authApi.updateSettings({ secTwoFactor: false });
        } catch (err: any) {
          console.error('Failed to disable 2FA:', err);
        } finally {
          setSavingField(null);
        }
        return;
      }
    }
    if (key === 'secAutoLock') {
      if (!settings.secAutoLock) {
        if (!settings.secAutoLockPin) {
          setAutoLockPin('');
          setAutoLockPinConfirm('');
          setAutoLockPinError('');
          setShowAutoLockSetup(true);
          return;
        }
      } else {
        setSavingField(key);
        try {
          await authApi.updateSettings({ secAutoLock: false });
          setSettings(prev => ({ ...prev, secAutoLock: false }));
          onAutoLockChange?.(false, settings.secAutoLockTimeout, settings.secAutoLockPin);
        } catch {
          setSettings(prev => ({ ...prev, secAutoLock: true }));
        } finally {
          setSavingField(null);
        }
        return;
      }
    }
    if (key === 'secFolderLock') {
      if (!settings.secFolderLock) {
        if (!settings.secFolderLockPin) {
          setFolderLockPin('');
          setFolderLockPinConfirm('');
          setFolderLockPinError('');
          setShowFolderLockSetup(true);
          return;
        }
      } else {
        setSavingField(key);
        try {
          await authApi.updateSettings({ secFolderLock: false });
          setSettings(prev => ({ ...prev, secFolderLock: false }));
          onFolderLockChange?.(false, settings.secLockedFolders, settings.secFolderLockPin);
        } catch {
          setSettings(prev => ({ ...prev, secFolderLock: true }));
        } finally {
          setSavingField(null);
        }
        return;
      }
    }
    const newVal = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newVal }));
    setSavingField(key);
    try {
      await authApi.updateSettings({ [key]: newVal });
    } catch {
      setSettings(prev => ({ ...prev, [key]: !newVal }));
    } finally {
      setSavingField(null);
    }
  }, [settings]);

  const handleVerify2FA = useCallback(async () => {
    if (verifyCode.length !== 6) return;
    setSetupLoading(true);
    setSetupError('');
    try {
      await authApi.verify2FA(verifyCode);
      await authApi.updateSettings({ secTwoFactor: true });
      setSettings(prev => ({ ...prev, secTwoFactor: true }));
      setShow2FASetup(false);
      setVerifyCode('');
      setTotpUri('');
      setTotpSecret('');
    } catch (err: any) {
      setSetupError(err.message || 'Invalid code. Try again.');
    } finally {
      setSetupLoading(false);
    }
  }, [verifyCode]);

  // Calculate security score
  const enabledCount = [
    settings.secTwoFactor,
    settings.secFileObfuscation,
    settings.secGhostFolders,
    settings.secTrafficMasking,
    settings.secStrictIsolation,
    settings.secAutoLock,
    settings.secFolderLock,
  ].filter(Boolean).length;
  const totalFeatures = 7;
  const securityScore = Math.round((enabledCount / totalFeatures) * 100);

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  const handleProtocolAction = useCallback(async (action: string) => {
    setActionRunning(action);
    setActionResult(null);
    try {
      const result = await authApi.runProtocolAction(action);
      const hasIssues = result.hasIssues === true;
      setActionResult({ action, success: hasIssues ? 'warning' : true, message: result.message || 'Action completed successfully' });
    } catch (err: any) {
      setActionResult({ action, success: false, message: err.message || 'Action failed' });
    } finally {
      setActionRunning(null);
      // Auto-clear result after 5s
      setTimeout(() => setActionResult(null), 5000);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[#5D5FEF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto py-10 animate-in fade-in duration-500 min-h-full">
      <div className="mb-12">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            Security Vault
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <p className="text-gray-500 font-medium text-sm pl-3 sm:pl-4 md:pl-6">End-to-end server protection</p>
      </div>

      <div className="space-y-10">
        <div className="bg-[#5D5FEF] rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl shadow-[#5D5FEF]/20 relative overflow-hidden flex flex-col">
          <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-white/10 rounded-full blur-[100px]" />
          <div className="relative z-10 flex-1 flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-6 border border-white/20">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-black mb-4 tracking-tight leading-tight">Your data is secured at the cluster level.</h3>
              <p className="text-white/70 font-bold text-sm md:text-base lg:text-lg leading-relaxed">
                {enabledCount === totalFeatures
                  ? 'All security features are enabled. Your cluster is running at maximum protection.'
                  : `${enabledCount} of ${totalFeatures} security features enabled. Enable all features for maximum protection.`}
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 bg-black/10 p-6 md:p-8 rounded-[2rem] border border-white/10 backdrop-blur-sm mt-6 self-start">
              <span className="text-5xl md:text-6xl font-black">{securityScore}%</span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Security Score</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-gray-100 shadow-sm flex flex-col gap-6 min-h-[280px]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#5D5FEF]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-[#5D5FEF]" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Two-Factor Authentication</p>
                  <p className="text-sm font-bold text-gray-800 mt-2">Require additional verification on every login.</p>
                </div>
              </div>
              <button
                onClick={() => toggleSetting('secTwoFactor')}
                disabled={savingField === 'secTwoFactor'}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${settings.secTwoFactor ? 'bg-[#5D5FEF]' : 'bg-gray-200'} ${savingField === 'secTwoFactor' ? 'opacity-60' : ''}`}
                role="switch"
                aria-checked={settings.secTwoFactor}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${settings.secTwoFactor ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-400 mb-2">{settings.secTwoFactor ? 'Active' : 'Disabled'}</p>
              {settings.secTwoFactor ? (
                <p className="text-xs text-gray-500 leading-relaxed">Time-based one-time passwords (TOTP) are required for all login attempts. Compatible with Google Authenticator, Authy, and other authenticator apps.</p>
              ) : (
                <p className="text-xs text-gray-500 leading-relaxed">Enable to add an extra layer of security. You'll scan a QR code with your authenticator app during setup.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-gray-100 shadow-sm flex flex-col gap-6 min-h-[280px]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#5D5FEF]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <EyeOff className="w-5 h-5 text-[#5D5FEF]" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">File Obfuscation</p>
                  <p className="text-sm font-bold text-gray-800 mt-2">Randomize metadata for sensitive vault items.</p>
                </div>
              </div>
              <button
                onClick={() => toggleSetting('secFileObfuscation')}
                disabled={savingField === 'secFileObfuscation'}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${settings.secFileObfuscation ? 'bg-[#5D5FEF]' : 'bg-gray-200'} ${savingField === 'secFileObfuscation' ? 'opacity-60' : ''}`}
                role="switch"
                aria-checked={settings.secFileObfuscation}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${settings.secFileObfuscation ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-400 mb-2">{settings.secFileObfuscation ? 'Active' : 'Disabled'}</p>
              {settings.secFileObfuscation ? (
                <p className="text-xs text-gray-500 leading-relaxed">File timestamps, names, and metadata are being randomized to prevent pattern analysis and forensic tracking.</p>
              ) : (
                <p className="text-xs text-gray-500 leading-relaxed">Enable to obscure file metadata, making it harder for attackers to profile your storage patterns.</p>
              )}
            </div>
          </div>

          <div className={`bg-white rounded-[2.5rem] p-8 md:p-10 border border-gray-100 shadow-sm flex flex-col gap-6 min-h-[280px] ${settings.secGhostFolders ? '' : 'opacity-70'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#5D5FEF]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Eye className="w-5 h-5 text-[#5D5FEF]" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Ghost Folders</p>
                  <p className="text-sm font-bold text-gray-800 mt-2">Hide folders unless specifically searched.</p>
                </div>
              </div>
              <button
                onClick={() => toggleSetting('secGhostFolders')}
                disabled={savingField === 'secGhostFolders'}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${settings.secGhostFolders ? 'bg-[#5D5FEF]' : 'bg-gray-200'} ${savingField === 'secGhostFolders' ? 'opacity-60' : ''}`}
                role="switch"
                aria-checked={settings.secGhostFolders}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${settings.secGhostFolders ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {!settings.secGhostFolders ? (
                <p className="text-xs font-semibold text-gray-400">Disabled — enable to choose folders.</p>
              ) : (
                <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1" ref={ghostDropdownRef}>
                    <button
                      type="button"
                      onClick={() => !ghostLoading && setShowGhostDropdown(!showGhostDropdown)}
                      disabled={ghostLoading}
                      className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent hover:border-[#5D5FEF]/30 hover:bg-white transition-all text-sm outline-none font-medium text-left flex items-center justify-between disabled:cursor-not-allowed disabled:bg-gray-100 group"
                    >
                      <span className={newGhostFolder ? 'text-gray-900' : 'text-gray-400'}>
                        {newGhostFolder || 'Select a folder to hide...'}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showGhostDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showGhostDropdown && availableFolders.filter(f => !ghostFolders.includes(f)).length > 0 && createPortal(
                      <div className="fixed" style={{ top: ghostDropdownRef.current?.getBoundingClientRect().bottom, left: ghostDropdownRef.current?.getBoundingClientRect().left, width: ghostDropdownRef.current?.getBoundingClientRect().width }}>
                        <div className="mt-2 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-[100] max-h-60 overflow-y-auto">
                        {availableFolders.filter(f => !ghostFolders.includes(f)).map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => {
                              setNewGhostFolder(f);
                              setShowGhostDropdown(false);
                            }}
                            className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-[#F5F5F7] transition-all flex items-center gap-3 group"
                          >
                            <Folder className="w-4 h-4 text-gray-400 group-hover:text-[#5D5FEF]" />
                            <span className="group-hover:text-[#5D5FEF]">{f}</span>
                          </button>
                        ))}
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                  <button
                    onClick={() => handleAddGhostFolder(newGhostFolder)}
                    disabled={!newGhostFolder || ghostLoading}
                    className="px-5 py-3 bg-[#5D5FEF] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#4D4FCF] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {ghostLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                  </button>
                </div>

                {ghostFolders.length === 0 ? (
                  <div className="text-center py-6 text-gray-300">
                    <FolderClosed className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-bold">No hidden folders yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {ghostFolders.map(folder => (
                      <div key={folder} className="flex items-center justify-between p-3 bg-[#F5F5F7] rounded-xl group">
                        <div className="flex items-center gap-3">
                          <FolderClosed className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-bold text-gray-700">{folder}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveGhostFolder(folder)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                          aria-label={`Remove ghost folder ${folder}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-gray-100 shadow-sm flex flex-col gap-6 min-h-[280px] opacity-60">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Traffic Masking</p>
                    <span className="text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Coming Soon</span>
                  </div>
                  <p className="text-sm font-bold text-gray-800 mt-2">Mask server IP via Arcellite Tunneling.</p>
                </div>
              </div>
              <button
                disabled
                className="relative inline-flex h-7 w-12 items-center rounded-full bg-gray-200 opacity-40 cursor-not-allowed flex-shrink-0"
                role="switch"
                aria-checked={false}
                aria-disabled="true"
              >
                <span className="inline-block h-5 w-5 transform rounded-full bg-white shadow translate-x-1" />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-400 mb-2">Not yet available</p>
              <p className="text-xs text-gray-500 leading-relaxed">Tunnel-based IP masking is coming in a future update. Enable to route traffic through encrypted tunnels, hiding your server IP and improving privacy for remote access.</p>
            </div>
          </div>

          <div className={`bg-white rounded-[2.5rem] p-8 md:p-10 border border-gray-100 shadow-sm flex flex-col gap-6 min-h-[280px] ${settings.secAutoLock ? '' : 'opacity-70'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#5D5FEF]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Timer className="w-5 h-5 text-[#5D5FEF]" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Auto-Lock Screen</p>
                  <p className="text-sm font-bold text-gray-800 mt-2">Lock after inactivity with a PIN.</p>
                </div>
              </div>
              <button
                onClick={() => toggleSetting('secAutoLock')}
                disabled={savingField === 'secAutoLock'}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${settings.secAutoLock ? 'bg-[#5D5FEF]' : 'bg-gray-200'} ${savingField === 'secAutoLock' ? 'opacity-60' : ''}`}
                role="switch"
                aria-checked={settings.secAutoLock}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${settings.secAutoLock ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {!settings.secAutoLock ? (
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2">Disabled — enable to configure timeout and PIN.</p>
                  <p className="text-xs text-gray-500 leading-relaxed">Set an inactivity timer to automatically lock the interface. Requires a 6-digit PIN to unlock.</p>
                </div>
              ) : (
                <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3 block">Lock after</label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 3, 5, 10, 15, 30].map(mins => (
                      <button
                        key={mins}
                        onClick={async () => {
                          setAutoLockTimeout(mins);
                          setSettings(prev => ({ ...prev, secAutoLockTimeout: mins }));
                          await authApi.updateSettings({ secAutoLockTimeout: mins });
                          onAutoLockChange?.(true, mins, settings.secAutoLockPin);
                        }}
                        className={`px-3 py-2 rounded-lg text-[11px] font-black transition-all active:scale-95 ${
                          autoLockTimeout === mins
                            ? 'bg-[#5D5FEF] text-white shadow-lg shadow-[#5D5FEF]/20'
                            : 'bg-[#F5F5F7] text-gray-500'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAutoLockPin('');
                    setAutoLockPinConfirm('');
                    setAutoLockPinError('');
                    setShowAutoLockSetup(true);
                  }}
                  className="w-full px-4 py-3 bg-[#F5F5F7] text-gray-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4" /> Change PIN
                </button>
              </div>
              )}
            </div>
          </div>

          <div className={`bg-white rounded-[2.5rem] p-8 md:p-10 border border-gray-100 shadow-sm flex flex-col gap-6 min-h-[280px] ${settings.secFolderLock ? '' : 'opacity-70'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#5D5FEF]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FolderLock className="w-5 h-5 text-[#5D5FEF]" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Folder Lock</p>
                  <p className="text-sm font-bold text-gray-800 mt-2">Protect folders with a 6-digit PIN.</p>
                </div>
              </div>
              <button
                onClick={() => toggleSetting('secFolderLock')}
                disabled={savingField === 'secFolderLock'}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${settings.secFolderLock ? 'bg-[#5D5FEF]' : 'bg-gray-200'} ${savingField === 'secFolderLock' ? 'opacity-60' : ''}`}
                role="switch"
                aria-checked={settings.secFolderLock}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${settings.secFolderLock ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {!settings.secFolderLock ? (
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2">Disabled — enable to lock folders.</p>
                  <p className="text-xs text-gray-500 leading-relaxed">Protect specific folders with a 6-digit PIN. Locked folders require PIN entry to access their contents.</p>
                </div>
              ) : (
                <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1" ref={lockedDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowLockedDropdown(!showLockedDropdown)}
                      className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent hover:border-[#5D5FEF]/30 hover:bg-white transition-all text-sm outline-none font-medium text-left flex items-center justify-between group"
                    >
                      <span className={newLockedFolder ? 'text-gray-900' : 'text-gray-400'}>
                        {newLockedFolder || 'Select a folder to lock...'}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showLockedDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showLockedDropdown && availableFolders.filter(f => !lockedFolders.includes(f)).length > 0 && createPortal(
                      <div className="fixed" style={{ top: lockedDropdownRef.current?.getBoundingClientRect().bottom, left: lockedDropdownRef.current?.getBoundingClientRect().left, width: lockedDropdownRef.current?.getBoundingClientRect().width }}>
                        <div className="mt-2 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-[100] max-h-60 overflow-y-auto">
                        {availableFolders.filter(f => !lockedFolders.includes(f)).map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => {
                              setNewLockedFolder(f);
                              setShowLockedDropdown(false);
                            }}
                            className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-[#F5F5F7] transition-all flex items-center gap-3 group"
                          >
                            <Folder className="w-4 h-4 text-gray-400 group-hover:text-[#5D5FEF]" />
                            <span className="group-hover:text-[#5D5FEF]">{f}</span>
                          </button>
                        ))}
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      if (!newLockedFolder) return;
                      const updated = [...lockedFolders, newLockedFolder];
                      setLockedFolders(updated);
                      setNewLockedFolder('');
                      await authApi.updateSettings({ secLockedFolders: updated });
                      setSettings(prev => ({ ...prev, secLockedFolders: updated }));
                      onFolderLockChange?.(true, updated, settings.secFolderLockPin);
                    }}
                    disabled={!newLockedFolder}
                    className="px-5 py-3 bg-[#5D5FEF] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#4D4FCF] transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>

                {lockedFolders.length === 0 ? (
                  <div className="text-center py-6 text-gray-300">
                    <FolderLock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-bold">No locked folders yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {lockedFolders.map(folder => (
                      <div key={folder} className="flex items-center justify-between p-3 bg-[#F5F5F7] rounded-xl">
                        <div className="flex items-center gap-3">
                          <FolderLock className="w-4 h-4 text-[#5D5FEF]" />
                          <span className="text-sm font-bold text-gray-700">{folder}</span>
                        </div>
                        <button
                          onClick={async () => {
                            const updated = lockedFolders.filter(f => f !== folder);
                            setLockedFolders(updated);
                            await authApi.updateSettings({ secLockedFolders: updated });
                            setSettings(prev => ({ ...prev, secLockedFolders: updated }));
                            onFolderLockChange?.(true, updated, settings.secFolderLockPin);
                          }}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                          aria-label={`Remove locked folder ${folder}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    setFolderLockPin('');
                    setFolderLockPinConfirm('');
                    setFolderLockPinError('');
                    setShowFolderLockSetup(true);
                  }}
                  className="w-full px-4 py-3 bg-[#F5F5F7] text-gray-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4" /> Change PIN
                </button>
              </div>
              )}
            </div>
          </div>
        </div>

        {/* Protocol Actions + Cluster Access Logs */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
          {/* Protocol Actions */}
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-gray-100 shadow-sm flex flex-col gap-6 min-h-[400px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Protocol Actions</p>
                <p className="text-sm font-bold text-gray-800 mt-2">Manual cryptographic maintenance tasks.</p>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-gray-100 text-gray-400">Actions</span>
            </div>
            <div className="space-y-3 flex-1">
              {[
                { id: 'rotate', label: 'Rotate RSA Keys', icon: Key },
                { id: 'ssl', label: 'Regenerate SSL', icon: RefreshCw },
                { id: 'integrity', label: 'Integrity Check', icon: Activity },
              ].map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleProtocolAction(action.id)}
                  disabled={actionRunning === action.id}
                  className="w-full flex items-center justify-between p-4 bg-[#F5F5F7] rounded-2xl border border-transparent hover:border-[#5D5FEF]/30 transition-all group disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg group-hover:bg-[#5D5FEF]/10 group-hover:text-[#5D5FEF] transition-all">
                      {actionRunning === action.id
                        ? <Loader2 className="w-4 h-4 animate-spin text-[#5D5FEF]" />
                        : <action.icon className="w-4 h-4" />}
                    </div>
                    <span className="text-[13px] font-black text-gray-700">{action.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-[#5D5FEF]" />
                </button>
              ))}
            </div>
            {actionResult && (
              <div className={`p-3 rounded-xl flex items-center gap-2.5 ${
                actionResult.success === 'warning' ? 'bg-amber-50 border border-amber-100'
                : actionResult.success ? 'bg-green-50 border border-green-100'
                : 'bg-red-50 border border-red-100'
              }`}>
                {actionResult.success === 'warning'
                  ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  : actionResult.success
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                <p className={`text-[11px] font-bold ${
                  actionResult.success === 'warning' ? 'text-amber-700'
                  : actionResult.success ? 'text-green-700'
                  : 'text-red-700'
                }`}>{actionResult.message}</p>
              </div>
            )}
          </div>

          {/* Cluster Access Logs */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 md:p-12 shadow-sm flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-8 md:mb-12">
              <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Cluster Access Logs</h4>
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{sessions.length} active</span>
            </div>
            <div className="space-y-6 md:space-y-8 flex-1">
              {sessions.length === 0 ? (
                <div className="text-center py-12 text-gray-300">
                  <Activity className="w-10 h-10 mx-auto mb-4 opacity-50" />
                  <p className="text-sm font-bold">No active sessions</p>
                </div>
              ) : (
                sessions.slice(0, 5).map((session) => (
                  <div key={session.id} className="flex items-center justify-between border-b border-gray-50 pb-6 md:pb-8 last:border-none last:pb-0 group">
                    <div className="flex items-center gap-4 md:gap-8 min-w-0 flex-1">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 ${
                        session.isCurrent
                          ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]'
                          : 'bg-gray-50 text-gray-400 group-hover:bg-[#5D5FEF]/10 group-hover:text-[#5D5FEF]'
                      }`}>
                        <Activity className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm md:text-[17px] font-black text-gray-800 truncate">
                          {session.deviceName}
                          {session.isCurrent && <span className="text-[#5D5FEF] text-[10px] ml-2 font-bold uppercase">(this device)</span>}
                        </p>
                        <p className="text-[11px] md:text-[13px] font-medium text-gray-400 truncate">
                          {session.ipAddress || 'Unknown IP'} &bull; {session.deviceType}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <span className="text-[10px] md:text-[11px] font-black text-gray-300 uppercase tracking-widest block mb-1">
                        {formatTimeAgo(session.lastActivity)}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-green-500">authorized</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Strict Isolation + Nuclear Lockdown */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
          {/* Strict Isolation */}
          <div className={`rounded-[2.5rem] p-8 md:p-10 border flex flex-col shadow-sm min-h-[400px] ${settings.secStrictIsolation ? 'bg-white border-[#5D5FEF]/20' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-[1.5rem] flex items-center justify-center ${settings.secStrictIsolation ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]' : 'bg-gray-100 text-gray-400'}`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-gray-900 font-black text-lg">Strict IP Isolation</p>
                  <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${settings.secStrictIsolation ? 'text-[#5D5FEF]' : 'text-gray-400'}`}>{settings.secStrictIsolation ? 'Active' : 'Disabled'}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${settings.secStrictIsolation ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]' : 'bg-gray-100 text-gray-500'}`}>
                {ipAllowlist.length} authorized IP{ipAllowlist.length !== 1 ? 's' : ''}
              </span>
            </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Current Device IP */}
            <div className="bg-[#F5F5F7] rounded-xl p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Your Current IP</p>
                <button onClick={() => setShowIps(!showIps)} className="text-gray-400 hover:text-gray-600 transition-colors" title={showIps ? 'Hide IPs' : 'Show IPs'}>
                  {showIps ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-lg font-black text-gray-900 font-mono mb-2">{currentIp ? (showIps ? currentIp : currentIp.replace(/\.(\d+)$/, '.***')) : 'Unknown'}</p>
              <button
                onClick={handleAddCurrentIp}
                disabled={ipLoading || !currentIp || ipAllowlist.includes(currentIp)}
                className="text-xs font-bold text-[#5D5FEF] hover:text-[#4B4DD9] disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {ipAllowlist.includes(currentIp) ? '✓ Already authorized' : '+ Add to allowlist'}
              </button>
            </div>

            {/* Stats */}
            <div className="bg-[#F5F5F7] rounded-xl p-4 border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Protection Status</p>
              <p className="text-lg font-black text-gray-900 mb-1">
                {settings.secStrictIsolation
                  ? (ipAllowlist.length === 0 ? 'No restrictions' : `${ipAllowlist.length} IP${ipAllowlist.length !== 1 ? 's' : ''} authorized`)
                  : 'All IPs allowed'}
              </p>
              <p className="text-xs font-semibold text-gray-500">
                {settings.secStrictIsolation
                  ? (ipAllowlist.length === 0 ? 'Add IPs to restrict access' : 'Only listed IPs can access')
                  : 'Enable to block unauthorized devices'}
              </p>
            </div>
          </div>

          {/* IP Allowlist Management */}
          {settings.secStrictIsolation && (
            <div className="bg-[#F5F5F7] rounded-xl p-4 border border-gray-100 mb-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Authorized IP Addresses</p>
              
              {/* Add IP Input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddIp(newIp); }}
                  placeholder="192.168.1.100 or 76.32.xxx.xxx"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/30"
                  disabled={ipLoading}
                />
                <button
                  onClick={() => handleAddIp(newIp)}
                  disabled={ipLoading || !newIp.trim()}
                  className="px-4 py-2 bg-[#5D5FEF] text-white rounded-lg font-black text-xs uppercase tracking-wider hover:bg-[#4B4DD9] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {ipLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add
                </button>
              </div>

              {/* IP List */}
              {ipAllowlist.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-xs font-bold">No IPs in allowlist</p>
                  <p className="text-[10px] mt-1">All traffic is currently allowed</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {ipAllowlist.map((ip) => (
                    <div key={ip} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200">
                      <span className="text-sm font-mono font-bold text-gray-900">{showIps ? ip : ip.replace(/\.(\d+)$/, '.***')}</span>
                      <button
                        onClick={() => handleRemoveIp(ip)}
                        disabled={ipLoading}
                        className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Remove IP"
                        aria-label={`Remove IP ${ip}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Enable/Disable Button */}
          <div className="flex-1 flex items-end">
            <button
              onClick={toggleStrictIsolation}
              disabled={savingField === 'secStrictIsolation'}
              className={`w-full py-5 font-black text-[12px] uppercase tracking-[0.2em] rounded-3xl transition-all shadow-2xl active:scale-95 disabled:opacity-60 ${
                settings.secStrictIsolation
                  ? 'bg-gray-600 text-white hover:bg-gray-700 shadow-gray-600/30'
                  : 'bg-[#5D5FEF] text-white hover:bg-[#4B4DD9] shadow-[#5D5FEF]/30'
              }`}
            >
              {savingField === 'secStrictIsolation' ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : settings.secStrictIsolation ? 'Disable Strict Isolation' : 'Enable Strict Isolation'}
            </button>
          </div>
        </div>

          {/* Nuclear Lockdown */}
          <div className="bg-red-50 rounded-[2.5rem] p-8 md:p-10 border border-red-100 flex flex-col items-center text-center min-h-[400px]">
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-red-100 rounded-[1.8rem] flex items-center justify-center text-red-500 mb-8">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <p className="text-red-900 font-black text-lg mb-2">Nuclear Lockdown</p>
              <p className="text-red-700 text-sm font-bold leading-relaxed mb-8">
                Immediately revoke all sessions except this one and disable all external access. Requires re-authentication to restore.
              </p>
            </div>
            <button
              onClick={async () => {
                if (!confirm('This will revoke all sessions except your current one. Continue?')) return;
                setActionRunning('lockdown');
                try {
                  for (const s of sessions.filter(s => !s.isCurrent)) {
                    await authApi.revokeSession(s.id).catch(() => {});
                  }
                  setSessions(prev => prev.filter(s => s.isCurrent));
                } catch { /* ignore */ } finally {
                  setActionRunning(null);
                }
              }}
              disabled={actionRunning === 'lockdown'}
              className="w-full py-5 bg-red-600 text-white font-black text-[12px] uppercase tracking-[0.2em] rounded-3xl hover:bg-red-700 transition-all shadow-2xl shadow-red-600/30 active:scale-95 disabled:opacity-60"
            >
              {actionRunning === 'lockdown' ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : 'Execute Lockdown'}
            </button>
          </div>
        </div>
      </div>

      {/* 2FA Setup Modal — portaled to body so it covers the header (z-[200]) */}
      {show2FASetup && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setShow2FASetup(false)}>
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-[#5D5FEF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-[#5D5FEF]" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-1">Setup Two-Factor Auth</h3>
              <p className="text-xs text-gray-400 font-medium">Scan the QR code or enter the secret in your authenticator app</p>
            </div>

            {/* QR Code */}
            {totpUri && (
              <div className="bg-[#F5F5F7] rounded-2xl p-6 mb-4 flex flex-col items-center">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}`} alt="QR Code" className="w-48 h-48 rounded-xl mb-3" />
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <code className="text-[11px] font-mono text-gray-600 select-all">{totpSecret}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(totpSecret); setCopiedSecret(true); setTimeout(() => setCopiedSecret(false), 2000); }}
                    className="p-1 text-gray-400 hover:text-[#5D5FEF] transition-colors"
                  >
                    {copiedSecret ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Verify Code Input */}
            <div className="mb-4">
              <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-sm"
                autoFocus
              />
            </div>

            {setupError && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-xs font-medium">{setupError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShow2FASetup(false); setVerifyCode(''); setSetupError(''); }}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleVerify2FA}
                disabled={verifyCode.length !== 6 || setupLoading}
                className="flex-1 py-3 bg-[#5D5FEF] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#4D4FCF] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {setupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Enable'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showAutoLockSetup && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setShowAutoLockSetup(false)}>
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-[#5D5FEF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Timer className="w-7 h-7 text-[#5D5FEF]" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-1">Setup Auto-Lock</h3>
              <p className="text-xs text-gray-400 font-medium">Set a 6-digit PIN to unlock your screen</p>
            </div>

            <div className="mb-5">
              <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3 block">Lock after</label>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 5, 10, 15, 30].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setAutoLockTimeout(mins)}
                    className={`px-3 py-2 rounded-lg text-[11px] font-black transition-all ${
                      autoLockTimeout === mins
                        ? 'bg-[#5D5FEF] text-white'
                        : 'bg-[#F5F5F7] text-gray-500'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 block">6-Digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={autoLockPin}
                onChange={(e) => setAutoLockPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-sm"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={autoLockPinConfirm}
                onChange={(e) => setAutoLockPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-sm"
              />
            </div>

            {autoLockPinError && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-xs font-medium">{autoLockPinError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowAutoLockSetup(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (autoLockPin.length !== 6) { setAutoLockPinError('PIN must be 6 digits'); return; }
                  if (autoLockPin !== autoLockPinConfirm) { setAutoLockPinError('PINs do not match'); return; }
                  setSavingField('secAutoLock');
                  try {
                    await authApi.updateSettings({ secAutoLock: true, secAutoLockPin: autoLockPin, secAutoLockTimeout: autoLockTimeout });
                    setSettings(prev => ({ ...prev, secAutoLock: true, secAutoLockPin: autoLockPin, secAutoLockTimeout: autoLockTimeout }));
                    onAutoLockChange?.(true, autoLockTimeout, autoLockPin);
                    setShowAutoLockSetup(false);
                  } catch {
                    setAutoLockPinError('Failed to save');
                  } finally {
                    setSavingField(null);
                  }
                }}
                disabled={autoLockPin.length !== 6}
                className="flex-1 py-3 bg-[#5D5FEF] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#4D4FCF] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingField === 'secAutoLock' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable Auto-Lock'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showFolderLockSetup && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setShowFolderLockSetup(false)}>
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-[#5D5FEF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FolderLock className="w-7 h-7 text-[#5D5FEF]" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-1">Setup Folder Lock</h3>
              <p className="text-xs text-gray-400 font-medium">Set a 6-digit PIN to protect your folders</p>
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 block">6-Digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={folderLockPin}
                onChange={(e) => setFolderLockPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-sm"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={folderLockPinConfirm}
                onChange={(e) => setFolderLockPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-sm"
              />
            </div>

            {folderLockPinError && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-xs font-medium">{folderLockPinError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowFolderLockSetup(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (folderLockPin.length !== 6) { setFolderLockPinError('PIN must be 6 digits'); return; }
                  if (folderLockPin !== folderLockPinConfirm) { setFolderLockPinError('PINs do not match'); return; }
                  setSavingField('secFolderLock');
                  try {
                    await authApi.updateSettings({ secFolderLock: true, secFolderLockPin: folderLockPin });
                    setSettings(prev => ({ ...prev, secFolderLock: true, secFolderLockPin: folderLockPin }));
                    onFolderLockChange?.(true, lockedFolders, folderLockPin);
                    setShowFolderLockSetup(false);
                  } catch {
                    setFolderLockPinError('Failed to save');
                  } finally {
                    setSavingField(null);
                  }
                }}
                disabled={folderLockPin.length !== 6}
                className="flex-1 py-3 bg-[#5D5FEF] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#4D4FCF] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingField === 'secFolderLock' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable Folder Lock'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SecurityVaultView;
