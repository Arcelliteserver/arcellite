import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, HardDrive, MapPin, MoreVertical, Eye, EyeOff } from 'lucide-react';

const CableIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 -960 960 960" fill="currentColor">
    <path d="M200-120q-17 0-28.5-11.5T160-160v-40h-40v-160q0-17 11.5-28.5T160-400h40v-280q0-66 47-113t113-47q66 0 113 47t47 113v400q0 33 23.5 56.5T600-200q33 0 56.5-23.5T680-280v-280h-40q-17 0-28.5-11.5T600-600v-160h40v-40q0-17 11.5-28.5T680-840h80q17 0 28.5 11.5T800-800v40h40v160q0 17-11.5 28.5T800-560h-40v280q0 66-47 113t-113 47q-66 0-113-47t-47-113v-400q0-33-23.5-56.5T360-760q-33 0-56.5 23.5T280-680v280h40q17 0 28.5 11.5T360-360v160h-40v40q0 17-11.5 28.5T280-120h-80Z"/>
  </svg>
);
import type { RemovableDeviceInfo, SystemStorageResponse } from '@/types';

const SdCardIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 -960 960 960" fill="currentColor">
    <path d="M360-520h80v-160h-80v160Zm120 0h80v-160h-80v160Zm120 0h80v-160h-80v160ZM240-80q-33 0-56.5-23.5T160-160v-480l240-240h320q33 0 56.5 23.5T800-800v640q0 33-23.5 56.5T720-80H240Zm0-80h480v-640H434L240-606v446Zm0 0h480-480Z"/>
  </svg>
);

const STORAGE_API = '/api/system/storage';
const MOUNT_API = '/api/system/mount';
const UNMOUNT_API = '/api/system/unmount';
const FORMAT_API = '/api/system/format';

interface RemovableStorageViewProps {
  onMountedDeviceOpen?: (device: RemovableDeviceInfo) => void;
}

