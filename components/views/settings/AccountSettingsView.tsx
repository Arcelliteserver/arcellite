
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  User,
  Mail,
  Shield,
  Smartphone,
  Globe,
  Bell,
  Palette,
  ChevronRight,
  Cpu,
  Sparkles,
  Check,
  Plus,
  Laptop,
  ChevronDown,
  BrainCircuit,
  Key,
  Settings,
  Thermometer,
  Eye,
  EyeOff,
  HardDrive,
  Zap,
  X,
  Loader2,
  Monitor,
  Tablet,
  Trash2,
  AlertTriangle,
  LogOut,
  ArrowRightLeft,
  Usb,
  CheckCircle,
  RefreshCw,
  FileX,
  RotateCcw,
  Database,
  ServerCrash,
  FolderOpen,
  Image,
  Video,
  Music,
  Share2,
  FileText,
  History,
  Server,
} from 'lucide-react';
import { AI_MODELS } from '../../../constants';
import { authApi, setSessionToken } from '../../../services/api.client';
import type { UserData } from '../../../App';
import type { RemovableDeviceInfo } from '../../../types';

interface DeviceSession {
  id: number;
  deviceName: string;
  deviceType: string;
  ipAddress: string | null;
  isCurrent: boolean;
  isCurrentHost: boolean;
  lastActivity: string;
  createdAt: string;
}

interface AccountSettingsViewProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  onNavigate?: (tab: string) => void;
  user?: UserData | null;
  onUserUpdate?: (user: UserData) => void;
  onDeleteAccount?: () => void;
}

