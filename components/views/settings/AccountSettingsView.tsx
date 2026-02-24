
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  Shield,
  Bell,
  Check,
  Settings,
  HardDrive,
  Zap,
  X,
  Loader2,
  Trash2,
  AlertTriangle,
  LogIn,
  ArrowRightLeft,
  Usb,
  CheckCircle,
  RefreshCw,
  FileX,
  RotateCcw,
  Database,
  FolderOpen,
  Image,
  Video,
  Music,
  Share2,
  FileText,
  History,
  Server,
  Link,
  Upload,
  Camera,
  MailCheck,
  Mail,
  BadgeCheck,
  ShieldAlert,
} from 'lucide-react';
import { authApi, setSessionToken } from '@/services/api.client';
import type { UserData, RemovableDeviceInfo } from '@/types';

interface AccountSettingsViewProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  onNavigate?: (tab: string) => void;
  user?: UserData | null;
  onUserUpdate?: (user: UserData) => void;
  onDeleteAccount?: () => void;
  isMobile?: boolean;
}

const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({ selectedModel, onModelChange, onNavigate, user, onUserUpdate, onDeleteAccount, isMobile }) => {
  const [settingsSection, setSettingsSection] = useState<'profile' | 'preferences' | 'danger' | 'transfer' | 'verification'>('profile');
  const [storageDevice, setStorageDevice] = useState<'builtin' | 'external'>('builtin');
  const [notifications, setNotifications] = useState(true);
  const [autoMirroring, setAutoMirroring] = useState(true);
  const [vaultLockdown, setVaultLockdown] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  const [editAvatarMode, setEditAvatarMode] = useState<'none' | 'upload' | 'link'>('none');
  const [editSaving, setEditSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
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
  // USB storage selection modal state
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [storageDrives, setStorageDrives] = useState<RemovableDeviceInfo[]>([]);
  const [storageDrivesLoading, setStorageDrivesLoading] = useState(false);
  const [selectedStorageDrive, setSelectedStorageDrive] = useState<RemovableDeviceInfo | null>(null);
  const [currentStoragePath, setCurrentStoragePath] = useState<string>('');
  // Transfer progress state
  const [storageTransferring, setStorageTransferring] = useState(false);
  const [storageTransferPercent, setStorageTransferPercent] = useState(0);
  const [storageTransferMessage, setStorageTransferMessage] = useState('');
  const [storageTransferDone, setStorageTransferDone] = useState(false);
  const [storageTransferError, setStorageTransferError] = useState<string | null>(null);
  const [storageTransferTotal, setStorageTransferTotal] = useState(0);
  const [storageTransferPhase, setStorageTransferPhase] = useState('');
  const [storageTransferCopied, setStorageTransferCopied] = useState(0);
  const transferPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Email Verification state ───────────────────────────────────────────────
  const [verifyCodeSent, setVerifyCodeSent] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifySending, setVerifySending] = useState(false);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState(false);

  // Cleanup transfer polling interval on unmount
  useEffect(() => {
    return () => {
      if (transferPollRef.current) {
        clearInterval(transferPollRef.current);
        transferPollRef.current = null;
      }
    };
  }, []);

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.email || 'User';

  const userInitial = user?.firstName?.[0]?.toUpperCase() || 'U';

  const loadSettings = useCallback(async () => {
    try {
      const data = await authApi.getSettings();
      const s = data.settings;
      setNotifications(s.notificationsEnabled);
      setAutoMirroring(s.autoMirroring);
      setVaultLockdown(s.vaultLockdown);
      // Determine actual storage type from user's storagePath, not just the preference
      if (user?.storagePath) {
        setCurrentStoragePath(user.storagePath);
        const isExternal = user.storagePath.startsWith('/media/') || user.storagePath.startsWith('/mnt/');
        setStorageDevice(isExternal ? 'external' : 'builtin');
      } else {
        setStorageDevice(s.storageDevice === 'external' ? 'external' : 'builtin');
      }
    } catch (err) {
      // Silent — defaults remain
    }
  }, [user?.storagePath]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
    if (device === 'external') {
      // Open USB selection modal
      setShowStorageModal(true);
      setStorageDrivesLoading(true);
      setSelectedStorageDrive(null);
      setStorageTransferDone(false);
      setStorageTransferError(null);
      try {
        const res = await fetch('/api/system/storage');
        const data = await res.json();
        if (data.removable && data.removable.length > 0) {
          // Only show mounted drives
          const mounted = data.removable.filter((d: RemovableDeviceInfo) => d.mountpoint);
          setStorageDrives(mounted);
          // Auto-select a drive if current path matches one
          if (currentStoragePath) {
            const match = mounted.find((d: RemovableDeviceInfo) => currentStoragePath.startsWith(d.mountpoint));
            if (match) setSelectedStorageDrive(match);
          }
        } else {
          setStorageDrives([]);
        }
      } catch {
        setStorageDrives([]);
      } finally {
        setStorageDrivesLoading(false);
      }
    } else {
      // Switch to built-in — show modal with transfer progress
      setShowStorageModal(true);
      setSelectedStorageDrive(null);
      setStorageDrives([]);
      setStorageDrivesLoading(false);
      setStorageTransferDone(false);
      setStorageTransferError(null);
      // Start transfer immediately to built-in
      startStorageTransfer('~/arcellite-data');
    }
  };

  const startStorageTransfer = async (newPath: string) => {
    setStorageTransferring(true);
    setStorageTransferPercent(0);
    setStorageTransferMessage('Preparing transfer...');
    setStorageTransferDone(false);
    setStorageTransferError(null);
    setStorageTransferTotal(0);
    setStorageTransferPhase('preparing');
    setStorageTransferCopied(0);

    try {
      const token = localStorage.getItem('sessionToken');
      const response = await fetch('/api/auth/transfer-storage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPath }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Transfer request failed');
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventName = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventName = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventName === 'progress') {
                setStorageTransferPercent(data.percent || 0);
                setStorageTransferMessage(data.message || '');
                if (data.phase) setStorageTransferPhase(data.phase);
                if (data.totalFiles !== undefined) setStorageTransferTotal(data.totalFiles);
                if (data.copiedCount !== undefined) setStorageTransferCopied(data.copiedCount);
              } else if (eventName === 'done') {
                setStorageTransferDone(true);
                setStorageTransferPercent(100);
                setStorageTransferMessage('Transfer complete!');
                setStorageTransferPhase('done');
                setStorageTransferTotal(data.totalFiles || 0);
                // Update local state
                const isExternal = newPath.startsWith('/media/') || newPath.startsWith('/mnt/');
                setStorageDevice(isExternal ? 'external' : 'builtin');
                setCurrentStoragePath(newPath);
                if (onUserUpdate && user) {
                  onUserUpdate({ ...user, storagePath: newPath });
                }
              } else if (eventName === 'error') {
                setStorageTransferError(data.error || 'Transfer failed');
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err: any) {
      setStorageTransferError(err.message || 'Transfer failed');
    } finally {
      setStorageTransferring(false);
    }
  };

  const confirmStorageDriveSelection = async () => {
    if (!selectedStorageDrive) return;
    const newPath = selectedStorageDrive.mountpoint + '/arcellite-data';
    startStorageTransfer(newPath);
  };

  const handleEditProfile = () => {
    setEditFirstName(user?.firstName || '');
    setEditLastName(user?.lastName || '');
    setEditAvatarUrl(user?.avatarUrl || '');
    setEditAvatarFile(null);
    setEditAvatarPreview('');
    setEditAvatarMode('none');
    setIsEditingProfile(true);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB limit
    setEditAvatarFile(file);
    const url = URL.createObjectURL(file);
    setEditAvatarPreview(url);
  };

  const handleSaveProfile = async () => {
    setEditSaving(true);
    try {
      let avatarUrl = editAvatarUrl.trim() || null;

      // If a file was selected, upload it first
      if (editAvatarFile) {
        const result = await authApi.uploadAvatar(editAvatarFile);
        avatarUrl = result.avatarUrl;
      }

      await authApi.updateProfile({ firstName: editFirstName, lastName: editLastName, avatarUrl });
      if (onUserUpdate && user) {
        onUserUpdate({ ...user, firstName: editFirstName, lastName: editLastName, avatarUrl });
      }
      // Cleanup preview blob URL
      if (editAvatarPreview) URL.revokeObjectURL(editAvatarPreview);
      setIsEditingProfile(false);
    } catch (err) {
      // Silent — user stays in edit mode
    } finally {
      setEditSaving(false);
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
      setCurrentStoragePath('~/arcellite-data');
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

  // ── Email Verification handlers ───────────────────────────────────────────

  const handleSendVerificationCode = async () => {
    setVerifySending(true);
    setVerifyError(null);
    try {
      const token = localStorage.getItem('sessionToken');
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      setVerifyCodeSent(true);
      setVerifyCode('');
    } catch (err: any) {
      setVerifyError(err.message || 'Failed to send verification code');
    } finally {
      setVerifySending(false);
    }
  };

  const handleSubmitVerificationCode = async () => {
    if (verifyCode.length !== 6) return;
    setVerifySubmitting(true);
    setVerifyError(null);
    try {
      const token = localStorage.getItem('sessionToken');
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setVerifySuccess(true);
      setVerifyCodeSent(false);
      setVerifyCode('');
      if (onUserUpdate && user) {
        onUserUpdate({ ...user, emailVerified: true });
      }
    } catch (err: any) {
      setVerifyError(err.message || 'Invalid or expired code');
    } finally {
      setVerifySubmitting(false);
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

      // Poll progress — BUG-004: store in ref so cleanup on unmount works
      transferPollRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/transfer/status');
          const status = await res.json();
          setTransferProgress(status.percent || 0);
          setTransferMessage(status.message || '');
          setTransferStatus(status);

          if (status.phase === 'done') {
            if (transferPollRef.current) clearInterval(transferPollRef.current);
            transferPollRef.current = null;
            setTransferPhase('done');
          } else if (status.phase === 'error') {
            if (transferPollRef.current) clearInterval(transferPollRef.current);
            transferPollRef.current = null;
            setTransferPhase('error');
            setTransferMessage(status.error || 'Transfer failed');
          }
        } catch {
          if (transferPollRef.current) clearInterval(transferPollRef.current);
          transferPollRef.current = null;
          setTransferPhase('error');
          setTransferMessage('Lost connection');
        }
      }, 800);
    } catch (e) {
      setTransferPhase('error');
      setTransferMessage('Failed to start transfer');
    }
  };


  const sidebarItems: { id: typeof settingsSection; label: string; icon: React.ElementType; danger?: boolean; badge?: boolean }[] = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Settings },
    { id: 'verification', label: 'Verification', icon: MailCheck, badge: !user?.emailVerified },
    ...(!user?.isFamilyMember ? [{ id: 'transfer' as const, label: 'Transfer', icon: ArrowRightLeft }] : []),
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, danger: true },
  ];

  return (
    <div className="py-2">
      <div className="mb-6 md:mb-8 pb-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 md:h-10 bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full flex-shrink-0" />
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 tracking-tight">Account Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your profile, preferences, and account security.</p>
          </div>
        </div>
      </div>

      <div className={`flex gap-6 md:gap-8 ${isMobile ? 'flex-col' : 'flex-row'}`}>
        {/* ── Navigation: top tabs on mobile, sidebar on desktop ── */}
        {isMobile ? (
          <div className="flex gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm flex-wrap">
            {sidebarItems.map((item) => {
              const isActive = settingsSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSettingsSection(item.id)}
                  className={`relative flex-1 min-w-0 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-[#5D5FEF] text-white shadow-sm'
                      : item.danger
                        ? 'text-gray-500 hover:bg-red-50 hover:text-red-600'
                        : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                  {item.badge && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <nav className="w-52 flex-shrink-0">
            <div className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = settingsSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSettingsSection(item.id)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-left transition-all text-[14px] font-medium ${
                      isActive
                        ? 'bg-[#F5F5F7] text-gray-900'
                        : item.danger
                          ? 'text-gray-500 hover:bg-red-50 hover:text-red-500'
                          : 'text-gray-500 hover:bg-[#F5F5F7] hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${
                      isActive
                        ? 'text-[#5D5FEF]'
                        : item.danger
                          ? 'text-gray-400 group-hover:text-red-400'
                          : 'text-gray-400'
                    }`} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* ── Content Area ── */}
        <div className="flex-1 min-w-0">

          {/* ═══ My Profile ═══ */}
          {settingsSection === 'profile' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">My Profile</h2>
                <p className="text-sm text-gray-400">Manage your personal information and avatar.</p>
              </div>

              {/* Avatar + Name row */}
              <div className="flex items-center gap-5">
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-[#5D5FEF] flex items-center justify-center">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-2xl">{userInitial}</span>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900 truncate">{displayName}</p>
                  <p className="text-sm text-gray-400 truncate">{user?.email || ''}</p>
                </div>
                <button
                  onClick={handleEditProfile}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#5D5FEF] rounded-xl hover:bg-[#4B4DD4] transition-all flex-shrink-0 shadow-sm shadow-[#5D5FEF]/20"
                >
                  Edit Profile
                </button>
              </div>

              <div className="border-t border-gray-100" />

              {/* Info fields */}
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">First Name</p>
                    <p className="text-sm text-gray-500 mt-0.5">{user?.firstName || '—'}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Last Name</p>
                    <p className="text-sm text-gray-500 mt-0.5">{user?.lastName || '—'}</p>
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email</p>
                    <p className="text-sm text-gray-500 mt-0.5">{user?.email || '—'}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Role</p>
                    <p className="text-sm text-gray-500 mt-0.5">{user?.isFamilyMember ? 'Family Member' : 'Admin'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Preferences ═══ */}
          {settingsSection === 'preferences' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Preferences</h2>
                <p className="text-sm text-gray-400">Configure notifications, security, and storage settings.</p>
              </div>

              <div className="space-y-0">
                {/* Cloud Notifications */}
                <div className="flex items-center justify-between py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <Bell className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Cloud Notifications</p>
                      <p className="text-xs text-gray-400 mt-0.5">Receive alerts for system events, security, and storage changes</p>
                    </div>
                  </div>
                  <button onClick={toggleNotifications} className={`w-10 h-[22px] rounded-full transition-all duration-200 relative flex-shrink-0 ${notifications ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`}>
                    <div className={`absolute top-[2px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-all duration-200 ${notifications ? 'left-[20px]' : 'left-[2px]'}`} />
                  </button>
                </div>

                {/* Login Alerts */}
                <div className="flex items-center justify-between py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <LogIn className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Login Alerts</p>
                      <p className="text-xs text-gray-400 mt-0.5">Get notified when a new session is started on any device</p>
                    </div>
                  </div>
                  <button onClick={toggleAutoMirroring} className={`w-10 h-[22px] rounded-full transition-all duration-200 relative flex-shrink-0 ${autoMirroring ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`}>
                    <div className={`absolute top-[2px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-all duration-200 ${autoMirroring ? 'left-[20px]' : 'left-[2px]'}`} />
                  </button>
                </div>

                {/* Vault Lockdown */}
                <div className="flex items-center justify-between py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <Shield className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Vault Lockdown</p>
                      <p className="text-xs text-gray-400 mt-0.5">Read-only mode — blocks uploads, deletes, moves, and folder creation</p>
                    </div>
                  </div>
                  <button onClick={toggleVaultLockdown} className={`w-10 h-[22px] rounded-full transition-all duration-200 relative flex-shrink-0 ${vaultLockdown ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`}>
                    <div className={`absolute top-[2px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-all duration-200 ${vaultLockdown ? 'left-[20px]' : 'left-[2px]'}`} />
                  </button>
                </div>

                {/* Storage Device */}
                {!user?.isFamilyMember && (
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <HardDrive className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Storage Device</p>
                        {currentStoragePath && (
                          <p className="text-xs text-gray-400 mt-0.5 font-mono">{currentStoragePath}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm flex-shrink-0">
                      <button
                        onClick={() => changeStorageDevice('builtin')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
                          storageDevice === 'builtin'
                            ? 'bg-[#5D5FEF] text-white shadow-sm'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        Built-in
                      </button>
                      <button
                        onClick={() => changeStorageDevice('external')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
                          storageDevice === 'external'
                            ? 'bg-[#5D5FEF] text-white shadow-sm'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        External USB
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ Transfer ═══ */}
          {settingsSection === 'transfer' && !user?.isFamilyMember && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Transfer to New Device</h2>
                <p className="text-sm text-gray-400">Move your entire Arcellite setup — account, files, databases, and settings — to another device via USB.</p>
              </div>

              {transferPhase === 'idle' && (
                <div className="space-y-5">
                  <button
                    onClick={detectTransferDrives}
                    disabled={transferDetecting}
                    className="px-5 py-2.5 text-sm font-bold bg-[#5D5FEF] text-white rounded-xl hover:bg-[#4B4DD4] transition-all flex items-center gap-2 shadow-sm shadow-[#5D5FEF]/20 disabled:opacity-50"
                  >
                    {transferDetecting ? (
                      <><Loader2 className="w-4 h-4 animate-spin text-white" /> Scanning...</>
                    ) : (
                      <><RefreshCw className="w-4 h-4 text-white" /> Detect USB Drives</>
                    )}
                  </button>

                  {transferDrives.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Select Target Drive</p>
                      {transferDrives.map((drive) => (
                        <button
                          key={drive.name}
                          onClick={() => setSelectedTransferDrive(drive)}
                          className={`w-full text-left rounded-lg p-4 border-2 transition-all ${
                            selectedTransferDrive?.name === drive.name
                              ? 'border-[#5D5FEF] bg-[#5D5FEF]/5'
                              : 'border-gray-100 bg-[#F5F5F7] hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Usb className={`w-5 h-5 flex-shrink-0 ${selectedTransferDrive?.name === drive.name ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{drive.model || drive.name}</p>
                              <p className="text-xs text-gray-400">{drive.sizeHuman} &middot; {drive.mountpoint}</p>
                            </div>
                            {selectedTransferDrive?.name === drive.name && (
                              <Check className="w-4 h-4 text-[#5D5FEF] flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {transferDrives.length > 0 && selectedTransferDrive && (
                    <button
                      onClick={() => setShowTransferConfirm(true)}
                      className="px-5 py-2.5 text-sm font-medium bg-[#5D5FEF] text-white rounded-lg hover:bg-[#4D4FCF] transition-all flex items-center gap-2"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Prepare Transfer Package
                    </button>
                  )}

                  {transferDrives.length === 0 && !transferDetecting && (
                    <div className="py-6 text-center">
                      <Usb className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Insert a USB drive and click "Detect USB Drives"</p>
                    </div>
                  )}
                </div>
              )}

              {transferPhase === 'preparing' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-[#5D5FEF] animate-spin" />
                      <p className="text-sm font-medium text-gray-900">Preparing Transfer</p>
                    </div>
                    <span className="text-sm font-bold text-[#5D5FEF] tabular-nums">{transferProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#5D5FEF] rounded-full transition-all duration-300" style={{ width: `${transferProgress}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">{transferMessage || 'Preparing...'}</p>

                  {transferStatus?.dbRows && transferStatus.dbRows.length > 0 && (
                    <div className="space-y-2.5">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Database Tables</p>
                      <div className="grid grid-cols-2 gap-2">
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
                            <div key={row.table} className={`flex items-center gap-2.5 px-3.5 py-3 rounded-lg ${isDone ? 'bg-green-50' : isEmpty ? 'bg-gray-50' : 'bg-[#5D5FEF]/5'}`}>
                              <Icon className={`w-4 h-4 flex-shrink-0 ${isDone ? 'text-green-500' : isEmpty ? 'text-gray-300' : 'text-[#5D5FEF]'}`} />
                              <span className={`text-[13px] font-medium truncate ${isDone ? 'text-green-700' : isEmpty ? 'text-gray-400' : 'text-gray-700'}`}>{row.table}</span>
                              <span className={`text-xs font-medium tabular-nums ml-auto ${isDone ? 'text-green-500' : isEmpty ? 'text-gray-300' : 'text-[#5D5FEF]'}`}>
                                {isEmpty ? '—' : isDone ? <Check className="w-3.5 h-3.5" /> : `${row.imported}/${row.total}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {transferStatus?.categories && transferStatus.categories.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">File Categories</p>
                      <div className="space-y-3">
                        {transferStatus.categories.filter((c: any) => c.totalFiles > 0).map((cat: any) => {
                          const catIcons: Record<string, any> = { files: FolderOpen, photos: Image, videos: Video, music: Music, shared: Share2, databases: Database };
                          const CatIcon = catIcons[cat.name] || FolderOpen;
                          const pct = cat.totalFiles > 0 ? Math.round((cat.filesCopied / cat.totalFiles) * 100) : 0;
                          return (
                            <div key={cat.name} className="flex items-center gap-3">
                              <CatIcon className={`w-4 h-4 flex-shrink-0 ${cat.done ? 'text-green-500' : 'text-gray-400'}`} />
                              <span className="text-[13px] font-medium text-gray-700 w-20">{cat.label}</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-300 ${cat.done ? 'bg-green-400' : 'bg-[#5D5FEF]'}`} style={{ width: `${cat.done ? 100 : pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 tabular-nums w-14 text-right">
                                {cat.done ? <Check className="w-4 h-4 text-green-500 inline" /> : `${cat.filesCopied}/${cat.totalFiles}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {transferPhase === 'done' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Transfer Package Ready</p>
                      <p className="text-xs text-gray-400">Safely eject the USB drive, plug it into your new device, and run Arcellite.</p>
                    </div>
                  </div>
                  {transferStatus && (
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <span><strong>{(transferStatus.totalFiles || 0).toLocaleString()}</strong> files</span>
                      <span>
                        <strong>
                          {(transferStatus.bytesWritten || 0) > 1024 * 1024 * 1024
                            ? `${((transferStatus.bytesWritten || 0) / (1024 * 1024 * 1024)).toFixed(1)} GB`
                            : `${((transferStatus.bytesWritten || 0) / (1024 * 1024)).toFixed(0)} MB`}
                        </strong> data
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => { setTransferPhase('idle'); setTransferDrives([]); setSelectedTransferDrive(null); setTransferStatus(null); }}
                    className="px-5 py-2.5 text-sm font-medium bg-[#F5F5F7] text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                  >
                    Done
                  </button>
                </div>
              )}

              {transferPhase === 'error' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Transfer Failed</p>
                      <p className="text-xs text-red-400">{transferMessage}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setTransferPhase('idle'); setTransferStatus(null); }}
                    className="px-5 py-2.5 text-sm font-medium bg-[#F5F5F7] text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══ Verification ═══ */}
          {settingsSection === 'verification' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Email Verification</h2>
                <p className="text-sm text-gray-400">Verify your email address to enable password reset and account recovery.</p>
              </div>

              {/* Status card */}
              {(user?.emailVerified || verifySuccess) ? (
                <div className="flex items-start gap-4 p-5 bg-[#5D5FEF]/5 border border-[#5D5FEF]/15 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0">
                    <BadgeCheck className="w-5 h-5 text-[#5D5FEF]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Email verified</p>
                    <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
                    <p className="text-xs text-gray-400 mt-1">Your email is verified. Password reset and account recovery are enabled.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4 p-5 bg-amber-50 border border-amber-100 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Email not verified</p>
                    <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
                    <p className="text-xs text-amber-700 mt-1">Without a verified email, you won't be able to reset your password if you forget it.</p>
                  </div>
                </div>
              )}

              {/* Action area — only shown if not yet verified */}
              {!(user?.emailVerified || verifySuccess) && (
                <div className="space-y-5">
                  {!verifyCodeSent ? (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-500">
                        We'll send a 6-digit verification code to <span className="font-semibold text-gray-700">{user?.email}</span>. Enter the code here to confirm your email address.
                      </p>
                      {verifyError && (
                        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <p className="text-sm text-red-700">{verifyError}</p>
                          <button onClick={() => setVerifyError(null)} className="ml-auto"><X className="w-4 h-4 text-red-400 hover:text-red-600" /></button>
                        </div>
                      )}
                      <button
                        onClick={handleSendVerificationCode}
                        disabled={verifySending}
                        className="px-5 py-2.5 text-sm font-bold text-white bg-[#5D5FEF] rounded-xl hover:bg-[#4B4DD4] transition-all flex items-center gap-2 shadow-sm shadow-[#5D5FEF]/20 disabled:opacity-50"
                      >
                        {verifySending ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                        ) : (
                          <><Mail className="w-4 h-4" /> Send Verification Code</>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-500">
                        A code was sent to <span className="font-semibold text-gray-700">{user?.email}</span>. Enter the 6-digit code below.
                      </p>
                      {verifyError && (
                        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <p className="text-sm text-red-700">{verifyError}</p>
                          <button onClick={() => setVerifyError(null)} className="ml-auto"><X className="w-4 h-4 text-red-400 hover:text-red-600" /></button>
                        </div>
                      )}
                      <div className="space-y-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={verifyCode}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          className="w-full px-4 py-3 bg-[#F5F5F7] rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-xl font-black text-center tracking-[0.4em] outline-none placeholder:text-gray-200 placeholder:tracking-[0.4em]"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={handleSubmitVerificationCode}
                            disabled={verifyCode.length !== 6 || verifySubmitting}
                            className="flex-1 py-2.5 text-sm font-bold text-white bg-[#5D5FEF] rounded-xl hover:bg-[#4B4DD4] transition-all flex items-center justify-center gap-2 shadow-sm shadow-[#5D5FEF]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {verifySubmitting ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                            ) : (
                              <><Check className="w-4 h-4" /> Confirm Code</>
                            )}
                          </button>
                          <button
                            onClick={() => { setVerifyCodeSent(false); setVerifyCode(''); setVerifyError(null); }}
                            className="px-4 py-2.5 text-sm font-bold text-gray-500 bg-[#F5F5F7] rounded-xl hover:bg-gray-200 transition-all"
                          >
                            Back
                          </button>
                        </div>
                        <button
                          onClick={handleSendVerificationCode}
                          disabled={verifySending}
                          className="text-xs text-[#5D5FEF] hover:underline disabled:opacity-50"
                        >
                          {verifySending ? 'Sending...' : 'Resend code'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Info row */}
              <div className="border-t border-gray-100 pt-6 space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Why verify?</p>
                <div className="space-y-2">
                  {[
                    'Reset your password if you forget it',
                    'Receive important security alerts',
                    'Recover your account if you lose access',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-[#5D5FEF]" />
                      </div>
                      <p className="text-sm text-gray-600">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Danger Zone ═══ */}
          {settingsSection === 'danger' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Danger Zone</h2>
                <p className="text-sm text-gray-400">Irreversible and destructive actions for your account.</p>
              </div>

              {dangerZoneSuccess && (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <p className="text-sm text-green-700">{dangerZoneSuccess}</p>
                  <button onClick={() => setDangerZoneSuccess(null)} className="ml-auto"><X className="w-4 h-4 text-green-400 hover:text-green-600" /></button>
                </div>
              )}
              {dangerZoneError && (
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{dangerZoneError}</p>
                  <button onClick={() => setDangerZoneError(null)} className="ml-auto"><X className="w-4 h-4 text-red-400 hover:text-red-600" /></button>
                </div>
              )}

              <div className="space-y-0">
                {!user?.isFamilyMember && (
                  <>
                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <FileX className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Clear All Files</p>
                          <p className="text-xs text-gray-400 mt-0.5">Remove all uploaded files from storage</p>
                        </div>
                      </div>
                      <button onClick={() => setShowClearFilesConfirm(true)} className="px-5 py-2.5 text-xs font-bold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-all">Clear</button>
                    </div>

                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <RotateCcw className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Reset Preferences</p>
                          <p className="text-xs text-gray-400 mt-0.5">Restore all settings to factory defaults</p>
                        </div>
                      </div>
                      <button onClick={() => setShowResetSettingsConfirm(true)} className="px-5 py-2.5 text-xs font-bold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-all">Reset</button>
                    </div>

                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <Database className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Purge Databases</p>
                          <p className="text-xs text-gray-400 mt-0.5">Drop all user-created databases permanently</p>
                        </div>
                      </div>
                      <button onClick={() => setShowPurgeDatabasesConfirm(true)} className="px-5 py-2.5 text-xs font-bold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-all">Purge</button>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-600">{user?.isFamilyMember ? 'Delete My Account' : 'Delete Account'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {user?.isFamilyMember
                          ? 'Permanently deletes your account and all your files.'
                          : 'Permanently delete your account and all data. This cannot be undone.'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowDeleteConfirm(true)} className="px-5 py-2.5 text-xs font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-all shadow-sm">Delete Account</button>
                </div>
              </div>
            </div>
          )}

        </div>{/* end content area */}
      </div>{/* end flex row */}

      {/* ── Edit Profile Modal ── */}
      {isEditingProfile && createPortal(
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setIsEditingProfile(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit Profile</h3>
              <button onClick={() => setIsEditingProfile(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex flex-col items-center py-4">
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
              <div className="relative mb-4">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-[#5D5FEF] flex items-center justify-center border-4 border-[#F5F5F7]">
                  {(editAvatarPreview || editAvatarUrl) ? (
                    <img src={editAvatarPreview || editAvatarUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <span className="text-white font-bold text-2xl">{(editFirstName || user?.firstName || '?')[0]?.toUpperCase()}</span>
                  )}
                </div>
                <button onClick={() => avatarInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center border border-gray-100 hover:bg-gray-50 transition-all">
                  <Camera className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
              {editAvatarFile && (
                <p className="text-xs text-emerald-500 font-medium mb-2">{editAvatarFile.name}</p>
              )}
              <div className="flex gap-2 w-full max-w-[280px]">
                      <button
                        type="button"
                        onClick={() => setEditAvatarMode(editAvatarMode === 'none' ? 'upload' : 'none')}
                        className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                          editAvatarMode === 'upload' || editAvatarMode === 'link'
                            ? 'bg-[#5D5FEF]/10 text-[#5D5FEF] border border-[#5D5FEF]/20'
                            : 'bg-[#5D5FEF] text-white shadow-lg shadow-[#5D5FEF]/20 hover:bg-[#4D4FCF]'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload Photo
                      </button>
                      {(editAvatarPreview || editAvatarUrl) && (
                        <button
                          type="button"
                          onClick={() => { setEditAvatarFile(null); setEditAvatarPreview(''); setEditAvatarUrl(''); setEditAvatarMode('none'); }}
                          className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Upload method toggle & inputs */}
                    {(editAvatarMode === 'upload' || editAvatarMode === 'link') && (
                      <div className="w-full mt-3">
                        <div className="flex bg-[#F5F5F7] rounded-xl p-1 mb-3">
                          <button
                            type="button"
                            onClick={() => setEditAvatarMode('upload')}
                            className={`flex-1 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                              editAvatarMode === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            <Upload className="w-3 h-3" />
                            From Device
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditAvatarMode('link')}
                            className={`flex-1 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                              editAvatarMode === 'link' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            <Link className="w-3 h-3" />
                            From URL
                          </button>
                        </div>
                        {editAvatarMode === 'upload' && (
                          <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            className="w-full py-3 bg-[#F5F5F7] rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#5D5FEF]/30 hover:bg-[#5D5FEF]/5 transition-all flex items-center justify-center gap-2 group"
                          >
                            <Image className="w-4 h-4 text-gray-400 group-hover:text-[#5D5FEF] transition-colors" />
                            <span className="text-[11px] font-bold text-gray-400 group-hover:text-[#5D5FEF] transition-colors">
                              {editAvatarFile ? 'Choose Different File' : 'Choose Image File'}
                            </span>
                          </button>
                        )}
                        {editAvatarMode === 'link' && (
                          <input
                            type="url"
                            value={editAvatarUrl}
                            onChange={e => { setEditAvatarUrl(e.target.value); setEditAvatarFile(null); setEditAvatarPreview(''); }}
                            placeholder="https://example.com/avatar.jpg"
                            className="w-full px-4 py-3 bg-[#F5F5F7] rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[13px] outline-none font-medium placeholder:text-gray-300"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Name fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 block">First Name</label>
                      <input type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} className="w-full px-4 py-3 bg-[#F5F5F7] rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[15px] outline-none font-medium" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Last Name</label>
                      <input type="text" value={editLastName} onChange={e => setEditLastName(e.target.value)} className="w-full px-4 py-3 bg-[#F5F5F7] rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[15px] outline-none font-medium" />
                    </div>
                    <button onClick={handleSaveProfile} disabled={editSaving} className="w-full py-4 bg-[#5D5FEF] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 disabled:opacity-50 flex items-center justify-center gap-2">
                      {editSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            , document.body)}
      {/* ── Confirmation Modals (Danger Zone) ── */}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">
              {user?.isFamilyMember ? 'Delete My Account' : 'Delete Account'}
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
              {user?.isFamilyMember
                ? `This will permanently delete your account (${user.email}), all your files, and all your sessions. Your account will be completely removed and you will no longer be able to log in. This cannot be undone.`
                : 'This will permanently delete your account, all files, sessions, and data. You will be redirected to the setup wizard to create a new account.'
              }
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
      , document.body)}

      {/* Clear Files Confirmation Modal */}
      {showClearFilesConfirm && createPortal(
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
      , document.body)}

      {/* Reset Settings Confirmation Modal */}
      {showResetSettingsConfirm && createPortal(
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
      , document.body)}

      {/* Purge Databases Confirmation Modal */}
      {showPurgeDatabasesConfirm && createPortal(
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
      , document.body)}

      {/* Transfer Confirmation Modal */}
      {showTransferConfirm && selectedTransferDrive && createPortal(
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
      , document.body)}

      {/* Storage Transfer Modal */}
      {showStorageModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => !storageTransferring && setShowStorageModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>

            {/* ── Transfer Progress View ── */}
            {(storageTransferring || storageTransferDone || storageTransferError) ? (
              <div className="text-center">
                {storageTransferDone ? (
                  <>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 mb-5">
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-black text-[#111111] mb-1">Transfer Complete</h3>
                    <p className="text-sm text-gray-400 font-medium mb-2">
                      {storageTransferTotal > 0
                        ? `${storageTransferTotal} file${storageTransferTotal !== 1 ? 's' : ''} moved successfully`
                        : 'Storage switched successfully'}
                    </p>
                    <p className="text-xs text-gray-300 font-mono mb-6">{currentStoragePath}</p>
                    <button
                      onClick={() => { setShowStorageModal(false); setStorageTransferDone(false); }}
                      className="w-full py-3 bg-[#5D5FEF] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20"
                    >
                      Done
                    </button>
                  </>
                ) : storageTransferError ? (
                  <>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 mb-5">
                      <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-black text-[#111111] mb-1">Transfer Failed</h3>
                    <p className="text-sm text-red-400 font-medium mb-6">{storageTransferError}</p>
                    <button
                      onClick={() => { setShowStorageModal(false); setStorageTransferError(null); }}
                      className="w-full py-3 bg-[#F5F5F7] text-gray-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-[#5D5FEF] animate-spin" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-base font-black text-[#111111]">Transferring Files</h3>
                          <p className="text-[11px] text-gray-400 font-medium">Do not disconnect or close this page</p>
                        </div>
                      </div>
                      <span className="text-xl font-black text-[#5D5FEF] tabular-nums">{storageTransferPercent}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#5D5FEF] to-[#7B7DFF] rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${storageTransferPercent}%` }}
                      />
                    </div>

                    {/* Step indicators */}
                    {(() => {
                      const phaseOrder = ['preparing', 'counting', 'copying', 'verifying', 'cleanup', 'updating', 'done'];
                      const currentIdx = phaseOrder.indexOf(storageTransferPhase);
                      const steps = [
                        { label: 'Prepare', phases: ['preparing', 'counting'] },
                        { label: 'Copy Files', phases: ['copying'] },
                        { label: 'Cleanup', phases: ['verifying', 'cleanup', 'updating'] },
                      ];
                      return (
                        <div className="flex items-center gap-1 mb-4 text-[9px] font-bold uppercase tracking-wider">
                          {steps.map((step, i) => {
                            const isActive = step.phases.includes(storageTransferPhase);
                            const lastPhaseIdx = phaseOrder.indexOf(step.phases[step.phases.length - 1]);
                            const isDone = currentIdx > lastPhaseIdx;
                            return (
                              <React.Fragment key={step.label}>
                                {i > 0 && <div className={`flex-1 h-px ${isDone || (isActive && i > 0) ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`} />}
                                <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                                  isActive ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]' : isDone ? 'text-[#5D5FEF]' : 'text-gray-300'
                                }`}>
                                  {isDone
                                    ? <Check className="w-3 h-3" />
                                    : isActive
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <span className="w-3 h-3 rounded-full border border-current inline-block" />}
                                  {step.label}
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Current activity info */}
                    <div className="bg-[#F5F5F7] rounded-xl p-3 space-y-2 text-left">
                      <p className="text-[10px] text-gray-500 font-medium truncate">{storageTransferMessage || 'Preparing...'}</p>
                      {storageTransferPhase === 'copying' && storageTransferTotal > 0 && (
                        <div className="flex items-center justify-between text-[9px] text-gray-400 font-medium">
                          <span className="flex items-center gap-1">
                            <FileText className="w-2.5 h-2.5" />
                            {storageTransferCopied.toLocaleString()} / {storageTransferTotal.toLocaleString()} files
                          </span>
                          <span>{Math.round((storageTransferCopied / storageTransferTotal) * 100)}% of files</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* ── Drive Selection View ── */
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-black text-[#111111]">Select USB Drive</h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">All files will be transferred to the selected drive</p>
                  </div>
                  <button
                    onClick={() => setShowStorageModal(false)}
                    className="w-8 h-8 rounded-xl bg-[#F5F5F7] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                  {storageDrivesLoading && (
                    <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-medium">Detecting external drives...</span>
                    </div>
                  )}

                  {!storageDrivesLoading && storageDrives.length === 0 && (
                    <div className="text-center py-8">
                      <Usb className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm text-gray-400 font-medium">No external drives detected</p>
                      <p className="text-xs text-gray-300 mt-1">Connect a USB drive and try again</p>
                    </div>
                  )}

                  {!storageDrivesLoading && storageDrives.map((drive) => (
                    <button
                      key={drive.mountpoint}
                      type="button"
                      onClick={() => setSelectedStorageDrive(drive)}
                      className={`w-full text-left rounded-2xl p-5 border-2 transition-all ${
                        selectedStorageDrive?.mountpoint === drive.mountpoint
                          ? 'border-[#5D5FEF] bg-[#5D5FEF]/5'
                          : 'border-gray-100 bg-[#F5F5F7] hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          selectedStorageDrive?.mountpoint === drive.mountpoint ? 'bg-[#5D5FEF]' : 'bg-gray-300'
                        }`}>
                          <Usb className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-[#111111] text-sm">{drive.label || drive.model || drive.name}</h4>
                          <p className="text-xs text-gray-400 font-medium mt-0.5">
                            {drive.sizeHuman} &middot; {drive.mountpoint}
                          </p>
                        </div>
                        {selectedStorageDrive?.mountpoint === drive.mountpoint && (
                          <CheckCircle className="w-5 h-5 text-[#5D5FEF] flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button
                    onClick={() => setShowStorageModal(false)}
                    className="py-3 bg-[#F5F5F7] text-gray-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmStorageDriveSelection}
                    disabled={!selectedStorageDrive}
                    className="py-3 bg-[#5D5FEF] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Transfer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default AccountSettingsView;