// Separate device card component to avoid hooks in map
interface DeviceCardProps {
  dev: RemovableDeviceInfo;
  label: string;
  isMounting: boolean;
  isUnmounting: boolean;
  onMount: (dev: RemovableDeviceInfo) => void;
  onUnmount: (dev: RemovableDeviceInfo) => void;
  onEditLabel: (dev: RemovableDeviceInfo) => void;
  onOpen: (dev: RemovableDeviceInfo) => void;
  onFormat: (dev: RemovableDeviceInfo) => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({
  dev,
  label,
  isMounting,
  isUnmounting,
  onMount,
  onUnmount,
  onEditLabel,
  onOpen,
  onFormat,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const canOpen = !!dev.mountpoint;
  const busy = isMounting || isUnmounting;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <div className="w-full bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col relative">
      {/* Header: Icon, Name, Status, Menu */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            {dev.deviceType === 'sd_card' ? (
              <SdCardIcon className="w-5 h-5 text-[#5D5FEF]" />
            ) : dev.deviceType === 'emmc' || dev.deviceType === 'portable' ? (
              <HardDrive className="w-5 h-5 text-[#5D5FEF]" />
            ) : (
              <CableIcon className="w-5 h-5 text-[#5D5FEF]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-gray-900 truncate">{label}</p>
            {canOpen && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-[8px] font-black uppercase rounded tracking-wider">
                Connected
              </span>
            )}
          </div>
        </div>

        {/* Menu Button */}
        {canOpen && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-50 w-40 bg-white rounded-lg border border-gray-200 shadow-lg py-1 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    onEditLabel(dev);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-xs"
                >
                  Edit Label
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUnmount(dev);
                    setMenuOpen(false);
                  }}
                  disabled={busy}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-xs disabled:opacity-50"
                >
                  {isUnmounting ? 'Unmounting…' : 'Unmount'}
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    onFormat(dev);
                    setMenuOpen(false);
                  }}
                  disabled={busy}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-xs disabled:opacity-50"
                >
                  Format
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Row: Size, Usage & Label */}
      <div className="flex flex-col gap-2 mb-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <HardDrive className="w-3.5 h-3.5 text-gray-400" />
            <span>{dev.sizeHuman}</span>
          </div>
          <div className="text-xs font-bold text-gray-500 truncate max-w-[120px]" title={dev.label || dev.name}>
            {dev.label || dev.mountpoint?.split('/').pop() || dev.name}
          </div>
        </div>
        {/* Usage bar — only when mounted and usage data available */}
        {canOpen && dev.fsUsedHuman && dev.fsAvailHuman && (
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
              <span><span className="font-bold text-gray-700">{dev.fsUsedHuman}</span> used</span>
              <span><span className="font-bold text-green-600">{dev.fsAvailHuman}</span> free</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#5D5FEF] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(dev.fsUsedPercent ?? 0, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={() => {
          if (canOpen) {
            onOpen(dev);
          } else {
            onMount(dev);
          }
        }}
        disabled={busy}
        className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 ${
          canOpen
            ? 'bg-[#5D5FEF] text-white hover:bg-[#4D4FDF] disabled:opacity-50'
            : 'bg-[#5D5FEF]/10 text-[#5D5FEF] hover:bg-[#5D5FEF]/20 disabled:opacity-50'
        }`}
      >
        {isMounting ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Mounting…
          </>
        ) : canOpen ? (
          'View'
        ) : (
          'Mount'
        )}
      </button>
    </div>
  );
};

const RemovableStorageView: React.FC<RemovableStorageViewProps> = ({ onMountedDeviceOpen }) => {
  const [data, setData] = useState<SystemStorageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [mountingDevice, setMountingDevice] = useState<string | null>(null);
  const [unmountingDevice, setUnmountingDevice] = useState<string | null>(null);
  const [mountError, setMountError] = useState<string | null>(null);
  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    device: RemovableDeviceInfo | null;
    action: 'mount' | 'unmount';
  }>({ isOpen: false, device: null, action: 'mount' });
  const [password, setPassword] = useState('');
  const [formatModal, setFormatModal] = useState<{
    isOpen: boolean;
    device: RemovableDeviceInfo | null;
  }>({ isOpen: false, device: null });
  const [formatFs, setFormatFs] = useState('exfat');
  const [formatLabel, setFormatLabel] = useState('');
  const [formatting, setFormatting] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [formatPassword, setFormatPassword] = useState('');
  const [formatNeedsPassword, setFormatNeedsPassword] = useState(false);
  const [showFormatPassword, setShowFormatPassword] = useState(false);

  const fetchStorage = useCallback(async () => {
    try {
      setError(false);
      const res = await fetch(STORAGE_API);
      if (!res.ok) throw new Error('Storage API error');
      const json: SystemStorageResponse = await res.json();
      setData(json);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStorage();
  }, [fetchStorage]);

  // SSE: auto-refresh when USB devices are plugged/unplugged
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnect: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource('/api/system/usb-events');
      es.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'change') {
            fetchStorage();
          }
        } catch {}
      };
      es.onerror = () => {
        es?.close();
        reconnect = setTimeout(connect, 10000);
      };
    };
    connect();

    return () => {
      es?.close();
      clearTimeout(reconnect);
    };
  }, [fetchStorage]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('removableLabels');
      if (raw) setLabels(JSON.parse(raw));
    } catch {}
  }, []);

  const editLabel = (dev: RemovableDeviceInfo) => {
    const current = labels[dev.name] || dev.model || dev.name;
    const v = prompt('Label for device:', current);
    if (v == null) return;
    const next = { ...labels, [dev.name]: v };
    setLabels(next);
    try {
      localStorage.setItem('removableLabels', JSON.stringify(next));
    } catch {}
  };

  const handleMount = async (dev: RemovableDeviceInfo, password?: string) => {
    setMountError(null);
    setMountingDevice(dev.name);

    try {
      const res = await fetch(MOUNT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: dev.name,
          password: password || '',
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        mountpoint?: string;
        error?: string;
        requiresAuth?: boolean;
      };

      if (res.status === 401 && json.requiresAuth) {
        // Server needs sudo password — show the password modal only if not already providing one
        if (!password) {
          setPasswordModal({ isOpen: true, device: dev, action: 'mount' });
          setMountingDevice(null);
          return;
        }
        // Wrong password — show error but close modal
        setPasswordModal({ isOpen: false, device: null, action: 'mount' });
        setPassword('');
        setMountError(json.error || 'Incorrect password');
        setMountingDevice(null);
        return;
      }

      if (!res.ok) throw new Error(json.error || 'Mount failed');

      // Mount succeeded — close modal and refresh
      setPasswordModal({ isOpen: false, device: null, action: 'mount' });
      setPassword('');
      setMountError(null);
      await fetchStorage();
    } catch (e) {
      setPasswordModal({ isOpen: false, device: null, action: 'mount' });
      setPassword('');
      setMountError((e as Error).message);
    } finally {
      setMountingDevice(null);
    }
  };

  const handlePasswordSubmit = () => {
    if (passwordModal.device && password) {
      if (passwordModal.action === 'unmount') {
        handleUnmount(passwordModal.device, password);
      } else {
        handleMount(passwordModal.device, password);
      }
    }
  };

  const handleUnmount = async (dev: RemovableDeviceInfo, password?: string) => {
    setMountError(null);
    setUnmountingDevice(dev.name);
    try {
      const res = await fetch(UNMOUNT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: dev.name, password: password || '' }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        requiresAuth?: boolean;
      };

      if (res.status === 401 && json.requiresAuth) {
        if (!password) {
          setPasswordModal({ isOpen: true, device: dev, action: 'unmount' });
          setUnmountingDevice(null);
          return;
        }
        // Wrong password — close modal and show error
        setPasswordModal({ isOpen: false, device: null, action: 'mount' });
        setPassword('');
        setMountError(json.error || 'Incorrect password');
        setUnmountingDevice(null);
        return;
      }

      if (!res.ok) throw new Error(json.error || 'Unmount failed');

      setPasswordModal({ isOpen: false, device: null, action: 'mount' });
      setPassword('');
      setMountError(null);
      await fetchStorage();
    } catch (e) {
      setPasswordModal({ isOpen: false, device: null, action: 'mount' });
      setPassword('');
      setMountError((e as Error).message);
    } finally {
      setUnmountingDevice(null);
    }
  };

  const handleFormat = async () => {
    if (!formatModal.device) return;
    setFormatting(true);
    setFormatError(null);
    try {
      const res = await fetch(FORMAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: formatModal.device.name,
          filesystem: formatFs,
          label: formatLabel,
          ...(formatPassword ? { password: formatPassword } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        requiresAuth?: boolean;
      };

      if (res.status === 401 && json.requiresAuth) {
        setFormatNeedsPassword(true);
        setFormatError('Enter your sudo password to format this device');
        return;
      }

      if (!res.ok) throw new Error(json.error || 'Format failed');

      setFormatModal({ isOpen: false, device: null });
      setFormatLabel('');
      setFormatPassword('');
      setFormatNeedsPassword(false);
      await fetchStorage();
    } catch (e) {
      setFormatError((e as Error).message);
    } finally {
      setFormatting(false);
    }
  };

  const root = data?.rootStorage ?? null;
  const removable = data?.removable ?? [];

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-10 gap-4">
        <div className="relative flex-1 min-w-0">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-heading font-bold tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative">
            External Storage
          </h2>
          <p className="text-gray-500 font-medium text-xs md:text-sm pl-3 sm:pl-4 md:pl-6 mt-1">Manage USB drives, SD cards, and connected storage devices</p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchStorage();
          }}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5D5FEF] text-white hover:bg-[#4B4DD4] font-bold text-xs transition-all disabled:opacity-60 shadow-sm shadow-[#5D5FEF]/20 flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Storage overview – main disk — dark card */}
      {!loading && !error && root && (
        <div className="mb-6 md:mb-8 rounded-2xl sm:rounded-3xl bg-[#1d1d1f] border border-[#2d2d2f] p-6 sm:p-8 md:p-10 shadow-xl shadow-black/10 overflow-hidden relative">
          <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#5D5FEF]/15 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                  <HardDrive className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Main Disk Storage</p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-heading font-bold text-white leading-tight">{root.usedHuman}</span>
                    <span className="text-sm text-white/40">used</span>
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-5 md:gap-8">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Total</p>
                  <p className="text-lg md:text-xl font-heading font-bold text-white">{root.totalHuman}</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Available</p>
                  <p className="text-lg md:text-xl font-heading font-bold text-emerald-400">{root.availableHuman}</p>
                </div>
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-white/10 mb-3 overflow-hidden">
              <div className="h-full bg-[#5D5FEF] rounded-full transition-all duration-700" style={{ width: `${Math.min(root.usedPercent ?? 0, 100)}%` }} />
            </div>
            <p className="text-[11px] font-bold text-white/40">{root.usedPercent}% of total storage used</p>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <CableIcon className="w-14 h-14 mb-4 animate-pulse" />
          <p className="text-sm font-bold">Loading devices…</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800 text-sm font-medium">
          Could not load removable storage. Make sure the server is running and has access to system info.
        </div>
      )}

      {!loading && !error && removable.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <CableIcon className="w-14 h-14 mb-4" />
          <p className="text-sm font-bold uppercase tracking-wider">No USB drives or SD cards connected</p>
          <p className="text-xs mt-2 text-gray-400">Connect a USB drive or insert an SD card to see it here.</p>
        </div>
      )}

      {mountError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 text-sm font-medium">
          {mountError}
        </div>
      )}

      {!loading && !error && removable.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">Connected Devices</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {removable.map((dev: RemovableDeviceInfo, i: number) => (
            <DeviceCard
              key={`${dev.name}-${i}`}
              dev={dev}
              label={labels[dev.name] || dev.model || dev.name}
              isMounting={mountingDevice === dev.name}
              isUnmounting={unmountingDevice === dev.name}
              onMount={handleMount}
              onUnmount={handleUnmount}
              onEditLabel={editLabel}
              onOpen={onMountedDeviceOpen || (() => {})}
              onFormat={(dev) => {
                setFormatModal({ isOpen: true, device: dev });
                setFormatFs('exfat');
                setFormatLabel('');
                setFormatError(null);
              }}
            />
          ))}
          </div>
        </div>
      )}

      {/* Password Modal */}
      {passwordModal.isOpen && passwordModal.device && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-gray-900 mb-2">Authentication Required</h3>
            <p className="text-sm text-gray-600 mb-6">
              Enter your system password to {passwordModal.action} <span className="font-bold">{passwordModal.device.model || passwordModal.device.name}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  System Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && password) {
                      handlePasswordSubmit();
                    } else if (e.key === 'Escape') {
                      setPasswordModal({ isOpen: false, device: null, action: 'mount' });
                      setPassword('');
                    }
                  }}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#5D5FEF] focus:outline-none text-sm font-medium transition-colors"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPasswordModal({ isOpen: false, device: null, action: 'mount' });
                    setPassword('');
                  }}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-gray-700 bg-white border-2 border-gray-200 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  disabled={!password}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-white bg-[#5D5FEF] hover:bg-[#4D4FCF] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#5D5FEF]/25"
                >
                  {passwordModal.action === 'unmount' ? 'Unmount' : 'Mount'}
                </button>
              </div>
            </div>

            {mountError && (
              <div className="mt-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl">
                <p className="text-sm text-red-700 font-medium">{mountError}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Format Confirmation Modal */}
      {formatModal.isOpen && formatModal.device && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-gray-900 mb-2">Format Device</h3>
            <p className="text-sm text-gray-600 mb-1">
              Format <span className="font-bold">{formatModal.device.model || formatModal.device.name}</span> ({formatModal.device.sizeHuman})
            </p>
            <p className="text-xs text-red-500 font-bold mb-6">
              ⚠ This will permanently erase all data on the device.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  File System
                </label>
                <select
                  value={formatFs}
                  onChange={(e) => setFormatFs(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#5D5FEF] focus:outline-none text-sm font-medium transition-colors bg-white"
                >
                  <option value="exfat">exFAT (recommended — works on all OS)</option>
                  <option value="vfat">FAT32 (max 4GB file size)</option>
                  <option value="ext4">ext4 (Linux only)</option>
                  <option value="ntfs">NTFS (Windows compatible)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  Volume Label (optional)
                </label>
                <input
                  type="text"
                  value={formatLabel}
                  onChange={(e) => setFormatLabel(e.target.value)}
                  placeholder="e.g. MY_DRIVE"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#5D5FEF] focus:outline-none text-sm font-medium transition-colors"
                />
              </div>

              {formatNeedsPassword && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                    Sudo Password
                  </label>
                  <div className="relative">
                    <input
                      type={showFormatPassword ? 'text' : 'password'}
                      value={formatPassword}
                      onChange={(e) => setFormatPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoFocus
                      className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:border-[#5D5FEF] focus:outline-none text-sm font-medium transition-colors"
                      onKeyDown={(e) => { if (e.key === 'Enter' && formatPassword) handleFormat(); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormatPassword(!showFormatPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showFormatPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {formatError && (
                <div className="p-3 bg-red-50 border-2 border-red-200 rounded-xl">
                  <p className="text-sm text-red-700 font-medium">{formatError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setFormatModal({ isOpen: false, device: null });
                    setFormatError(null);
                    setFormatPassword('');
                    setFormatNeedsPassword(false);
                  }}
                  disabled={formatting}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-gray-700 bg-white border-2 border-gray-200 hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFormat}
                  disabled={formatting}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/25 flex items-center justify-center gap-2"
                >
                  {formatting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Formatting…
                    </>
                  ) : (
                    'Format'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemovableStorageView;
