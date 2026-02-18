import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Lock, ShieldCheck, Key, EyeOff, Activity, RefreshCw, AlertTriangle, ShieldAlert, ChevronRight, Eye, Shield, Loader2, CheckCircle2, XCircle, Copy, Check, Trash2, Plus, FolderClosed, Timer, FolderLock } from 'lucide-react';
import { authApi } from '../../services/api.client';

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

interface MobileSecurityVaultProps {
  onAutoLockChange?: (enabled: boolean, timeout: number, pin: string) => void;
  onFolderLockChange?: (enabled: boolean, lockedFolders: string[], pin: string) => void;
}

const MobileSecurityVaultView: React.FC<MobileSecurityVaultProps> = ({ onAutoLockChange, onFolderLockChange }) => {
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

  useEffect(() => {
    Promise.all([
      authApi.getSettings().catch((e) => { console.error('[MobileSecurityVault] Failed to load settings:', e); return { settings: {} }; }),
      authApi.getSessions().catch((e) => { console.error('[MobileSecurityVault] Failed to load sessions:', e); return { sessions: [] }; }),
      authApi.getSecurityStatus().catch((e) => { console.error('[MobileSecurityVault] Failed to load security status:', e); return { ghostFolders: [] }; }),
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
    }).finally(() => setLoading(false));
  }, []);

  // Load available folders for ghost folder picker
  useEffect(() => {
    if (settings.secGhostFolders) {
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
  }, [settings.secGhostFolders]);

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

  const toggleSetting = useCallback(async (key: keyof SecuritySettings) => {
    if (key === 'secTwoFactor') {
      if (!settings.secTwoFactor) {
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
    // Auto-Lock requires PIN setup
    if (key === 'secAutoLock') {
      if (!settings.secAutoLock) {
        setAutoLockPin('');
        setAutoLockPinConfirm('');
        setAutoLockPinError('');
        setAutoLockTimeout(settings.secAutoLockTimeout || 5);
        setShowAutoLockSetup(true);
        return;
      } else {
        // Disable auto-lock
        setSavingField(key);
        try {
          await authApi.updateSettings({ secAutoLock: false, secAutoLockPin: '' });
          setSettings(prev => ({ ...prev, secAutoLock: false, secAutoLockPin: '' }));
          onAutoLockChange?.(false, 0, '');
        } catch {
          // revert
        } finally {
          setSavingField(null);
        }
        return;
      }
    }
    // Folder Lock requires PIN setup
    if (key === 'secFolderLock') {
      if (!settings.secFolderLock) {
        setFolderLockPin('');
        setFolderLockPinConfirm('');
        setFolderLockPinError('');
        setShowFolderLockSetup(true);
        return;
      } else {
        // Disable folder lock
        setSavingField(key);
        try {
          await authApi.updateSettings({ secFolderLock: false, secFolderLockPin: '', secLockedFolders: [] });
          setSettings(prev => ({ ...prev, secFolderLock: false, secFolderLockPin: '', secLockedFolders: [] }));
          setLockedFolders([]);
          onFolderLockChange?.(false, [], '');
        } catch {
          // revert
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
  }, [settings, onAutoLockChange]);

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

  const enabledCount = [settings.secTwoFactor, settings.secFileObfuscation, settings.secGhostFolders, settings.secTrafficMasking, settings.secStrictIsolation, settings.secAutoLock, settings.secFolderLock].filter(Boolean).length;
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

  const privacyControls = [
    { key: 'secTwoFactor' as const, label: 'Two-Factor Auth', desc: 'Extra verification on login', icon: Lock },
    { key: 'secFileObfuscation' as const, label: 'File Obfuscation', desc: 'Randomize file metadata', icon: EyeOff },
    { key: 'secGhostFolders' as const, label: 'Ghost Folders', desc: 'Hide folders from browse', icon: Eye },
    { key: 'secTrafficMasking' as const, label: 'Traffic Masking', desc: 'Mask server IP address', icon: Shield },
    { key: 'secAutoLock' as const, label: 'Auto-Lock Screen', desc: 'Lock after inactivity', icon: Timer },
    { key: 'secFolderLock' as const, label: 'Folder Lock', desc: 'Protect folders with PIN', icon: FolderLock },
  ];

  const protocolActions = [
    { id: 'rotate', label: 'Rotate RSA Keys', icon: Key },
    { id: 'ssl', label: 'Regenerate SSL', icon: RefreshCw },
    { id: 'integrity', label: 'Integrity Check', icon: Activity },
  ];

  const handleProtocolAction = useCallback(async (action: string) => {
    setActionRunning(action);
    setActionResult(null);
    try {
      const result = await authApi.runProtocolAction(action);
      const hasIssues = result.hasIssues === true;
      setActionResult({ action, success: hasIssues ? 'warning' : true, message: result.message || 'Action completed' });
    } catch (err: any) {
      setActionResult({ action, success: false, message: err.message || 'Action failed' });
    } finally {
      setActionRunning(null);
      setTimeout(() => setActionResult(null), 5000);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-7 h-7 text-[#5D5FEF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Hero Card */}
      <div className="bg-[#5D5FEF] rounded-3xl p-6 text-white shadow-xl shadow-[#5D5FEF]/20 relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/10 rounded-full blur-[60px]" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col items-center bg-black/15 px-5 py-3 rounded-2xl border border-white/10">
              <span className="text-3xl font-black">{securityScore}%</span>
              <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-60">Score</span>
            </div>
          </div>
          <h3 className="text-xl font-black mb-2 tracking-tight leading-tight">Your data is secured at the cluster level.</h3>
          <p className="text-white/60 font-bold text-xs leading-relaxed">
            {enabledCount === totalFeatures
              ? 'Maximum protection enabled.'
              : `${enabledCount}/${totalFeatures} features active.`}
          </p>
        </div>
      </div>

      {/* Privacy & Access Controls */}
      <div>
        <h4 className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] mb-3 ml-1">Privacy & Access Controls</h4>
        <div className="space-y-2.5">
          {privacyControls.map((item) => {
            const isActive = settings[item.key];
            const isSaving = savingField === item.key;
            return (
              <button
                key={item.key}
                onClick={() => toggleSetting(item.key)}
                disabled={isSaving}
                className="flex items-center justify-between w-full p-4 bg-white border border-gray-100 rounded-2xl active:scale-[0.98] transition-all text-left disabled:opacity-60"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isActive ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]' : 'bg-gray-50 text-gray-400'}`}>
                    {isSaving
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <item.icon className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-gray-900">{item.label}</p>
                    <p className="text-[10px] font-medium text-gray-400 truncate">{item.desc}</p>
                  </div>
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md flex-shrink-0 ml-2 ${isActive ? 'bg-green-50 text-green-500' : 'bg-gray-50 text-gray-300'}`}>
                  {isActive ? 'Active' : 'Off'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ghost Folder Management — shows when enabled */}
      {settings.secGhostFolders && (
        <div>
          <h4 className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] mb-3 ml-1">Hidden Folders</h4>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-[10px] text-gray-400 font-medium mb-4">Hidden from browsing. Only findable via search.</p>

            {/* Add folder */}
            <div className="flex gap-2 mb-4">
              <select
                value={newGhostFolder}
                onChange={(e) => setNewGhostFolder(e.target.value)}
                className="flex-1 px-3 py-2.5 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 text-[12px] outline-none font-medium appearance-none"
              >
                <option value="">Select folder...</option>
                {availableFolders.filter(f => !ghostFolders.includes(f)).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <button
                onClick={() => handleAddGhostFolder(newGhostFolder)}
                disabled={!newGhostFolder || ghostLoading}
                className="px-3 py-2.5 bg-[#5D5FEF] text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-40 flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {ghostFolders.length === 0 ? (
              <div className="text-center py-6 text-gray-300">
                <FolderClosed className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-[10px] font-bold">No hidden folders yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {ghostFolders.map(folder => (
                  <div key={folder} className="flex items-center justify-between p-3 bg-[#F5F5F7] rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <FolderClosed className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-[12px] font-bold text-gray-700">{folder}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveGhostFolder(folder)}
                      className="p-1 text-gray-300 active:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auto-Lock Settings — shows when enabled */}
      {settings.secAutoLock && (
        <div>
          <h4 className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] mb-3 ml-1">Auto-Lock Settings</h4>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-[10px] text-gray-400 font-medium mb-4">Screen locks after inactivity. A 6-digit PIN is required to unlock.</p>

            {/* Lock timeout selection */}
            <div className="mb-4">
              <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-3 block">Lock after</label>
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

            {/* Change PIN button */}
            <button
              onClick={() => {
                setAutoLockPin('');
                setAutoLockPinConfirm('');
                setAutoLockPinError('');
                setShowAutoLockSetup(true);
              }}
              className="w-full px-3 py-2.5 bg-[#F5F5F7] text-gray-600 rounded-lg font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <Key className="w-3.5 h-3.5" /> Change PIN
            </button>
          </div>
        </div>
      )}

      {/* Locked Folders Management — shows when Folder Lock is enabled */}
      {settings.secFolderLock && (
        <div>
          <h4 className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] mb-3 ml-1">Locked Folders</h4>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-[10px] text-gray-400 font-medium mb-4">These folders require your 6-digit PIN to open.</p>

            {/* Add folder */}
            <div className="flex gap-2 mb-4">
              <select
                value={newLockedFolder}
                onChange={(e) => setNewLockedFolder(e.target.value)}
                className="flex-1 px-3 py-2.5 bg-[#F5F5F7] rounded-lg border border-transparent focus:border-[#5D5FEF]/30 text-[12px] outline-none font-medium appearance-none"
              >
                <option value="">Select folder...</option>
                {availableFolders.filter(f => !lockedFolders.includes(f)).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
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
                className="px-3 py-2.5 bg-[#5D5FEF] text-white rounded-lg font-black text-[10px] uppercase tracking-widest disabled:opacity-40 flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {lockedFolders.length === 0 ? (
              <div className="text-center py-6 text-gray-300">
                <FolderLock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-[10px] font-bold">No locked folders yet</p>
              </div>
            ) : (
              <div className="space-y-1.5 mb-4">
                {lockedFolders.map(folder => (
                  <div key={folder} className="flex items-center justify-between p-3 bg-[#F5F5F7] rounded-lg">
                    <div className="flex items-center gap-2.5">
                      <FolderLock className="w-3.5 h-3.5 text-[#5D5FEF]" />
                      <span className="text-[12px] font-bold text-gray-700">{folder}</span>
                    </div>
                    <button
                      onClick={async () => {
                        const updated = lockedFolders.filter(f => f !== folder);
                        setLockedFolders(updated);
                        await authApi.updateSettings({ secLockedFolders: updated });
                        setSettings(prev => ({ ...prev, secLockedFolders: updated }));
                        onFolderLockChange?.(true, updated, settings.secFolderLockPin);
                      }}
                      className="p-1 text-gray-300 active:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Change PIN button */}
            <button
              onClick={() => {
                setFolderLockPin('');
                setFolderLockPinConfirm('');
                setFolderLockPinError('');
                setShowFolderLockSetup(true);
              }}
              className="w-full px-3 py-2.5 bg-[#F5F5F7] text-gray-600 rounded-lg font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <Key className="w-3.5 h-3.5" /> Change PIN
            </button>
          </div>
        </div>
      )}
      <div>
        <h4 className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] mb-3 ml-1">Protocol Actions</h4>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {protocolActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleProtocolAction(action.id)}
              disabled={actionRunning === action.id}
              className="w-full flex items-center justify-between p-4 active:bg-gray-50 transition-all disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-50 rounded-lg">
                  {actionRunning === action.id
                    ? <Loader2 className="w-4 h-4 animate-spin text-[#5D5FEF]" />
                    : <action.icon className="w-4 h-4 text-gray-400" />}
                </div>
                <span className="text-[13px] font-black text-gray-700">{action.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-200" />
            </button>
          ))}
        </div>
      </div>

      {/* Protocol action result */}
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

      {/* 2FA Setup Modal — portaled to body to escape willChange:transform parent */}
      {show2FASetup && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-[#5D5FEF]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-[#5D5FEF]" />
              </div>
              <h3 className="text-[15px] font-black text-gray-900 mb-1">Setup Two-Factor Auth</h3>
              <p className="text-[11px] text-gray-400 font-medium">Copy the secret key below into your authenticator app</p>
            </div>

            {totpSecret && (
              <div className="bg-[#F5F5F7] rounded-2xl p-5 mb-4 flex flex-col items-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Secret Key</p>
                <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-gray-100 w-full">
                  <code className="text-[13px] font-mono font-bold text-gray-700 select-all break-all flex-1 text-center tracking-wider">{totpSecret}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(totpSecret); setCopiedSecret(true); setTimeout(() => setCopiedSecret(false), 2000); }}
                    className="p-1.5 text-gray-400 active:scale-90 transition-transform"
                  >
                    {copiedSecret ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {copiedSecret && (
                  <p className="text-[10px] font-bold text-green-500 mt-2">Copied to clipboard!</p>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-xs"
                autoFocus
              />
            </div>

            {setupError && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 mb-4 flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-[11px] font-medium">{setupError}</p>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={() => { setShow2FASetup(false); setVerifyCode(''); setSetupError(''); }}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleVerify2FA}
                disabled={verifyCode.length !== 6 || setupLoading}
                className="flex-1 py-3 bg-[#5D5FEF] text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                {setupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Enable'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Auto-Lock PIN Setup Modal */}
      {showAutoLockSetup && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-[#5D5FEF]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Timer className="w-6 h-6 text-[#5D5FEF]" />
              </div>
              <h3 className="text-[15px] font-black text-gray-900 mb-1">Setup Auto-Lock</h3>
              <p className="text-[11px] text-gray-400 font-medium">Set a 6-digit PIN to unlock your screen</p>
            </div>

            <div className="mb-4">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Lock after</label>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 5, 10, 15, 30].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setAutoLockTimeout(mins)}
                    className={`px-3 py-2 rounded-lg text-[10px] font-black transition-all active:scale-95 ${
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
              <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2 block">6-Digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={autoLockPin}
                onChange={(e) => setAutoLockPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-xs"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={autoLockPinConfirm}
                onChange={(e) => setAutoLockPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-xs"
              />
            </div>

            {autoLockPinError && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 mb-4 flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-[11px] font-medium">{autoLockPinError}</p>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={() => setShowAutoLockSetup(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-lg font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
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
                  } catch { setAutoLockPinError('Failed to save'); }
                  finally { setSavingField(null); }
                }}
                disabled={autoLockPin.length !== 6}
                className="flex-1 py-3 bg-[#5D5FEF] text-white rounded-lg font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                {savingField === 'secAutoLock' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable Auto-Lock'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Folder Lock PIN Setup Modal */}
      {showFolderLockSetup && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-[#5D5FEF]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <FolderLock className="w-6 h-6 text-[#5D5FEF]" />
              </div>
              <h3 className="text-[15px] font-black text-gray-900 mb-1">Setup Folder Lock</h3>
              <p className="text-[11px] text-gray-400 font-medium">Set a 6-digit PIN to protect your folders</p>
            </div>

            <div className="mb-4">
              <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2 block">6-Digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={folderLockPin}
                onChange={(e) => setFolderLockPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-xs"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={folderLockPinConfirm}
                onChange={(e) => setFolderLockPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-xs"
              />
            </div>

            {folderLockPinError && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 mb-4 flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-[11px] font-medium">{folderLockPinError}</p>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={() => setShowFolderLockSetup(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-lg font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
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
                  } catch { setFolderLockPinError('Failed to save'); }
                  finally { setSavingField(null); }
                }}
                disabled={folderLockPin.length !== 6}
                className="flex-1 py-3 bg-[#5D5FEF] text-white rounded-lg font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                {savingField === 'secFolderLock' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable Folder Lock'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <div className={`rounded-2xl p-5 border relative overflow-hidden ${settings.secStrictIsolation ? 'bg-amber-50 border-amber-200' : 'bg-amber-50/50 border-amber-100'}`}>
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <AlertTriangle className="w-16 h-16 text-amber-500" />
        </div>
        <div className="relative z-10">
          <h4 className="text-[9px] font-black text-amber-600 uppercase tracking-[0.2em] mb-3">Advanced</h4>
          <p className="text-amber-900 text-[15px] font-black mb-2">Strict Isolation Mode</p>
          <p className="text-amber-700/80 text-xs font-bold leading-relaxed mb-5">
            {settings.secStrictIsolation
              ? 'Active. Only authorized IPs can reach your node.'
              : 'Block all non-authorized IP addresses from pinging your node.'}
          </p>
          <button
            onClick={() => toggleSetting('secStrictIsolation')}
            disabled={savingField === 'secStrictIsolation'}
            className={`w-full py-3.5 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 disabled:opacity-60 ${
              settings.secStrictIsolation
                ? 'bg-gray-600 text-white'
                : 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
            }`}
          >
            {savingField === 'secStrictIsolation' ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : settings.secStrictIsolation ? 'Disable Isolation' : 'Enable Isolation'}
          </button>
        </div>
      </div>

      {/* Access Logs */}
      <div>
        <div className="flex items-center justify-between mb-3 ml-1">
          <h4 className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">Access Logs</h4>
          <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">{sessions.length} active</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {sessions.length === 0 ? (
            <div className="text-center py-10 text-gray-300">
              <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-xs font-bold">No active sessions</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sessions.slice(0, 5).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      session.isCurrent ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]' : 'bg-gray-50 text-gray-400'
                    }`}>
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-black text-gray-800 truncate">
                        {session.deviceName}
                        {session.isCurrent && <span className="text-[#5D5FEF] text-[9px] ml-1 font-bold">(you)</span>}
                      </p>
                      <p className="text-[10px] font-medium text-gray-400 truncate">
                        {session.ipAddress || 'Unknown'} • {session.deviceType}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest block">
                      {formatTimeAgo(session.lastActivity)}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-green-500">authorized</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nuclear Lockdown */}
      <div className="bg-red-50 rounded-2xl p-5 border border-red-100 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-500 mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <p className="text-red-900 font-black text-[15px] mb-1">Nuclear Lockdown</p>
        <p className="text-red-700 text-xs font-bold leading-relaxed mb-5">
          Revoke all sessions except this one. Requires re-authentication.
        </p>
        <button
          onClick={async () => {
            if (!confirm('Revoke all other sessions?')) return;
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
          className="w-full py-4 bg-red-600 text-white font-black text-[11px] uppercase tracking-[0.15em] rounded-xl hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 active:scale-95 disabled:opacity-60"
        >
          {actionRunning === 'lockdown' ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : 'Execute Lockdown'}
        </button>
      </div>
    </div>
  );
};

export default MobileSecurityVaultView;
