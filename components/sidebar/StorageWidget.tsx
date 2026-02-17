import React, { useState, useEffect, useCallback } from 'react';
import { Settings2 } from 'lucide-react';

const CableIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 -960 960 960" fill="currentColor">
    <path d="M200-120q-17 0-28.5-11.5T160-160v-40h-40v-160q0-17 11.5-28.5T160-400h40v-280q0-66 47-113t113-47q66 0 113 47t47 113v400q0 33 23.5 56.5T600-200q33 0 56.5-23.5T680-280v-280h-40q-17 0-28.5-11.5T600-600v-160h40v-40q0-17 11.5-28.5T680-840h80q17 0 28.5 11.5T800-800v40h40v160q0 17-11.5 28.5T800-560h-40v280q0 66-47 113t-113 47q-66 0-113-47t-47-113v-400q0-33-23.5-56.5T360-760q-33 0-56.5 23.5T280-680v280h40q17 0 28.5 11.5T360-360v160h-40v40q0 17-11.5 28.5T280-120h-80Z"/>
  </svg>
);
import type { SystemStorageResponse } from '@/types';

interface StorageWidgetProps {
  activeTab: string;
  onManageServer: () => void;
  onUsbClick?: () => void;
}

const STORAGE_API = '/api/system/storage';
const USB_EVENTS_API = '/api/system/usb-events';
const REFRESH_INTERVAL_MS = 30_000; // Fallback polling (SSE handles real-time)

function useSystemStorage() {
  const [data, setData] = useState<SystemStorageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
    const id = setInterval(fetchStorage, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStorage]);

  // SSE: instant updates when USB devices change
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnect: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource(USB_EVENTS_API);
      es.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'change') {
            // Immediately refetch full storage data for accurate info
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

  // Refetch when user comes back to the tab
  useEffect(() => {
    const onFocus = () => fetchStorage();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchStorage]);

  return { data, loading, error, refetch: fetchStorage };
}

const StorageWidget: React.FC<StorageWidgetProps> = ({ activeTab, onManageServer, onUsbClick }) => {
  const { data, loading, error } = useSystemStorage();

  const removable = data?.removable ?? [];
  const hasRemovable = removable.length > 0;
  const firstRemovable = removable[0];
  const root = data?.rootStorage;

  const usbSummary = hasRemovable
    ? removable.length > 1
      ? `${removable.length} drives`
      : (firstRemovable?.model || firstRemovable?.sizeHuman || 'Connected')
    : null;

  return (
    <div className="px-4 mt-auto space-y-3 pb-6">
      {/* USB / Removable – clickable card */}
      <button
        type="button"
        onClick={onUsbClick}
        className={`w-full rounded-xl md:rounded-2xl p-3.5 md:p-4 shadow-lg transition-all relative overflow-hidden group/disk text-left ${
          activeTab === 'server' || activeTab === 'usb'
            ? 'bg-white border border-gray-100'
            : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <CableIcon
                className={`w-6 h-6 ${activeTab === 'server' || activeTab === 'usb' ? 'text-gray-700' : 'text-gray-600'}`}
              />
              <div
                className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 ${
                  loading
                    ? 'bg-amber-400 border-white animate-pulse'
                    : hasRemovable
                      ? 'bg-green-500 border-white'
                      : 'bg-gray-300 border-white'
                }`}
              />
            </div>
            <div className="min-w-0">
              <p
                className={`text-[10px] md:text-[11px] font-black uppercase tracking-wider ${
                  activeTab === 'server' || activeTab === 'usb' ? 'text-gray-700' : 'text-gray-600'
                }`}
              >
                USB
              </p>
              <p
                className={`text-[8px] md:text-[9px] font-bold ${
                  loading ? 'text-gray-400' : error ? 'text-amber-600' : hasRemovable ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {loading
                  ? 'Checking…'
                  : error
                    ? 'Unavailable'
                    : hasRemovable
                      ? usbSummary
                      : 'Nothing connected'}
              </p>
            </div>
          </div>
          {hasRemovable && firstRemovable && !loading && (
            <div className="text-right">
              <p
                className={`text-[9px] md:text-[10px] font-black ${
                  activeTab === 'server' || activeTab === 'usb' ? 'text-gray-700' : 'text-gray-600'
                }`}
              >
                {removable.length > 1 ? `${removable.length} devices` : firstRemovable.sizeHuman}
              </p>
              <p
                className={`text-[7px] md:text-[8px] font-bold ${
                  activeTab === 'server' || activeTab === 'usb' ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {removable.length > 1 ? 'View all' : 'Available'}
              </p>
            </div>
          )}
        </div>
      </button>

      {/* Storage (root filesystem) */}
      <div
        className={`rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-xl transition-all relative overflow-hidden group/storage ${
          activeTab === 'server' ? 'bg-white border border-[#5D5FEF] ring-1 ring-[#5D5FEF]' : 'bg-[#5D5FEF] text-white shadow-[#5D5FEF]/20'
        }`}
      >
        <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                activeTab === 'server' ? 'text-[#5D5FEF]' : 'text-white/70'
              }`}
            >
              Storage
            </span>
            {loading && (
              <span className={`text-[10px] font-bold opacity-70 ${activeTab === 'server' ? 'text-[#5D5FEF]' : ''}`}>
                —
              </span>
            )}
            {error && (
              <span className={`text-[10px] font-bold ${activeTab === 'server' ? 'text-amber-600' : 'text-amber-200'}`}>
                —
              </span>
            )}
            {!loading && !error && root && (
              <span className={`text-[10px] font-bold ${activeTab === 'server' ? 'text-[#5D5FEF]' : ''}`}>
                {root.usedPercent}%
              </span>
            )}
          </div>
          <div
            className={`h-1.5 w-full rounded-full mb-3 overflow-hidden ${
              activeTab === 'server' ? 'bg-[#5D5FEF]/10' : 'bg-white/20'
            }`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                activeTab === 'server' ? 'bg-[#5D5FEF]' : 'bg-white'
              }`}
              style={{
                width:
                  loading || error ? '0%' : root ? `${Math.min(100, root.usedPercent)}%` : '0%',
              }}
            />
          </div>
          <p
            className={`text-[10px] font-medium mb-4 text-center ${
              activeTab === 'server' ? 'text-[#5D5FEF]/60' : 'text-white/60'
            }`}
          >
            {loading && 'Loading…'}
            {error && 'Unavailable'}
            {!loading && !error && root && (
              <>
                {root.usedHuman} used / {root.totalHuman} total
              </>
            )}
            {!loading && !error && !root && '—'}
          </p>
          <button
            onClick={onManageServer}
            className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-xs shadow-sm hover:shadow-md transition-all active:scale-95 ${
              activeTab === 'server' ? 'bg-[#5D5FEF] text-white' : 'bg-white text-[#5D5FEF]'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Manage Server</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StorageWidget;
