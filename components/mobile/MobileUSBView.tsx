import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  HardDrive,
  Loader2,
  MoreVertical,
  Eye,
  EyeOff,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';

/* ───── types ───── */
interface RemovableDeviceInfo {
  name: string;
  model: string;
  mountpoint: string | null;
  sizeHuman: string;
  fsSizeHuman?: string;
  fsUsedHuman?: string;
  fsAvailHuman?: string;
  fsUsedPercent?: number;
  deviceType: string;
  label?: string;
}

interface SystemStorageResponse {
  rootStorage: {
    usedHuman: string;
    totalHuman: string;
    availableHuman: string;
    usedPercent: number;
  };
  removable: RemovableDeviceInfo[];
}

/* ══════════════════════════════════════════════════════════════════ */
/*  Mobile USB / Removable Storage View                             */
/* ══════════════════════════════════════════════════════════════════ */
const MobileUSBView: React.FC<{
  onMountedDeviceOpen?: (device: any) => void;
}> = ({ onMountedDeviceOpen }) => {
  const [data, setData] = useState<SystemStorageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [labels, setLabels] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('removableLabels') || '{}'); } catch { return {}; }
  });

  const [mountingDevice, setMountingDevice] = useState<string | null>(null);
  const [unmountingDevice, setUnmountingDevice] = useState<string | null>(null);
  const [mountError, setMountError] = useState<string | null>(null);

  /* password modal */
  const [passwordModal, setPasswordModal] = useState<{ isOpen: boolean; device: string; action: 'mount' | 'unmount' } | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  /* device menu */
  const [menuDevice, setMenuDevice] = useState<string | null>(null);

  /* format */
  const [formatModal, setFormatModal] = useState<{ isOpen: boolean; device: RemovableDeviceInfo | null }>({ isOpen: false, device: null });
  const [formatFs, setFormatFs] = useState('exfat');
  const [formatLabel, setFormatLabel] = useState('');
  const [formatting, setFormatting] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [formatPassword, setFormatPassword] = useState('');
  const [formatNeedsPassword, setFormatNeedsPassword] = useState(false);
  const [showFormatPassword, setShowFormatPassword] = useState(false);

  const fetchStorage = useCallback(async () => {
    try {
      const r = await fetch('/api/system/storage');
      if (!r.ok) throw new Error('Failed to load');
      const d = await r.json();
      setData(d);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStorage(); }, [fetchStorage]);

  /* SSE for USB events */
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;
    const connect = () => {
      es = new EventSource('/api/system/usb-events');
      es.onmessage = (ev) => {
        try { const d = JSON.parse(ev.data); if (d.type === 'change') fetchStorage(); } catch {}
      };
      es.onerror = () => { es?.close(); retryTimeout = setTimeout(connect, 10000); };
    };
    connect();
    return () => { es?.close(); clearTimeout(retryTimeout); };
  }, [fetchStorage]);

  /* mount */
  const handleMount = async (deviceName: string, pwd?: string) => {
    setMountingDevice(deviceName); setMountError(null);
    try {
      const r = await fetch('/api/system/mount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: deviceName, password: pwd || '' }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.requiresAuth) {
          if (!pwd) { setPasswordModal({ isOpen: true, device: deviceName, action: 'mount' }); setPassword(''); setMountingDevice(null); return; }
          setPasswordModal(null); setPassword(''); setMountError('Invalid password'); setMountingDevice(null); return;
        }
        throw new Error(d.error || 'Mount failed');
      }
      setPasswordModal(null); setPassword('');
      fetchStorage();
    } catch (e: any) { setPasswordModal(null); setPassword(''); setMountError(e.message); }
    setMountingDevice(null);
  };

  /* unmount */
  const handleUnmount = async (deviceName: string, pwd?: string) => {
    setUnmountingDevice(deviceName); setMountError(null);
    try {
      const r = await fetch('/api/system/unmount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: deviceName, password: pwd || '' }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.requiresAuth) {
          if (!pwd) { setPasswordModal({ isOpen: true, device: deviceName, action: 'unmount' }); setPassword(''); setUnmountingDevice(null); return; }
          setPasswordModal(null); setPassword(''); setMountError('Invalid password'); setUnmountingDevice(null); return;
        }
        throw new Error(d.error || 'Unmount failed');
      }
      setPasswordModal(null); setPassword('');
      fetchStorage();
    } catch (e: any) { setPasswordModal(null); setPassword(''); setMountError(e.message); }
    setUnmountingDevice(null);
  };

  /* label */
  const handleEditLabel = (deviceName: string) => {
    const current = labels[deviceName] || '';
    const newLabel = prompt('Enter label for device:', current);
    if (newLabel !== null) {
      const updated = { ...labels, [deviceName]: newLabel };
      setLabels(updated);
      localStorage.setItem('removableLabels', JSON.stringify(updated));
    }
    setMenuDevice(null);
  };

  /* format */
  const handleFormat = async () => {
    if (!formatModal.device) return;
    setFormatting(true);
    setFormatError(null);
    try {
      const res = await fetch('/api/system/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: formatModal.device.name,
          filesystem: formatFs,
          label: formatLabel,
          ...(formatPassword ? { password: formatPassword } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; requiresAuth?: boolean };
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

  const CableIcon = () => (
    <svg className="w-6 h-6" viewBox="0 -960 960 960" fill="currentColor">
      <path d="M200-120q-17 0-28.5-11.5T160-160v-40h-40v-160q0-17 11.5-28.5T160-400h40v-280q0-66 47-113t113-47q66 0 113 47t47 113v400q0 33 23.5 56.5T600-200q33 0 56.5-23.5T680-280v-280h-40q-17 0-28.5-11.5T600-600v-160h40v-40q0-17 11.5-28.5T680-840h80q17 0 28.5 11.5T800-800v40h40v160q0 17-11.5 28.5T800-560h-40v280q0 66-47 113t-113 47q-66 0-113-47t-47-113v-400q0-33-23.5-56.5T360-760q-33 0-56.5 23.5T280-680v280h40q17 0 28.5 11.5T360-360v160h-40v40q0 17-11.5 28.5T280-120h-80Z"/>
    </svg>
  );

  const SdCardIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
    <svg className={className} viewBox="0 -960 960 960" fill="currentColor">
      <path d="M360-520h80v-160h-80v160Zm120 0h80v-160h-80v160Zm120 0h80v-160h-80v160ZM240-80q-33 0-56.5-23.5T160-160v-480l240-240h320q33 0 56.5 23.5T800-800v640q0 33-23.5 56.5T720-80H240Zm0-80h480v-640H434L240-606v446Zm0 0h480-480Z"/>
    </svg>
  );

  const devices = data?.removable || [];

  return (
    <div className="animate-in fade-in duration-200">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-[3px] h-8 bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full flex-shrink-0" />
          <div>
            <h1 className="font-heading text-2xl sm:text-[28px] font-bold text-gray-900 tracking-tight leading-none">External Storage</h1>
            <p className="text-xs font-medium text-gray-500 mt-0.5">USB drives and connected devices</p>
          </div>
        </div>
      </div>

      {/* Main Storage Card */}
      {data?.rootStorage && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-900">System Storage</p>
              <p className="text-[12px] font-medium text-gray-400">{data.rootStorage.usedHuman} of {data.rootStorage.totalHuman}</p>
            </div>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${data.rootStorage.usedPercent}%`,
                backgroundColor: data.rootStorage.usedPercent > 90 ? '#EF4444' : data.rootStorage.usedPercent > 70 ? '#F59E0B' : '#5D5FEF',
              }}
            />
          </div>
          <p className="text-[11px] font-medium text-gray-400 mt-1.5">{data.rootStorage.availableHuman} available</p>
        </div>
      )}

      {/* Device List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-10 h-10 text-red-300 mx-auto mb-3" />
          <p className="text-[14px] font-bold text-red-400">{error}</p>
          <button onClick={fetchStorage} className="mt-3 text-[13px] font-semibold text-[#5D5FEF] active:opacity-70 touch-manipulation">Retry</button>
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-300">
            <CableIcon />
          </div>
          <p className="text-[18px] font-extrabold text-gray-300">No Devices</p>
          <p className="text-[14px] font-medium text-gray-400 mt-1">Connect a USB drive or SD card to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((dev) => {
            const isMounted = !!dev.mountpoint;
            const label = labels[dev.name] || dev.label || dev.model || dev.name;
            const isPortable = dev.deviceType === 'portable' || dev.deviceType === 'emmc';
            const isMounting = mountingDevice === dev.name;
            const isUnmounting = unmountingDevice === dev.name;

            return (
              <div key={dev.name} className="bg-white rounded-2xl border border-gray-200/60 p-4 shadow-sm">
                {/* Device Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isMounted ? 'bg-[#5D5FEF]/10' : 'bg-gray-100'}`}>
                    {dev.deviceType === 'sd_card' ? (
                      <SdCardIcon className={`w-5 h-5 ${isMounted ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                    ) : isPortable ? (
                      <HardDrive className={`w-5 h-5 ${isMounted ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                    ) : (
                      <span className={isMounted ? 'text-[#5D5FEF]' : 'text-gray-400'}><CableIcon /></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-bold text-gray-900 truncate">{label}</p>
                      {isMounted && (
                        <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] font-medium text-gray-400">{dev.sizeHuman} · {dev.name}</p>
                  </div>
                  {/* Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setMenuDevice(menuDevice === dev.name ? null : dev.name)}
                      className="p-2 rounded-xl text-gray-400 active:bg-gray-100 touch-manipulation"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuDevice === dev.name && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuDevice(null)} />
                        <div className="absolute right-0 top-10 bg-white rounded-2xl shadow-xl border border-gray-200/60 py-2 z-50 min-w-[160px]">
                          <button
                            onClick={() => handleEditLabel(dev.name)}
                            className="w-full px-4 py-2.5 text-left text-[13px] font-semibold text-gray-700 active:bg-gray-50 touch-manipulation"
                          >
                            Edit Label
                          </button>
                          {isMounted && (
                            <button
                              onClick={() => { setMenuDevice(null); handleUnmount(dev.name); }}
                              className="w-full px-4 py-2.5 text-left text-[13px] font-semibold text-red-500 active:bg-red-50 touch-manipulation"
                            >
                              Unmount
                            </button>
                          )}
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            onClick={() => {
                              setMenuDevice(null);
                              setFormatFs('exfat');
                              setFormatLabel('');
                              setFormatError(null);
                              setFormatModal({ isOpen: true, device: dev });
                            }}
                            className="w-full px-4 py-2.5 text-left text-[13px] font-semibold text-red-500 active:bg-red-50 touch-manipulation"
                          >
                            Format
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Usage bar (mounted only) */}
                {isMounted && dev.fsUsedPercent !== undefined && (
                  <div className="mb-3">
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${dev.fsUsedPercent}%`,
                          backgroundColor: dev.fsUsedPercent > 90 ? '#EF4444' : dev.fsUsedPercent > 70 ? '#F59E0B' : '#5D5FEF',
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[11px] font-medium text-gray-400">{dev.fsUsedHuman} used</span>
                      <span className="text-[11px] font-medium text-gray-400">{dev.fsAvailHuman} free</span>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                {isMounted ? (
                  <button
                    onClick={() => onMountedDeviceOpen?.(dev)}
                    className="w-full py-3 bg-[#5D5FEF] text-white rounded-2xl text-[14px] font-bold shadow-md shadow-[#5D5FEF]/25 active:scale-[0.98] touch-manipulation"
                  >
                    View Files
                  </button>
                ) : (
                  <button
                    onClick={() => handleMount(dev.name)}
                    disabled={isMounting}
                    className="w-full py-3 bg-white border-2 border-[#5D5FEF] text-[#5D5FEF] rounded-2xl text-[14px] font-bold active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                  >
                    {isMounting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Mount'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Password Modal */}
      {passwordModal?.isOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => { setPasswordModal(null); setMountError(null); }}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[18px] font-extrabold text-gray-900">
                {passwordModal.action === 'mount' ? 'Mount Device' : 'Unmount Device'}
              </h3>
              <button onClick={() => { setPasswordModal(null); setMountError(null); }} className="p-2 rounded-xl bg-gray-100 text-gray-500 active:scale-95 touch-manipulation">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[13px] font-medium text-gray-500 mb-4">
              Enter your system password to {passwordModal.action} this device.
            </p>
            {mountError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl mb-3">
                <p className="text-[12px] font-semibold text-red-600">{mountError}</p>
              </div>
            )}
            <div className="relative mb-5">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="System password"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && password) {
                    if (passwordModal.action === 'mount') handleMount(passwordModal.device, password);
                    else handleUnmount(passwordModal.device, password);
                  }
                }}
                className="w-full px-4 py-3.5 rounded-2xl bg-gray-100 text-[15px] font-medium text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#5D5FEF]/30 pr-12"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 touch-manipulation"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={() => {
                if (passwordModal.action === 'mount') handleMount(passwordModal.device, password);
                else handleUnmount(passwordModal.device, password);
              }}
              disabled={!password}
              className="w-full py-3.5 bg-[#5D5FEF] text-white rounded-2xl text-[15px] font-bold shadow-lg shadow-[#5D5FEF]/25 disabled:opacity-50 active:scale-[0.98] touch-manipulation"
            >
              {passwordModal.action === 'mount' ? 'Mount' : 'Unmount'}
            </button>
          </div>
        </div>
      )}
      {/* Format Modal */}
      {formatModal.isOpen && formatModal.device && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => { if (!formatting) { setFormatModal({ isOpen: false, device: null }); setFormatError(null); setFormatPassword(''); setFormatNeedsPassword(false); } }}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-extrabold text-gray-900">Format Device</h3>
              <button
                onClick={() => { if (!formatting) { setFormatModal({ isOpen: false, device: null }); setFormatError(null); setFormatPassword(''); setFormatNeedsPassword(false); } }}
                className="p-2 rounded-xl bg-gray-100 text-gray-500 active:scale-95 touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[13px] font-medium text-gray-500 mb-1">
              Format <span className="font-bold text-gray-700">{formatModal.device.model || formatModal.device.name}</span> ({formatModal.device.sizeHuman})
            </p>
            <p className="text-[12px] font-bold text-red-500 mb-5">
              ⚠ This will permanently erase all data on the device.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">File System</label>
                <select
                  value={formatFs}
                  onChange={(e) => setFormatFs(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-gray-100 text-[15px] font-medium text-gray-900 outline-none focus:ring-2 focus:ring-[#5D5FEF]/30 appearance-none"
                >
                  <option value="exfat">exFAT (recommended)</option>
                  <option value="vfat">FAT32 (max 4GB files)</option>
                  <option value="ext4">ext4 (Linux only)</option>
                  <option value="ntfs">NTFS (Windows)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">Volume Label (optional)</label>
                <input
                  type="text"
                  value={formatLabel}
                  onChange={(e) => setFormatLabel(e.target.value)}
                  placeholder="e.g. MY_DRIVE"
                  className="w-full px-4 py-3.5 rounded-2xl bg-gray-100 text-[15px] font-medium text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#5D5FEF]/30"
                />
              </div>

              {formatNeedsPassword && (
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">Sudo Password</label>
                  <div className="relative">
                    <input
                      type={showFormatPassword ? 'text' : 'password'}
                      value={formatPassword}
                      onChange={(e) => setFormatPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoFocus
                      className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-gray-100 text-[15px] font-medium text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#5D5FEF]/30"
                      onKeyDown={(e) => { if (e.key === 'Enter' && formatPassword) handleFormat(); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormatPassword(!showFormatPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400"
                    >
                      {showFormatPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {formatError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-[12px] font-semibold text-red-600">{formatError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setFormatModal({ isOpen: false, device: null }); setFormatError(null); setFormatPassword(''); setFormatNeedsPassword(false); }}
                  disabled={formatting}
                  className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-2xl text-[15px] font-bold disabled:opacity-50 active:scale-[0.98] touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFormat}
                  disabled={formatting}
                  className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl text-[15px] font-bold shadow-lg shadow-red-500/25 disabled:opacity-50 active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2"
                >
                  {formatting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
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

export default MobileUSBView;