const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({ selectedModel, onModelChange, onNavigate, user, onUserUpdate, onDeleteAccount }) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [storageDevice, setStorageDevice] = useState<'builtin' | 'external'>('builtin');
  const [notifications, setNotifications] = useState(true);
  const [autoMirroring, setAutoMirroring] = useState(true);
  const [vaultLockdown, setVaultLockdown] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showClearFilesConfirm, setShowClearFilesConfirm] = useState(false);
  const [isClearingFiles, setIsClearingFiles] = useState(false);
  const [showResetSettingsConfirm, setShowResetSettingsConfirm] = useState(false);
  const [isResettingSettings, setIsResettingSettings] = useState(false);
  const [showPurgeDatabasesConfirm, setShowPurgeDatabasesConfirm] = useState(false);
  const [isPurgingDatabases, setIsPurgingDatabases] = useState(false);
  const [dangerZoneSuccess, setDangerZoneSuccess] = useState<string | null>(null);
  const [dangerZoneError, setDangerZoneError] = useState<string | null>(null);
  const [transferDrives, setTransferDrives] = useState<RemovableDeviceInfo[]>([]);
  const [transferDetecting, setTransferDetecting] = useState(false);
  const [selectedTransferDrive, setSelectedTransferDrive] = useState<RemovableDeviceInfo | null>(null);
  const [transferPhase, setTransferPhase] = useState<'idle' | 'preparing' | 'done' | 'error'>('idle');
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferMessage, setTransferMessage] = useState('');
  const [transferStatus, setTransferStatus] = useState<any>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const activeModelData = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[0];

  // Only show models whose provider has an API key configured
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const configuredModels = AI_MODELS.filter(m => configuredProviders.includes(m.provider));

  useEffect(() => {
    fetch('/api/ai/configured-providers')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.providers) setConfiguredProviders(data.providers);
      })
      .catch(() => {});
  }, []);

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.email || 'User';

  const userInitial = user?.firstName?.[0]?.toUpperCase() || 'U';

  const loadDevices = useCallback(async () => {
    try {
      const data = await authApi.getSessions();
      setDevices(data.sessions || []);
    } catch (err) {
      // Silent — empty devices list shown
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const data = await authApi.getSettings();
      const s = data.settings;
      setNotifications(s.notificationsEnabled);
      setAutoMirroring(s.autoMirroring);
      setVaultLockdown(s.vaultLockdown);
      setStorageDevice(s.storageDevice === 'external' ? 'external' : 'builtin');
    } catch (err) {
      // Silent — defaults remain
    }
  }, []);

  useEffect(() => {
    loadDevices();
    loadSettings();
  }, [loadDevices, loadSettings]);

  const toggleNotifications = async () => {
    const newVal = !notifications;
    setNotifications(newVal);
    try {
      await authApi.updateSettings({ notificationsEnabled: newVal });
    } catch (err) {
      setNotifications(!newVal); // Revert on failure
    }
  };

  const toggleAutoMirroring = async () => {
    const newVal = !autoMirroring;
    setAutoMirroring(newVal);
    try {
      await authApi.updateSettings({ autoMirroring: newVal });
    } catch (err) {
      setAutoMirroring(!newVal); // Revert on failure
    }
  };

  const toggleVaultLockdown = async () => {
    const newVal = !vaultLockdown;
    setVaultLockdown(newVal);
    try {
      await authApi.updateSettings({ vaultLockdown: newVal });
    } catch (err) {
      setVaultLockdown(!newVal); // Revert on failure
    }
  };

  const changeStorageDevice = async (device: 'builtin' | 'external') => {
    setStorageDevice(device);
    try {
      await authApi.updateSettings({ storageDevice: device });
    } catch (err) {
      setStorageDevice(device === 'builtin' ? 'external' : 'builtin'); // Revert on failure
    }
  };

  const handleEditProfile = () => {
    setEditFirstName(user?.firstName || '');
    setEditLastName(user?.lastName || '');
    setEditAvatarUrl(user?.avatarUrl || '');
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    setEditSaving(true);
    try {
      await authApi.updateProfile({ firstName: editFirstName, lastName: editLastName, avatarUrl: editAvatarUrl || undefined });
      if (onUserUpdate && user) {
        onUserUpdate({ ...user, firstName: editFirstName, lastName: editLastName, avatarUrl: editAvatarUrl || null });
      }
      setIsEditingProfile(false);
    } catch (err) {
      // Silent — user stays in edit mode
    } finally {
      setEditSaving(false);
    }
  };

  const handleRevokeDevice = async (sessionId: number) => {
    setRevokingId(sessionId);
    try {
      await authApi.revokeSession(sessionId);
      setDevices(prev => prev.filter(d => d.id !== sessionId));
    } catch (err) {
      // Silent — device stays in list
    } finally {
      setRevokingId(null);
    }
  };

  const handleClearFiles = async () => {
    setIsClearingFiles(true);
    setDangerZoneError(null);
    try {
      const res = await fetch('/api/files/clear-all', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to clear files');
      }
      const data = await res.json();
      setShowClearFilesConfirm(false);
      setDangerZoneSuccess(`All files cleared successfully. ${data.deletedCount || 0} items removed.`);
      setTimeout(() => setDangerZoneSuccess(null), 5000);
    } catch (err: any) {
      console.error('Clear files failed:', err);
      setDangerZoneError(err.message || 'Failed to clear files');
      setTimeout(() => setDangerZoneError(null), 5000);
    } finally {
      setIsClearingFiles(false);
    }
  };

  const handleResetSettings = async () => {
    setIsResettingSettings(true);
    setDangerZoneError(null);
    try {
      const res = await fetch('/api/auth/reset-settings', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to reset settings');
      }
      // Update local state to reflect defaults
      setNotifications(true);
      setAutoMirroring(true);
      setVaultLockdown(true);
      setStorageDevice('builtin');
      setShowResetSettingsConfirm(false);
      setDangerZoneSuccess('All preferences have been restored to factory defaults.');
      setTimeout(() => setDangerZoneSuccess(null), 5000);
    } catch (err: any) {
      console.error('Reset settings failed:', err);
      setDangerZoneError(err.message || 'Failed to reset settings');
      setTimeout(() => setDangerZoneError(null), 5000);
    } finally {
      setIsResettingSettings(false);
    }
  };

  const handlePurgeDatabases = async () => {
    setIsPurgingDatabases(true);
    setDangerZoneError(null);
    try {
      const res = await fetch('/api/databases/purge-all', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to purge databases');
      }
      const data = await res.json();
      setShowPurgeDatabasesConfirm(false);
      setDangerZoneSuccess(`All databases purged successfully. ${data.purgedCount || 0} databases removed.`);
      setTimeout(() => setDangerZoneSuccess(null), 5000);
    } catch (err: any) {
      console.error('Purge databases failed:', err);
      setDangerZoneError(err.message || 'Failed to purge databases');
      setTimeout(() => setDangerZoneError(null), 5000);
    } finally {
      setIsPurgingDatabases(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await authApi.deleteAccount();
      setSessionToken(null);
      if (onDeleteAccount) {
        onDeleteAccount();
      }
    } catch (err) {
      setIsDeleting(false); // Reset on failure
    }
  };

  // ── Transfer Data handlers ─────────────────────────────────────────────────

  const detectTransferDrives = useCallback(async () => {
    setTransferDetecting(true);
    try {
      const res = await fetch('/api/system/storage');
      const data = await res.json();
      const drives: RemovableDeviceInfo[] = (data.removable || []).filter(
        (d: RemovableDeviceInfo) => !!d.mountpoint
      );
      setTransferDrives(drives);
      if (drives.length === 1) setSelectedTransferDrive(drives[0]);
    } catch {
      setTransferDrives([]);
    } finally {
      setTransferDetecting(false);
    }
  }, []);

  const startTransfer = async () => {
    if (!selectedTransferDrive?.mountpoint) return;
    setShowTransferConfirm(false);
    setTransferPhase('preparing');
    setTransferProgress(0);
    setTransferMessage('Starting transfer...');

    try {
      await fetch('/api/transfer/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mountpoint: selectedTransferDrive.mountpoint }),
      });

      // Poll progress
      const poll = setInterval(async () => {
        try {
          const res = await fetch('/api/transfer/status');
          const status = await res.json();
          setTransferProgress(status.percent || 0);
          setTransferMessage(status.message || '');
          setTransferStatus(status);

          if (status.phase === 'done') {
            clearInterval(poll);
            setTransferPhase('done');
          } else if (status.phase === 'error') {
            clearInterval(poll);
            setTransferPhase('error');
            setTransferMessage(status.error || 'Transfer failed');
          }
        } catch {
          clearInterval(poll);
          setTransferPhase('error');
          setTransferMessage('Lost connection');
        }
      }, 800);
    } catch (e) {
      setTransferPhase('error');
      setTransferMessage('Failed to start transfer');
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return Smartphone;
      case 'tablet': return Tablet;
      case 'desktop': return Monitor;
      default: return Laptop;
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="py-2 animate-in fade-in duration-500">
      <div className="mb-8 md:mb-12">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            Account Settings
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <p className="text-gray-500 font-medium text-sm pl-3 sm:pl-4 md:pl-6">Profile & Intelligence Core</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8 lg:gap-10">
        {/* Row 1: Identity + Intelligence */}
          <section className="bg-white rounded-2xl md:rounded-[2.5rem] border border-gray-100 p-6 md:p-8 lg:p-10 shadow-sm flex flex-col items-center text-center min-h-[400px] md:h-[460px] justify-center relative">
            <div className="flex items-center justify-between w-full px-2 mb-6 md:mb-10 absolute top-6 md:top-10">
               <p className="text-[9px] md:text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Personal Identity</p>
            </div>
            <div className="relative mb-6 md:mb-8">
              <div className="w-32 h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 rounded-2xl md:rounded-[2.5rem] overflow-hidden border-4 border-[#F5F5F7] shadow-2xl bg-[#5D5FEF] flex items-center justify-center">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-black text-6xl md:text-7xl">{userInitial}</span>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 w-9 h-9 md:w-11 md:h-11 bg-white rounded-xl md:rounded-2xl shadow-xl flex items-center justify-center border border-gray-50 text-[#5D5FEF]">
                <Palette className="w-5 h-5 md:w-6 md:h-6" />
              </div>
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-1 tracking-tight">{displayName}</h3>
            <p className="text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">{user?.email || ''}</p>
            <p className="text-[10px] md:text-[11px] font-black text-gray-300 uppercase tracking-[0.3em] mb-6 md:mb-10">Admin</p>
            <div className="grid grid-cols-2 w-full gap-3 md:gap-4 max-w-sm">
              <button onClick={handleEditProfile} className="py-3 md:py-4 bg-[#F5F5F7] text-gray-700 font-black text-[9px] md:text-[10px] uppercase tracking-widest rounded-xl md:rounded-2xl hover:bg-gray-200 transition-all border border-gray-100">Edit Profile</button>
              <button onClick={() => onNavigate && onNavigate('activity')} className="py-3 md:py-4 bg-[#5D5FEF]/5 text-[#5D5FEF] font-black text-[9px] md:text-[10px] uppercase tracking-widest rounded-xl md:rounded-2xl hover:bg-[#5D5FEF]/10 transition-all border border-[#5D5FEF]/10">Security Logs</button>
            </div>

            {/* Edit Profile Modal */}
            {isEditingProfile && (
              <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setIsEditingProfile(false)}>
                <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-gray-900">Edit Profile</h3>
                    <button onClick={() => setIsEditingProfile(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 block">First Name</label>
                      <input type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} className="w-full px-4 py-3 bg-[#F5F5F7] rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[15px] outline-none font-medium" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Last Name</label>
                      <input type="text" value={editLastName} onChange={e => setEditLastName(e.target.value)} className="w-full px-4 py-3 bg-[#F5F5F7] rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[15px] outline-none font-medium" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Avatar URL</label>
                      <input
                        type="url"
                        value={editAvatarUrl}
                        onChange={e => setEditAvatarUrl(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                        className="w-full px-4 py-3 bg-[#F5F5F7] rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[15px] outline-none font-medium placeholder:text-gray-300"
                      />
                      <p className="text-[10px] text-gray-400 mt-1.5 ml-1">Paste a URL to an image for your profile picture</p>
                    </div>
                    {editAvatarUrl && (
                      <div className="flex items-center gap-3 p-3 bg-[#F5F5F7] rounded-2xl">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#5D5FEF] flex items-center justify-center flex-shrink-0">
                          <img src={editAvatarUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium">Avatar Preview</p>
                      </div>
                    )}
                    <button onClick={handleSaveProfile} disabled={editSaving} className="w-full py-4 bg-[#5D5FEF] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 disabled:opacity-50 flex items-center justify-center gap-2">
                      {editSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm h-[460px] flex flex-col relative">
            <div className="flex items-center justify-between mb-6 px-2">
              <div>
                <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-1">Intelligence Configuration</h4>
                <p className="text-gray-900 font-black text-xl tracking-tight">Active Model Node</p>
              </div>
              <div className="p-2.5 bg-[#5D5FEF]/5 rounded-2xl">
                <BrainCircuit className="w-5 h-5 text-[#5D5FEF]" />
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-8">
              <div className="relative" ref={dropdownRef}>
                <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest mb-3 ml-2">Intelligence Interface</p>
                <button
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className={`w-full flex items-center justify-between p-5 bg-[#F5F5F7] rounded-[2.2rem] border transition-all group ${isModelDropdownOpen ? 'ring-2 ring-[#5D5FEF]/20 border-[#5D5FEF]/30 bg-white' : 'border-transparent hover:bg-[#F0F0F2]'}`}
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-[1.6rem] ${activeModelData.bg} flex items-center justify-center shadow-lg shadow-gray-200/50 group-hover:scale-105 transition-transform duration-500 p-2.5`}>
                      <img
                        src={activeModelData.icon || '/assets/models/gemini-color.svg'}
                        alt={activeModelData.provider}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-left">
                      <h5 className="text-lg font-black text-gray-900 leading-tight">{activeModelData.name}</h5>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{activeModelData.provider} Core</p>
                    </div>
                  </div>
                  <div className={`w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-300 transition-all ${isModelDropdownOpen ? 'text-[#5D5FEF]' : 'group-hover:text-gray-600'}`}>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-500 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* TRUE ABSOLUTE FLOATING DROPDOWN */}
                {isModelDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-4 bg-white rounded-[2.5rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] border border-gray-100 py-4 z-[250] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    <div className="px-6 py-2 mb-2 border-b border-gray-50">
                      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Select Processing Core</p>
                    </div>
                    {configuredModels.length === 0 ? (
                      <div className="px-6 py-8 text-center">
                        <BrainCircuit className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                        <p className="text-sm font-bold text-gray-400 mb-1">No models configured</p>
                        <p className="text-[10px] text-gray-300 mb-4">Add an API key in Settings → API Keys first</p>
                        <button
                          onClick={() => { if (onNavigate) onNavigate('apikeys'); setIsModelDropdownOpen(false); }}
                          className="px-4 py-2 bg-[#5D5FEF] text-white rounded-xl text-[11px] font-bold hover:bg-[#4D4FCF] transition-all"
                        >
                          Go to API Keys
                        </button>
                      </div>
                    ) : (
                    <div className="max-h-72 overflow-y-auto px-2 space-y-1 custom-scrollbar">
                      {configuredModels.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => { onModelChange(model.id); setIsModelDropdownOpen(false); }}
                          className={`flex items-center justify-between w-full px-4 py-3.5 hover:bg-gray-50 transition-all rounded-3xl group ${selectedModel === model.id ? 'bg-[#5D5FEF]/5' : ''}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-2xl ${model.bg} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform p-2`}>
                              <img
                                src={model.icon || '/assets/models/gemini-color.svg'}
                                alt={model.provider}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="text-left">
                              <p className="text-[15px] font-black text-gray-800 tracking-tight">{model.name}</p>
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{model.provider}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedModel === model.id && (
                              <div className="w-6 h-6 bg-[#5D5FEF] rounded-full flex items-center justify-center text-white shadow-sm">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            )}
                            {selectedModel === model.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsSettingsOpen(!isSettingsOpen);
                                  setIsModelDropdownOpen(false);
                                }}
                                className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
                                title="Configure API & Settings"
                              >
                                <Settings className="w-3 h-3 text-gray-600" />
                              </button>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    )}
                    <div className="px-6 pt-3 border-t border-gray-50">
                      <button
                        onClick={() => {
                          if (onNavigate) onNavigate('apikeys');
                          setIsModelDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#5D5FEF]/5 hover:bg-[#5D5FEF]/10 text-[#5D5FEF] rounded-xl transition-all text-[12px] font-bold"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>Manage API Keys</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Settings Panel */}
                {isSettingsOpen && (
                  <div
                    ref={settingsRef}
                    className="absolute top-full left-0 right-0 mt-4 bg-white rounded-[2.5rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] border border-gray-100 py-6 z-[250] animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
                  >
                    <div className="px-6 pb-4 border-b border-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Configuration</p>
                          <p className="text-[16px] font-black text-gray-900">{activeModelData.name}</p>
                        </div>
                        <button
                          onClick={() => setIsSettingsOpen(false)}
                          className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-all"
                        >
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    <div className="px-6 py-4 space-y-5">
                      {/* API Key Section */}
                      <div>
                        <label className="text-[11px] font-black text-gray-300 uppercase tracking-widest mb-3 block">
                          API Key
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={`Enter ${activeModelData.provider} API key`}
                            className="w-full px-4 py-3 bg-[#F5F5F7] rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] outline-none placeholder:text-gray-400"
                          />
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 transition-all"
                          >
                            {showApiKey ? (
                              <EyeOff className="w-4 h-4 text-gray-400" />
                            ) : (
                              <Eye className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">
                          Your API key is encrypted and stored securely
                        </p>
                      </div>

                      {/* Temperature Section */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-[11px] font-black text-gray-300 uppercase tracking-widest">
                            Temperature
                          </label>
                          <span className="text-[13px] font-black text-gray-700">{temperature}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Thermometer className="w-4 h-4 text-gray-400" />
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#5D5FEF]"
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                          <span>Deterministic</span>
                          <span>Creative</span>
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            // Save settings logic here
                            setIsSettingsOpen(false);
                          }}
                          className="w-full px-5 py-3.5 bg-[#5D5FEF] text-white rounded-2xl font-bold text-[13px] hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20"
                        >
                          Save Configuration
                        </button>
                        {onNavigate && (
                          <button
                            onClick={() => {
                              setIsSettingsOpen(false);
                              onNavigate('apikeys');
                            }}
                            className="w-full px-5 py-3 bg-gray-50 text-gray-700 rounded-2xl font-bold text-[12px] hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                          >
                            <Key className="w-4 h-4" />
                            <span>Manage All API Keys</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-[#F5F5F7] rounded-[2.2rem] flex items-center gap-6 border border-gray-100/50">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#5D5FEF] shadow-xl shadow-gray-200/50">
                  <Cpu className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-black text-gray-900 mb-0.5">Distributed Infrastructure</p>
                  <p className="text-[11px] text-gray-500 font-medium leading-relaxed">Intelligence routing scales dynamically across your server's native availability zones.</p>
                </div>
              </div>
            </div>
          </section>

        {/* Row 2: Preferences + Hardware */}
          <section className="bg-white rounded-2xl md:rounded-[2.5rem] border border-gray-100 p-6 md:p-8 lg:p-10 shadow-sm">
            <p className="text-[9px] md:text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] mb-6 md:mb-8 ml-2">System Preferences</p>
            <div className="space-y-2 md:space-y-3">
              {/* Cloud Notifications Toggle */}
              <button onClick={toggleNotifications} className="w-full flex items-center justify-between p-4 md:p-6 bg-[#F5F5F7]/40 border border-transparent hover:border-gray-100 rounded-xl md:rounded-[2rem] hover:bg-white hover:shadow-xl transition-all group">
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-[#5D5FEF] transition-all">
                    <Bell className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <span className="text-sm md:text-[15px] font-bold text-gray-700">Cloud Notifications</span>
                </div>
                <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${notifications ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${notifications ? 'left-[22px]' : 'left-0.5'}`} />
                </div>
              </button>

              {/* Auto Mirroring Toggle */}
              <button onClick={toggleAutoMirroring} className="w-full flex items-center justify-between p-4 md:p-6 bg-[#F5F5F7]/40 border border-transparent hover:border-gray-100 rounded-xl md:rounded-[2rem] hover:bg-white hover:shadow-xl transition-all group">
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-[#5D5FEF] transition-all">
                    <Globe className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <span className="text-sm md:text-[15px] font-bold text-gray-700">Auto Mirroring</span>
                </div>
                <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${autoMirroring ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${autoMirroring ? 'left-[22px]' : 'left-0.5'}`} />
                </div>
              </button>

              {/* Vault Lockdown Toggle */}
              <button onClick={toggleVaultLockdown} className="w-full flex items-center justify-between p-4 md:p-6 bg-[#F5F5F7]/40 border border-transparent hover:border-gray-100 rounded-xl md:rounded-[2rem] hover:bg-white hover:shadow-xl transition-all group">
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-[#5D5FEF] transition-all">
                    <Shield className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <span className="text-sm md:text-[15px] font-bold text-gray-700">Vault Lockdown</span>
                </div>
                <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${vaultLockdown ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${vaultLockdown ? 'left-[22px]' : 'left-0.5'}`} />
                </div>
              </button>

              {/* Storage Device Selection */}
              <div className="w-full flex flex-col md:flex-row md:items-center justify-between p-4 md:p-6 bg-[#F5F5F7]/40 border border-transparent hover:border-gray-100 rounded-xl md:rounded-[2rem] hover:bg-white hover:shadow-xl transition-all group gap-3 md:gap-0">
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-[#5D5FEF] transition-all">
                    {storageDevice === 'builtin' ? (
                      <HardDrive className="w-4 h-4 md:w-5 md:h-5" />
                    ) : (
                      <Zap className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </div>
                  <span className="text-sm md:text-[15px] font-bold text-gray-700">Storage Device</span>
                </div>
                <div className="flex items-center gap-2 px-1 py-1 bg-white rounded-xl border border-gray-100">
                  <button
                    onClick={() => changeStorageDevice('builtin')}
                    className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${
                      storageDevice === 'builtin'
                        ? 'bg-[#5D5FEF] text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Built-in
                  </button>
                  <button
                    onClick={() => changeStorageDevice('external')}
                    className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${
                      storageDevice === 'external'
                        ? 'bg-[#5D5FEF] text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    External USB
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl md:rounded-[2.5rem] border border-gray-100 p-6 md:p-8 lg:p-10 shadow-sm flex flex-col justify-between">
             <div className="mb-6 md:mb-8">
               <div className="flex items-center justify-between mb-6 md:mb-8 ml-2 mr-2">
                 <h4 className="text-[9px] md:text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Authorized Hardware</h4>
                 <span className="text-[9px] md:text-[10px] font-black text-gray-300 uppercase tracking-widest">{devices.length}/4 Devices</span>
               </div>

               {devicesLoading ? (
                 <div className="flex items-center justify-center py-12">
                   <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                 </div>
               ) : devices.length === 0 ? (
                 <div className="text-center py-12">
                   <Laptop className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                   <p className="text-sm text-gray-400 font-medium">No active sessions</p>
                 </div>
               ) : (
                 <div className="space-y-3 md:space-y-4">
                    {devices.map((device) => {
                      const DeviceIcon = getDeviceIcon(device.deviceType);
                      const isHost = device.isCurrentHost;
                      const isCurrent = device.isCurrent;
                      return (
                        <div key={device.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-6 bg-[#F5F5F7]/40 rounded-xl md:rounded-[2rem] border border-transparent group hover:bg-white hover:border-gray-50 hover:shadow-xl transition-all gap-3 sm:gap-0">
                          <div className="flex items-center gap-4 md:gap-6">
                            <div className={`w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl md:rounded-2xl flex items-center justify-center transition-all shadow-md group-hover:scale-105 ${isHost ? 'text-[#5D5FEF]' : 'text-gray-400 group-hover:text-[#5D5FEF]'}`}>
                              <DeviceIcon className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-base md:text-[17px] font-black text-gray-900 tracking-tight">{device.deviceName}</p>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 bg-[#5D5FEF]/10 text-[#5D5FEF] rounded-lg text-[8px] font-black uppercase tracking-widest">This Device</span>
                                )}
                              </div>
                              <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {isHost ? 'Primary Host' : 'Trusted Device'} {'\u2022'} {getTimeAgo(device.lastActivity)}
                                {device.ipAddress && <span> {'\u2022'} {device.ipAddress}</span>}
                              </p>
                            </div>
                          </div>
                          {!isCurrent && (
                            <button
                              onClick={() => handleRevokeDevice(device.id)}
                              disabled={revokingId === device.id}
                              className="px-4 md:px-6 py-2.5 md:py-3 bg-white text-gray-400 rounded-xl md:rounded-2xl text-[8px] md:text-[9px] font-black uppercase tracking-widest hover:text-red-500 transition-all border border-gray-100 shadow-sm hover:border-red-100 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            >
                              {revokingId === device.id ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Revoking...</>
                              ) : (
                                <><LogOut className="w-3 h-3" /> Revoke Access</>
                              )}
                            </button>
                          )}
                          {isCurrent && (
                            <span className="px-4 md:px-6 py-2.5 md:py-3 bg-[#5D5FEF]/5 text-[#5D5FEF] rounded-xl md:rounded-2xl text-[8px] md:text-[9px] font-black uppercase tracking-widest border border-[#5D5FEF]/10">
                              Current Session
                            </span>
                          )}
                        </div>
                      );
                    })}
                 </div>
               )}
             </div>
          </section>

        {/* Row 3: Danger Zone + Transfer */}
          {/* Delete Account Section */}
          <section className="bg-white rounded-2xl md:rounded-[2.5rem] border border-red-100 p-6 md:p-8 lg:p-10 shadow-sm">
            <p className="text-[9px] md:text-[10px] font-black text-red-300 uppercase tracking-[0.25em] mb-6 md:mb-8 ml-2">Danger Zone</p>
            
            {/* Success/Error feedback */}
            {dangerZoneSuccess && (
              <div className="flex items-center gap-3 p-4 mb-4 bg-green-50 border border-green-200 rounded-2xl animate-in fade-in">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-700 font-medium">{dangerZoneSuccess}</p>
                <button onClick={() => setDangerZoneSuccess(null)} className="ml-auto"><X className="w-4 h-4 text-green-400 hover:text-green-600" /></button>
              </div>
            )}
            {dangerZoneError && (
              <div className="flex items-center gap-3 p-4 mb-4 bg-red-50 border border-red-200 rounded-2xl animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700 font-medium">{dangerZoneError}</p>
                <button onClick={() => setDangerZoneError(null)} className="ml-auto"><X className="w-4 h-4 text-red-400 hover:text-red-600" /></button>
              </div>
            )}

            <div className="space-y-2 md:space-y-3 mb-6 md:mb-8">
              {/* Clear All Files */}
              <button onClick={() => setShowClearFilesConfirm(true)} className="w-full flex items-center justify-between p-4 md:p-6 bg-red-50/30 border border-transparent hover:border-red-100 rounded-xl md:rounded-[2rem] hover:bg-white hover:shadow-xl transition-all group">
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-white border border-red-100 flex items-center justify-center text-red-300 group-hover:text-red-500 transition-all">
                    <FileX className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm md:text-[15px] font-bold text-gray-700 block">Clear All Files</span>
                    <span className="text-[10px] md:text-[11px] text-gray-400 font-medium">Remove all uploaded files from storage</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-400 transition-all" />
              </button>

              {/* Reset Preferences */}
              <button onClick={() => setShowResetSettingsConfirm(true)} className="w-full flex items-center justify-between p-4 md:p-6 bg-red-50/30 border border-transparent hover:border-red-100 rounded-xl md:rounded-[2rem] hover:bg-white hover:shadow-xl transition-all group">
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-white border border-red-100 flex items-center justify-center text-red-300 group-hover:text-red-500 transition-all">
                    <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm md:text-[15px] font-bold text-gray-700 block">Reset Preferences</span>
                    <span className="text-[10px] md:text-[11px] text-gray-400 font-medium">Restore all settings to factory defaults</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-400 transition-all" />
              </button>

              {/* Purge Databases */}
              <button onClick={() => setShowPurgeDatabasesConfirm(true)} className="w-full flex items-center justify-between p-4 md:p-6 bg-red-50/30 border border-transparent hover:border-red-100 rounded-xl md:rounded-[2rem] hover:bg-white hover:shadow-xl transition-all group">
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-white border border-red-100 flex items-center justify-center text-red-300 group-hover:text-red-500 transition-all">
                    <Database className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm md:text-[15px] font-bold text-gray-700 block">Purge Databases</span>
                    <span className="text-[10px] md:text-[11px] text-gray-400 font-medium">Drop all user-created databases permanently</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-400 transition-all" />
              </button>
            </div>

            {/* Delete Account — final action */}
            <div className="pt-4 md:pt-6 border-t border-red-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-base md:text-lg font-black text-gray-900 mb-1">Delete Account</h4>
                  <p className="text-[11px] md:text-xs text-gray-400 font-medium">Permanently delete your account and all data. This action cannot be undone.</p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-6 py-3 bg-red-50 text-red-500 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 flex-shrink-0 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Account
                </button>
              </div>
            </div>
          </section>

          {/* Transfer Data Section */}
          <section className="bg-white rounded-2xl md:rounded-[2.5rem] border border-[#5D5FEF]/10 p-6 md:p-8 lg:p-10 shadow-sm">
            <p className="text-[9px] md:text-[10px] font-black text-[#5D5FEF]/40 uppercase tracking-[0.25em] mb-4 md:mb-6 ml-2">Transfer</p>

            {transferPhase === 'idle' && (
              <>
                <div className="flex flex-col gap-4 mb-6">
                  <div>
                    <h4 className="text-base md:text-lg font-black text-gray-900 mb-1 flex items-center gap-2">
                      <ArrowRightLeft className="w-5 h-5 text-[#5D5FEF]" />
                      Transfer to New Device
                    </h4>
                    <p className="text-[11px] md:text-xs text-gray-400 font-medium">
                      Move your entire Arcellite setup — account, files, databases, and settings — to another device via USB.
                    </p>
                  </div>
                  <button
                    onClick={detectTransferDrives}
                    disabled={transferDetecting}
                    className="px-5 py-3 bg-[#5D5FEF]/5 text-[#5D5FEF] rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-[#5D5FEF]/10 transition-all border border-[#5D5FEF]/10 flex items-center justify-center gap-2 w-full"
                  >
                    {transferDetecting ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning...</>
                    ) : (
                      <><RefreshCw className="w-3.5 h-3.5" /> Detect USB Drives</>
                    )}
                  </button>
                </div>

                {/* Drive list */}
                {transferDrives.length > 0 && (
                  <div className="space-y-3 mb-6">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-300 uppercase tracking-widest ml-2">Select Target Drive</p>
                    {transferDrives.map((drive) => (
                      <button
                        key={drive.name}
                        onClick={() => setSelectedTransferDrive(drive)}
                        className={`w-full text-left rounded-xl md:rounded-2xl p-4 md:p-5 border-2 transition-all ${
                          selectedTransferDrive?.name === drive.name
                            ? 'border-[#5D5FEF] bg-[#5D5FEF]/5'
                            : 'border-gray-100 bg-[#F5F5F7] hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            selectedTransferDrive?.name === drive.name ? 'bg-[#5D5FEF]' : 'bg-gray-300'
                          }`}>
                            <Usb className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-black text-gray-900 text-sm truncate">{drive.model || drive.name}</h5>
                            <p className="text-[10px] text-gray-400 font-medium">{drive.sizeHuman} &middot; {drive.mountpoint}</p>
                          </div>
                          {selectedTransferDrive?.name === drive.name && (
                            <div className="w-6 h-6 bg-[#5D5FEF] rounded-full flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {transferDrives.length > 0 && selectedTransferDrive && (
                  <button
                    onClick={() => setShowTransferConfirm(true)}
                    className="w-full px-6 py-4 bg-[#5D5FEF] text-white rounded-xl md:rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 flex items-center justify-center gap-2"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Prepare Transfer Package
                  </button>
                )}

                {transferDrives.length === 0 && !transferDetecting && (
                  <div className="text-center py-4">
                    <Usb className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 font-medium">Insert a USB drive and click "Detect USB Drives"</p>
                  </div>
                )}
              </>
            )}

            {/* Preparing state — detailed progress */}
            {transferPhase === 'preparing' && (
              <div className="space-y-3">
                {/* Header with spinner + percent */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <Loader2 className="w-5 h-5 text-[#5D5FEF] animate-spin" />
                    </div>
                    <h4 className="text-sm font-black text-gray-900">Preparing Transfer</h4>
                  </div>
                  <span className="text-lg font-black text-[#5D5FEF] tabular-nums">{transferProgress}%</span>
                </div>

                {/* Main progress bar */}
                <div className="w-full h-2.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#5D5FEF] to-[#7C6FF7] rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${transferProgress}%` }}
                  />
                </div>

                {/* Phase steps */}
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider">
                  {[
                    { id: 'db', label: 'Database', phases: ['exporting-db'] },
                    { id: 'files', label: 'Files', phases: ['copying-files'] },
                    { id: 'finalize', label: 'Finalize', phases: ['writing-manifest'] },
                  ].map((step, i) => {
                    const phase = transferStatus?.phase || '';
                    const isActive = step.phases.includes(phase);
                    const isDone = (() => {
                      const phaseOrder = ['exporting-db', 'copying-files', 'writing-manifest', 'done'];
                      const currentIdx = phaseOrder.indexOf(phase);
                      const stepIdx = phaseOrder.indexOf(step.phases[0]);
                      return currentIdx > stepIdx;
                    })();
                    return (
                      <React.Fragment key={step.id}>
                        {i > 0 && <div className={`flex-1 h-px ${isDone ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`} />}
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                          isActive ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]' :
                          isDone ? 'text-[#5D5FEF]' : 'text-gray-300'
                        }`}>
                          {isDone ? <Check className="w-3 h-3" /> : isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="w-3 h-3 rounded-full border border-current inline-block" />}
                          {step.label}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Current activity */}
                <div className="bg-[#F5F5F7] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-500 font-medium truncate max-w-[75%]">{transferMessage || 'Preparing...'}</p>
                    {transferStatus?.speedBps > 0 && (
                      <span className="text-[9px] font-bold text-[#5D5FEF] flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" />
                        {transferStatus.speedBps > 1024 * 1024
                          ? `${(transferStatus.speedBps / (1024 * 1024)).toFixed(1)} MB/s`
                          : `${(transferStatus.speedBps / 1024).toFixed(0)} KB/s`}
                      </span>
                    )}
                  </div>
                  {/* Current file name */}
                  {transferStatus?.currentFile && transferStatus.phase === 'copying-files' && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <p className="text-[10px] text-gray-400 truncate">{transferStatus.currentFile}</p>
                    </div>
                  )}
                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-[9px] text-gray-400 font-medium">
                    {transferStatus?.filesCopied > 0 && (
                      <span>{transferStatus.filesCopied.toLocaleString()}/{transferStatus.totalFiles.toLocaleString()} files</span>
                    )}
                    {transferStatus?.bytesWritten > 0 && (
                      <span>
                        {transferStatus.bytesWritten > 1024 * 1024 * 1024
                          ? `${(transferStatus.bytesWritten / (1024 * 1024 * 1024)).toFixed(2)} GB`
                          : transferStatus.bytesWritten > 1024 * 1024
                          ? `${(transferStatus.bytesWritten / (1024 * 1024)).toFixed(1)} MB`
                          : `${(transferStatus.bytesWritten / 1024).toFixed(0)} KB`}
                        {' written'}
                      </span>
                    )}
                    {transferStatus?.etaSeconds > 0 && transferStatus.etaSeconds < 86400 && (
                      <span className="ml-auto">
                        ~{transferStatus.etaSeconds > 60
                          ? `${Math.floor(transferStatus.etaSeconds / 60)}m ${transferStatus.etaSeconds % 60}s`
                          : `${transferStatus.etaSeconds}s`} remaining
                      </span>
                    )}
                  </div>
                </div>

                {/* DB Tables export status */}
                {transferStatus?.dbRows && transferStatus.dbRows.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Database Tables</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {transferStatus.dbRows.map((row: any) => {
                        const icon = row.table === 'Recent Files' ? History
                          : row.table === 'Activity Log' ? FileText
                          : row.table === 'Notifications' ? Bell
                          : row.table === 'Settings' ? Server
                          : row.table === 'Connected Apps' ? Zap
                          : Database;
                        const Icon = icon;
                        const isDone = row.imported >= row.total && row.total > 0;
                        const isEmpty = row.total === 0;
                        return (
                          <div key={row.table} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${
                            isDone ? 'bg-green-50' : isEmpty ? 'bg-gray-50' : 'bg-[#5D5FEF]/5'
                          }`}>
                            <Icon className={`w-3 h-3 flex-shrink-0 ${
                              isDone ? 'text-green-500' : isEmpty ? 'text-gray-300' : 'text-[#5D5FEF]'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-[9px] font-bold truncate ${
                                isDone ? 'text-green-700' : isEmpty ? 'text-gray-400' : 'text-gray-600'
                              }`}>{row.table}</p>
                            </div>
                            <span className={`text-[8px] font-bold tabular-nums ${
                              isDone ? 'text-green-500' : isEmpty ? 'text-gray-300' : 'text-[#5D5FEF]'
                            }`}>
                              {isEmpty ? '—' : isDone ? <Check className="w-3 h-3" /> : `${row.imported}/${row.total}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Per-category file progress */}
                {transferStatus?.categories && transferStatus.categories.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">File Categories</p>
                    <div className="space-y-1.5">
                      {transferStatus.categories.filter((c: any) => c.totalFiles > 0).map((cat: any) => {
                        const catIcons: Record<string, any> = {
                          files: FolderOpen, photos: Image, videos: Video, music: Music, shared: Share2, databases: Database,
                        };
                        const CatIcon = catIcons[cat.name] || FolderOpen;
                        const pct = cat.totalFiles > 0 ? Math.round((cat.filesCopied / cat.totalFiles) * 100) : 0;
                        const isActive = transferStatus.currentCategory === cat.name && !cat.done;
                        return (
                          <div key={cat.name} className={`rounded-lg p-2 ${isActive ? 'bg-[#5D5FEF]/5 ring-1 ring-[#5D5FEF]/20' : cat.done ? 'bg-green-50/60' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <CatIcon className={`w-3.5 h-3.5 flex-shrink-0 ${cat.done ? 'text-green-500' : isActive ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                              <span className={`text-[10px] font-bold flex-1 ${cat.done ? 'text-green-700' : 'text-gray-700'}`}>{cat.label}</span>
                              <span className={`text-[9px] font-bold tabular-nums ${cat.done ? 'text-green-500' : 'text-gray-400'}`}>
                                {cat.done ? <Check className="w-3 h-3" /> : `${cat.filesCopied}/${cat.totalFiles}`}
                              </span>
                            </div>
                            <div className="w-full h-1 bg-gray-200/60 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-300 ${
                                cat.done ? 'bg-green-400' : 'bg-[#5D5FEF]'
                              }`} style={{ width: `${cat.done ? 100 : pct}%` }} />
                            </div>
                            {cat.bytesCopied > 0 && (
                              <p className="text-[8px] text-gray-400 mt-0.5">
                                {cat.bytesCopied > 1024 * 1024 * 1024
                                  ? `${(cat.bytesCopied / (1024 * 1024 * 1024)).toFixed(2)} GB`
                                  : cat.bytesCopied > 1024 * 1024
                                  ? `${(cat.bytesCopied / (1024 * 1024)).toFixed(1)} MB`
                                  : `${(cat.bytesCopied / 1024).toFixed(0)} KB`}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Done state */}
            {transferPhase === 'done' && (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <h4 className="text-base font-black text-gray-900">Transfer Package Ready</h4>
                  <p className="text-[11px] text-gray-400 font-medium max-w-xs mx-auto mt-1">
                    Safely eject the USB drive, plug it into your new device, and run Arcellite — the setup wizard will detect it automatically.
                  </p>
                </div>

                {/* Transfer summary */}
                {transferStatus && (
                  <div className="bg-[#F5F5F7] rounded-xl p-3 space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Transfer Summary</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-sm font-black text-gray-900">{(transferStatus.totalFiles || 0).toLocaleString()}</p>
                        <p className="text-[8px] text-gray-400 font-bold uppercase">Files</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-gray-900">
                          {(transferStatus.bytesWritten || 0) > 1024 * 1024 * 1024
                            ? `${((transferStatus.bytesWritten || 0) / (1024 * 1024 * 1024)).toFixed(1)} GB`
                            : `${((transferStatus.bytesWritten || 0) / (1024 * 1024)).toFixed(0)} MB`}
                        </p>
                        <p className="text-[8px] text-gray-400 font-bold uppercase">Data</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-gray-900">
                          {transferStatus.dbRows ? transferStatus.dbRows.reduce((s: number, r: any) => s + (r.imported || r.total || 0), 0).toLocaleString() : '—'}
                        </p>
                        <p className="text-[8px] text-gray-400 font-bold uppercase">Records</p>
                      </div>
                    </div>

                    {/* Category breakdown */}
                    {transferStatus.categories && transferStatus.categories.filter((c: any) => c.totalFiles > 0).length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1 border-t border-gray-200/60">
                        {transferStatus.categories.filter((c: any) => c.totalFiles > 0).map((cat: any) => {
                          const catIcons: Record<string, any> = {
                            files: FolderOpen, photos: Image, videos: Video, music: Music, shared: Share2, databases: Database,
                          };
                          const CatIcon = catIcons[cat.name] || FolderOpen;
                          return (
                            <span key={cat.name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-full text-[8px] font-bold text-gray-500">
                              <CatIcon className="w-2.5 h-2.5" />
                              {cat.label}: {cat.totalFiles}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => { setTransferPhase('idle'); setTransferDrives([]); setSelectedTransferDrive(null); setTransferStatus(null); }}
                  className="w-full px-6 py-3 bg-[#F5F5F7] text-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                  Done
                </button>
              </div>
            )}

            {/* Error state */}
            {transferPhase === 'error' && (
              <div className="text-center py-4 space-y-3">
                <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
                <h4 className="text-base font-black text-gray-900">Transfer Failed</h4>
                <p className="text-xs text-red-400 font-medium max-w-sm mx-auto">{transferMessage}</p>
                <button
                  onClick={() => { setTransferPhase('idle'); setTransferStatus(null); }}
                  className="px-6 py-3 bg-[#F5F5F7] text-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all mt-2"
                >
                  Try Again
                </button>
              </div>
            )}
          </section>

      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">Delete Account</h3>
            <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
              This will permanently delete your account, all files, sessions, and data. You will be redirected to the setup wizard to create a new account.
            </p>
            <div className="mb-4">
              <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Type "DELETE" to confirm</label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-3 bg-[#F5F5F7] rounded-2xl border border-transparent focus:border-red-300 focus:bg-white transition-all text-[15px] outline-none font-medium text-center tracking-widest"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                className="py-4 bg-[#F5F5F7] text-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                className="py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Files Confirmation Modal */}
      {showClearFilesConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowClearFilesConfirm(false)}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                <FileX className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">Clear All Files</h3>
            <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
              This will permanently remove all uploaded files from your cloud storage. Your account, settings, and databases will remain intact.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowClearFilesConfirm(false)} className="py-4 bg-[#F5F5F7] text-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">Cancel</button>
              <button onClick={handleClearFiles} disabled={isClearingFiles} className="py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
                {isClearingFiles ? <><Loader2 className="w-4 h-4 animate-spin" /> Clearing...</> : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Settings Confirmation Modal */}
      {showResetSettingsConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowResetSettingsConfirm(false)}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                <RotateCcw className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">Reset Preferences</h3>
            <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
              This will restore all system preferences to their default values — notifications on, auto mirroring off, vault lockdown off, and built-in storage.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowResetSettingsConfirm(false)} className="py-4 bg-[#F5F5F7] text-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">Cancel</button>
              <button onClick={handleResetSettings} disabled={isResettingSettings} className="py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
                {isResettingSettings ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting...</> : 'Reset All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge Databases Confirmation Modal */}
      {showPurgeDatabasesConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowPurgeDatabasesConfirm(false)}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                <Database className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">Purge Databases</h3>
            <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
              This will permanently drop all user-created databases. Your account, files, and the core system database will remain intact.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowPurgeDatabasesConfirm(false)} className="py-4 bg-[#F5F5F7] text-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">Cancel</button>
              <button onClick={handlePurgeDatabases} disabled={isPurgingDatabases} className="py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
                {isPurgingDatabases ? <><Loader2 className="w-4 h-4 animate-spin" /> Purging...</> : 'Purge All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Confirmation Modal */}
      {showTransferConfirm && selectedTransferDrive && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowTransferConfirm(false)}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-[#5D5FEF]/10 rounded-2xl flex items-center justify-center">
                <ArrowRightLeft className="w-8 h-8 text-[#5D5FEF]" />
              </div>
            </div>
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">Prepare Transfer?</h3>
            <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
              This will copy your account, files, databases, and settings to <strong>{selectedTransferDrive.model || selectedTransferDrive.name}</strong>. Existing data on the drive won't be affected.
            </p>
            <div className="bg-[#F5F5F7] rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <Usb className="w-5 h-5 text-[#5D5FEF]" />
                <div>
                  <p className="text-sm font-black text-gray-900">{selectedTransferDrive.model || selectedTransferDrive.name}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{selectedTransferDrive.sizeHuman} &middot; {selectedTransferDrive.mountpoint}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowTransferConfirm(false)}
                className="py-4 bg-[#F5F5F7] text-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={startTransfer}
                className="py-4 bg-[#5D5FEF] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 flex items-center justify-center gap-2"
              >
                Start Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettingsView;
