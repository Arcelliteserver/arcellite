import React, { useState, useEffect, useCallback } from 'react';
import { Settings2, HardDrive, Usb } from 'lucide-react';
import type { SystemStorageResponse, FamilyMemberStorageInfo } from '@/types';

function formatFamilyBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface StorageWidgetProps {
  activeTab: string;
  onManageServer: () => void;
  onManageStorage?: () => void;
  onUsbClick?: () => void;
  isFamilyMember?: boolean;
  isSuspended?: boolean;
  collapsed?: boolean;
}

const STORAGE_API = '/api/system/storage';
const USB_EVENTS_API = '/api/system/usb-events';
const REFRESH_INTERVAL_MS = 30_000;

function useSystemStorage() {
  const [data, setData] = useState<SystemStorageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStorage = useCallback(async () => {
    try {
      setError(false);
      const token = localStorage.getItem('sessionToken');
      const res = await fetch(STORAGE_API, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
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

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnect: ReturnType<typeof setTimeout>;
    const connect = () => {
      es = new EventSource(USB_EVENTS_API);
      es.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'change') fetchStorage();
        } catch {}
      };
      es.onerror = () => {
        es?.close();
        reconnect = setTimeout(connect, 10000);
      };
    };
    connect();
    return () => { es?.close(); clearTimeout(reconnect); };
  }, [fetchStorage]);

  useEffect(() => {
    const onFocus = () => fetchStorage();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchStorage]);

  return { data, loading, error, refetch: fetchStorage };
}

const StorageWidget: React.FC<StorageWidgetProps> = ({
  activeTab,
  onManageServer,
  onManageStorage,
  onUsbClick,
  isFamilyMember,
  isSuspended,
  collapsed,
}) => {
  const { data, loading, error } = useSystemStorage();

  const removable = data?.removable ?? [];
  const hasRemovable = removable.length > 0;
  const firstRemovable = removable[0];
  const root = data?.rootStorage;
  const familyStorage: FamilyMemberStorageInfo | undefined = data?.familyMemberStorage;

  // ── Collapsed mode — just small icons ──
  if (collapsed) {
    const pct = root?.usedPercent ?? (familyStorage?.usedPercent ?? 0);
    return (
      <div className="px-2 pb-4 mt-auto flex flex-col items-center gap-2">
        {hasRemovable && (
          <button
            onClick={onUsbClick}
            title="USB Drive Connected"
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 transition-all relative"
          >
            <Usb className="w-4 h-4 text-green-400" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 border border-[#111214]" />
          </button>
        )}
        <button
          onClick={isFamilyMember ? onManageStorage : onManageServer}
          title={`Storage ${pct}% used`}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 transition-all relative"
        >
          <HardDrive className="w-4 h-4 text-gray-400" />
          {pct >= 80 && (
            <span className={`absolute top-1 right-1 w-2 h-2 rounded-full border border-[#111214] ${pct >= 90 ? 'bg-red-400' : 'bg-amber-400'}`} />
          )}
        </button>
      </div>
    );
  }

  // ── Family member suspended ──
  if (isFamilyMember && isSuspended) {
    return (
      <div className="px-3 mt-auto pb-4">
        <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Suspended</span>
          </div>
          <p className="text-[10px] text-gray-500 leading-relaxed mb-3">Contact admin to restore access.</p>
          <button
            onClick={onManageStorage}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl font-bold text-[11px] transition-all bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Request Access
          </button>
        </div>
      </div>
    );
  }

  // ── Family member view ──
  if (isFamilyMember) {
    const pct = familyStorage?.usedPercent ?? 0;
    const barColor = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-[#5D5FEF]';
    return (
      <div className="px-3 mt-auto pb-4">
        <div className="rounded-2xl p-4 bg-white/[0.05] border border-white/[0.08]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">My Storage</span>
            <span className="text-[10px] font-bold text-gray-400">{pct}%</span>
          </div>
          <div className="h-[5px] w-full rounded-full mb-3 overflow-hidden bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: loading || error || !familyStorage ? '0%' : `${Math.min(100, pct)}%` }}
            />
          </div>
          <p className="text-[10px] font-medium text-center text-gray-600 mb-3">
            {loading && 'Loading…'}
            {error && 'Unavailable'}
            {!loading && !error && familyStorage && (
              <>{familyStorage.usedHuman} / {familyStorage.quotaHuman}</>
            )}
            {!loading && !error && !familyStorage && '—'}
          </p>
          <button
            onClick={onManageStorage}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl font-semibold text-[11px] transition-all bg-white/[0.08] text-gray-300 hover:bg-white/[0.12] hover:text-white"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Manage Storage
          </button>
        </div>
      </div>
    );
  }

  // ── Owner view ──
  const pct = root?.usedPercent ?? 0;
  const barColor = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-[#5D5FEF]';

  return (
    <div className="px-3 mt-auto space-y-2 pb-4">
      {/* USB card */}
      {hasRemovable && (
        <button
          type="button"
          onClick={onUsbClick}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all text-left"
        >
          <div className="relative flex-shrink-0">
            <Usb className="w-4 h-4 text-gray-400" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-[#111214]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">USB</p>
            {firstRemovable && (
              <p className="text-[11px] font-semibold text-gray-400 truncate">
                {removable.length > 1 ? `${removable.length} drives` : firstRemovable.sizeHuman}
              </p>
            )}
          </div>
        </button>
      )}

      {/* Storage card */}
      <div className="rounded-2xl p-4 bg-white/[0.05] border border-white/[0.08]">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Storage</span>
          <span className="text-[10px] font-bold text-gray-400">
            {loading ? '—' : error ? '—' : root ? `${pct}%` : '—'}
          </span>
        </div>
        <div className="h-[5px] w-full rounded-full mb-2 overflow-hidden bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: loading || error || !root ? '0%' : `${Math.min(100, pct)}%` }}
          />
        </div>
        <p className="text-[10px] font-medium text-center text-gray-600 mb-3">
          {loading && 'Loading…'}
          {error && 'Unavailable'}
          {!loading && !error && root && <>{root.usedHuman} / {root.totalHuman}</>}
          {!loading && !error && !root && '—'}
        </p>
        <button
          onClick={onManageServer}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl font-semibold text-[11px] transition-all bg-white/[0.08] text-gray-300 hover:bg-white/[0.12] hover:text-white"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Manage Server
        </button>
      </div>
    </div>
  );
};

export default StorageWidget;
