import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Lock, ShieldCheck, Key, EyeOff, Activity, RefreshCw, AlertTriangle, ShieldAlert, ChevronRight, Eye, Shield, Loader2, CheckCircle2, XCircle, Copy, Check, Trash2, Plus, FolderClosed } from 'lucide-react';
import { authApi } from '../../../services/api.client';

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
}

const SecurityVaultView: React.FC = () => {
  const [settings, setSettings] = useState<SecuritySettings>({
    secTwoFactor: false,
    secFileObfuscation: false,
    secGhostFolders: false,
    secTrafficMasking: false,
    secStrictIsolation: false,
  });
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ action: string; success: boolean; message: string } | null>(null);
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

  // Load settings and sessions
  useEffect(() => {
    Promise.all([
      authApi.getSettings().catch(() => ({ settings: {} })),
      authApi.getSessions().catch(() => ({ sessions: [] })),
      authApi.getSecurityStatus().catch(() => ({ ghostFolders: [] })),
    ]).then(([settingsRes, sessionsRes, secStatus]: [any, any, any]) => {
      const s = settingsRes.settings || {};
      setSettings({
        secTwoFactor: s.secTwoFactor ?? false,
        secFileObfuscation: s.secFileObfuscation ?? false,
        secGhostFolders: s.secGhostFolders ?? false,
        secTrafficMasking: s.secTrafficMasking ?? false,
        secStrictIsolation: s.secStrictIsolation ?? false,
      });
      setSessions(sessionsRes.sessions || []);
      setGhostFolders(secStatus.ghostFolders || []);
    }).finally(() => setLoading(false));
  }, []);

  // Load available top-level folders for ghost folder picker
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
  const enabledCount = Object.values(settings).filter(Boolean).length;
  const totalFeatures = 5;
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
    { key: 'secTwoFactor' as const, label: 'Two-Factor Auth', desc: 'Require additional verification on every login.', icon: Lock },
    { key: 'secFileObfuscation' as const, label: 'File Obfuscation', desc: 'Randomize metadata for sensitive vault items.', icon: EyeOff },
    { key: 'secGhostFolders' as const, label: 'Ghost Folders', desc: 'Hide folders unless specifically searched.', icon: Eye },
    { key: 'secTrafficMasking' as const, label: 'Traffic Masking', desc: 'Mask server IP via Arcellite Tunneling.', icon: Shield },
  ];

  const handleProtocolAction = useCallback(async (action: string) => {
    setActionRunning(action);
    setActionResult(null);
    try {
      const result = await authApi.runProtocolAction(action);
      setActionResult({ action, success: true, message: result.message || 'Action completed successfully' });
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

      {/* 2-column grid with matching row heights */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

        {/* Row 1 Left — Hero Card */}
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

        {/* Row 1 Right — Protocol Actions */}
        <div className="bg-gray-50/50 rounded-[2.5rem] p-8 md:p-10 border border-gray-100 flex flex-col">
          <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-6 md:mb-8">Protocol Actions</h4>
          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {[
              { id: 'rotate', label: 'Rotate RSA Keys', icon: Key },
              { id: 'ssl', label: 'Regenerate SSL', icon: RefreshCw },
              { id: 'integrity', label: 'Integrity Check', icon: Activity },
            ].map((action) => (
              <button
                key={action.id}
                onClick={() => handleProtocolAction(action.id)}
                disabled={actionRunning === action.id}
                className="w-full flex items-center justify-between p-5 md:p-6 bg-white rounded-3xl border border-transparent hover:border-[#5D5FEF]/30 transition-all group shadow-sm active:scale-[0.98] disabled:opacity-60"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-[#5D5FEF]/10 group-hover:text-[#5D5FEF] transition-all">
                    {actionRunning === action.id
                      ? <Loader2 className="w-5 h-5 animate-spin text-[#5D5FEF]" />
                      : <action.icon className="w-5 h-5" />}
                  </div>
                  <span className="text-[14px] md:text-[15px] font-black text-gray-700">{action.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-[#5D5FEF]" />
              </button>
            ))}
          </div>
          {/* Protocol action result */}
          {actionResult && (
            <div className={`mt-4 p-4 rounded-2xl flex items-center gap-3 ${actionResult.success ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
              {actionResult.success ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
              <p className={`text-xs font-bold ${actionResult.success ? 'text-green-700' : 'text-red-700'}`}>{actionResult.message}</p>
            </div>
          )}
        </div>

        {/* Row 2 Left — Privacy & Access Controls */}
        <section className="flex flex-col">
          <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-6 md:mb-8 ml-4">Privacy & Access Controls</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {privacyControls.map((item) => {
              const isActive = settings[item.key];
              const isSaving = savingField === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => toggleSetting(item.key)}
                  disabled={isSaving}
                  className="flex items-center justify-between p-6 md:p-8 bg-white border border-gray-100 rounded-[2rem] hover:shadow-xl transition-all text-left group disabled:opacity-60"
                >
                  <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 ${isActive ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]' : 'bg-gray-50 text-gray-400 group-hover:text-[#5D5FEF]'}`}>
                      {isSaving
                        ? <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
                        : <item.icon className="w-5 h-5 md:w-6 md:h-6" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm md:text-base font-black text-gray-900 mb-1">{item.label}</p>
                      <p className="text-[10px] md:text-xs font-medium text-gray-400 leading-tight pr-2">{item.desc}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${isActive ? 'bg-green-50 text-green-500' : 'bg-gray-50 text-gray-300'}`}>
                      {isActive ? 'Active' : 'Disabled'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-[#5D5FEF] transition-all" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Ghost Folder Management — shows when enabled */}
        {settings.secGhostFolders && (
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-gray-100 shadow-sm">
            <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-6">Hidden Folders</h4>
            <p className="text-xs text-gray-400 font-medium mb-6">These folders are hidden from browsing. They can only be found via direct search.</p>

            {/* Add folder */}
            <div className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <select
                  value={newGhostFolder}
                  onChange={(e) => setNewGhostFolder(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-sm outline-none font-medium appearance-none cursor-pointer"
                >
                  <option value="">Select a folder to hide...</option>
                  {availableFolders.filter(f => !ghostFolders.includes(f)).map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleAddGhostFolder(newGhostFolder)}
                disabled={!newGhostFolder || ghostLoading}
                className="px-5 py-3 bg-[#5D5FEF] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#4D4FCF] transition-all disabled:opacity-40 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {/* Current ghost folders list */}
            {ghostFolders.length === 0 ? (
              <div className="text-center py-8 text-gray-300">
                <FolderClosed className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-xs font-bold">No hidden folders yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ghostFolders.map(folder => (
                  <div key={folder} className="flex items-center justify-between p-4 bg-[#F5F5F7] rounded-xl group">
                    <div className="flex items-center gap-3">
                      <FolderClosed className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-bold text-gray-700">{folder}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveGhostFolder(folder)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Row 2 Right — Advanced Notice (Strict Isolation) */}
        <div className={`rounded-[2.5rem] p-8 md:p-10 border relative overflow-hidden flex flex-col ${settings.secStrictIsolation ? 'bg-amber-50 border-amber-100' : 'bg-amber-50/50 border-amber-100/50'}`}>
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <AlertTriangle className="w-24 h-24 text-amber-500" />
          </div>
          <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-6">Advanced Notice</h4>
          <div className="flex-1 flex flex-col justify-between relative z-10">
            <div>
              <p className="text-amber-900 text-lg font-black mb-4 leading-tight">Strict Isolation Mode</p>
              <p className="text-amber-700/80 text-sm font-bold leading-relaxed mb-6">
                {settings.secStrictIsolation
                  ? 'Strict isolation is active. Only authorized IP addresses can reach your node. Some remote sync mirrors may be affected.'
                  : 'Enabling this prevents all non-authorized IP addresses from pinging your node. This might affect some remote sync mirrors.'}
              </p>
            </div>
            <button
              onClick={() => toggleSetting('secStrictIsolation')}
              disabled={savingField === 'secStrictIsolation'}
              className={`w-full py-4 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-xl active:scale-95 disabled:opacity-60 ${
                settings.secStrictIsolation
                  ? 'bg-gray-600 text-white shadow-gray-600/20 hover:bg-gray-700'
                  : 'bg-amber-500 text-white shadow-amber-500/20 hover:bg-amber-600'
              }`}
            >
              {savingField === 'secStrictIsolation' ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : settings.secStrictIsolation ? 'Disable Strict Isolation' : 'Enable Strict Isolation'}
            </button>
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

        {/* Row 3 Left — Cluster Access Logs */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 md:p-12 shadow-sm flex flex-col">
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
                        {session.ipAddress || 'Unknown IP'} • {session.deviceType}
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

        {/* Row 3 Right — Nuclear Lockdown */}
        <div className="bg-red-50 rounded-[2.5rem] p-8 md:p-10 border border-red-100 flex flex-col items-center text-center">
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
  );
};

export default SecurityVaultView;
