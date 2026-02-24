
import React, { useState, useEffect, useCallback } from 'react';
import {
  CloudSync,
  RefreshCw,
  Power,
  ChevronRight,
  Database,
  Cpu,
  ShieldCheck,
  Signal,
  ArrowRight,
  Sliders,
  HardDrive,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import type { SystemStats, LogEntry } from '@/types';
import { getSessionToken } from '@/services/api.client';

const STATS_API = '/api/system/stats';
const REFRESH_INTERVAL_MS = 5_000; // Update every 5 seconds

function useSystemStats() {
  const [data, setData] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setError(false);
      const res = await fetch(STATS_API);
      if (!res.ok) throw new Error('Stats API error');
      const json: SystemStats = await res.json();
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStats]);

  // Refetch when user comes back to the tab
  useEffect(() => {
    const onFocus = () => fetchStats();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchStats]);

  return { data, loading, error, refetch: fetchStats };
}

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
  title: string;
  message: string;
  actionName: string;
}

const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  actionName
}) => {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (password) {
      onSubmit(password);
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-xl font-black text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              System Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password) {
                  handleSubmit();
                } else if (e.key === 'Escape') {
                  onClose();
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
                onClose();
                setPassword('');
              }}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-gray-700 bg-white border-2 border-gray-200 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!password}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-white bg-[#5D5FEF] hover:bg-[#4D4FCF] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#5D5FEF]/25"
            >
              {actionName}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  isDangerous?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  isDangerous = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-200">
        <div className="flex items-start gap-4 mb-6">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isDangerous ? 'bg-red-50' : 'bg-amber-50'
          }`}>
            <AlertTriangle className={`w-6 h-6 ${isDangerous ? 'text-red-500' : 'text-amber-500'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-black text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm text-white transition-colors ${
              isDangerous
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-[#5D5FEF] hover:bg-[#4D4FDF]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ServerViewProps {
  onNavigateToLogs?: () => void;
}

const ServerView: React.FC<ServerViewProps> = ({ onNavigateToLogs }) => {
  const { data, loading, error } = useSystemStats();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    action: () => void;
    isDangerous?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    action: () => {},
    isDangerous: false
  });
  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionName: string;
    endpoint: string;
    actionKey: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionName: '',
    endpoint: '',
    actionKey: ''
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ label: string; seconds: number } | null>(null);

  // Tick the countdown down every second
  useEffect(() => {
    if (!countdown || countdown.seconds <= 0) return;
    const id = setTimeout(() => {
      setCountdown(prev => prev ? { ...prev, seconds: prev.seconds - 1 } : null);
    }, 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const handleServerAction = async (action: string, endpoint: string, password: string) => {
    setActionLoading(action);
    setActionError(null);
    try {
      const token = getSessionToken();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password })
      });
      const result = await res.json();

      if (res.ok) {
        if (action === 'restart') {
          setCountdown({ label: 'Server restarting', seconds: 45 });
        } else if (action === 'shutdown') {
          setCountdown({ label: 'Server shutting down', seconds: 10 });
        } else {
          setTimeout(() => setActionLoading(null), 2000);
        }
        setActionLoading(null);
      } else {
        setActionError(result.error || 'Operation failed');
        setActionLoading(null);
      }
    } catch (err) {
      setActionError((err as Error).message || 'Operation failed');
      setActionLoading(null);
    }
  };

  const showPasswordModal = (title: string, message: string, actionName: string, endpoint: string, actionKey: string) => {
    setPasswordModal({
      isOpen: true,
      title,
      message,
      actionName,
      endpoint,
      actionKey
    });
  };

  const handlePasswordSubmit = (password: string) => {
    setPasswordModal({ ...passwordModal, isOpen: false });
    handleServerAction(passwordModal.actionKey, passwordModal.endpoint, password);
  };

  const logs = data?.logs || [];

  const getLogStyle = (status: string) => {
    switch (status) {
      case 'success':
        return {
          badge: 'bg-green-50 text-green-700 border-green-200',
          icon: '✓',
          text: 'text-gray-800'
        };
      case 'error':
        return {
          badge: 'bg-red-50 text-red-700 border-red-200',
          icon: '✕',
          text: 'text-gray-800'
        };
      case 'warning':
        return {
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: '⚠',
          text: 'text-gray-800'
        };
      default:
        return {
          badge: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: '•',
          text: 'text-gray-700'
        };
    }
  };

  // Extract service name from log event
  const parseLogEvent = (event: string) => {
    const match = event.match(/^\[([^\]]+)\]\s*(.+)/);
    if (match) {
      return {
        service: match[1],
        message: match[2]
      };
    }
    return { service: 'system', message: event };
  };

  // Colorize message parts (IP, MAC, server names)
  const colorizeMessage = (message: string) => {
    // Pattern for IP addresses
    const ipPattern = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;
    // Pattern for MAC addresses
    const macPattern = /([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/gi;
    // Pattern for server names
    const serverPattern = /(arcelliteserver|arcellieserver)/gi;

    let result: (string | React.ReactNode)[] = [message];

    // Replace server names
    result = result.flatMap((part) => {
      if (typeof part !== 'string') return part;
      return part.split(serverPattern).map((chunk, idx) =>
        chunk.match(serverPattern)
          ? <span key={`server-${idx}`} className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-bold text-[10px] inline-block mx-0.5">{chunk}</span>
          : chunk
      );
    });

    // Replace MAC addresses
    result = result.flatMap((part) => {
      if (typeof part !== 'string') return part;
      return part.split(macPattern).map((chunk, idx) =>
        chunk.match(macPattern)
          ? <span key={`mac-${idx}`} className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 font-bold text-[10px] inline-block mx-0.5 font-mono">{chunk}</span>
          : chunk
      );
    });

    // Replace IP addresses
    result = result.flatMap((part) => {
      if (typeof part !== 'string') return part;
      return part.split(ipPattern).map((chunk, idx) =>
        chunk.match(ipPattern)
          ? <span key={`ip-${idx}`} className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-bold text-[10px] inline-block mx-0.5 font-mono">{chunk}</span>
          : chunk
      );
    });

    return result;
  };

  return (
    <div className="w-full">
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.action}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDangerous={confirmDialog.isDangerous}
      />

      <PasswordModal
        isOpen={passwordModal.isOpen}
        onClose={() => setPasswordModal({ ...passwordModal, isOpen: false })}
        onSubmit={handlePasswordSubmit}
        title={passwordModal.title}
        message={passwordModal.message}
        actionName={passwordModal.actionName}
      />

      {/* Action error banner */}
      {actionError && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Status Badges */}
      <div className="flex flex-wrap items-center gap-3 mb-5 pb-5 border-b border-gray-100">
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border flex items-center gap-2 shadow-sm ${
          loading ? 'bg-amber-50 text-amber-600 border-amber-100' :
          error ? 'bg-red-50 text-red-600 border-red-100' :
          'bg-green-50 text-green-600 border-green-100'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            loading ? 'bg-amber-500 animate-pulse' :
            error ? 'bg-red-500' :
            'bg-green-500 animate-pulse'
          }`} />
          {loading ? 'Loading' : error ? 'Error' : 'Operational'}
        </span>
        <span className="text-gray-400 font-bold text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          Uptime: {loading ? '—' : error ? 'N/A' : data?.uptime.formatted || '0m'}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-8 md:mb-12">
        {/* CPU Load */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              loading ? 'bg-gray-100 text-gray-400' :
              error ? 'bg-red-100 text-red-600' :
              (data?.cpu.loadPercent || 0) < 50 ? 'bg-emerald-100 text-emerald-700' :
              (data?.cpu.loadPercent || 0) < 80 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {loading ? '...' : error ? 'Error' : (data?.cpu.loadPercent || 0) < 50 ? 'Optimal' : (data?.cpu.loadPercent || 0) < 80 ? 'Normal' : 'High'}
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">
            {loading ? '—' : error ? 'N/A' : `${data?.cpu.loadPercent || 0}`}<span className="text-lg text-gray-300 font-bold">%</span>
          </p>
          <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">CPU Load</p>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  (data?.cpu.loadPercent || 0) < 50 ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
                  (data?.cpu.loadPercent || 0) < 80 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                  'bg-gradient-to-r from-red-400 to-red-500'
                }`}
                style={{ width: `${loading || error ? 0 : Math.max(4, data?.cpu.loadPercent || 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-500">{loading ? '—' : error ? '—' : `${data?.cpu.cores || 0} cores`}</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 truncate max-w-[55%] text-right">{loading ? '' : error ? '' : data?.cpu.model?.split(' ').slice(0, 3).join(' ') || ''}</span>
            </div>
          </div>
        </div>

        {/* RAM Usage */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <HardDrive className="w-5 h-5 text-white" />
            </div>
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              loading ? 'bg-gray-100 text-gray-400' :
              error ? 'bg-red-100 text-red-600' :
              (data?.memory.usedPercent || 0) < 70 ? 'bg-emerald-100 text-emerald-700' :
              (data?.memory.usedPercent || 0) < 90 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {loading ? '...' : error ? 'Error' : (data?.memory.usedPercent || 0) < 70 ? 'Healthy' : (data?.memory.usedPercent || 0) < 90 ? 'Normal' : 'High'}
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">
            {loading ? '—' : error ? 'N/A' : data?.memory.usedHuman || '0B'}
          </p>
          <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">RAM Usage</p>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  (data?.memory.usedPercent || 0) < 70 ? 'bg-gradient-to-r from-violet-400 to-purple-500' :
                  (data?.memory.usedPercent || 0) < 90 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                  'bg-gradient-to-r from-red-400 to-red-500'
                }`}
                style={{ width: `${loading || error ? 0 : Math.max(4, data?.memory.usedPercent || 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-500">{loading ? '—' : error ? '—' : `${data?.memory.usedPercent || 0}% used`}</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400">{loading ? '' : error ? '' : `of ${data?.memory.totalHuman || '0B'}`}</span>
            </div>
          </div>
        </div>

        {/* Network */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Signal className="w-5 h-5 text-white" />
            </div>
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              loading ? 'bg-gray-100 text-gray-400' :
              error ? 'bg-red-100 text-red-600' :
              data?.network.status === 'low' ? 'bg-emerald-100 text-emerald-700' :
              data?.network.status === 'medium' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {loading ? '...' : error ? 'Error' : data?.network.status === 'low' ? 'Low' : data?.network.status === 'medium' ? 'Medium' : 'High'}
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">
            {loading ? '—' : error ? 'N/A' : data?.network.bytesPerSecHuman || '0b/s'}
          </p>
          <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Network</p>
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-500">Throughput</span>
              <span className={`text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-md ${
                loading || error ? 'bg-gray-50 text-gray-400' :
                data?.network.status === 'low' ? 'bg-emerald-50 text-emerald-600' :
                data?.network.status === 'medium' ? 'bg-amber-50 text-amber-600' :
                'bg-red-50 text-red-600'
              }`}>{loading ? '—' : error ? '—' : data?.network.status || 'unknown'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-500">Platform</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 capitalize">{loading ? '—' : error ? '—' : data?.platform || '—'}</span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
              loading || error ? 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-400/25' :
              data?.security.firewallEnabled ? 'bg-gradient-to-br from-[#5D5FEF] to-indigo-700 shadow-[#5D5FEF]/25' :
              'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/25'
            }`}>
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              loading ? 'bg-gray-100 text-gray-400' :
              error ? 'bg-red-100 text-red-600' :
              data?.security.firewallEnabled ? 'bg-emerald-100 text-emerald-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {loading ? '...' : error ? 'Error' : data?.security.firewallEnabled ? 'Secure' : 'Warning'}
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">
            {loading ? '—' : error ? 'N/A' : data?.security.status === 'active' ? 'Active' : 'Off'}
          </p>
          <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Security</p>
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-500">Firewall</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${
                  loading || error ? 'bg-gray-300' :
                  data?.security.firewallEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                }`} />
                <span className={`text-[10px] sm:text-[11px] font-semibold ${
                  loading || error ? 'text-gray-400' :
                  data?.security.firewallEnabled ? 'text-emerald-600' : 'text-red-500'
                }`}>{loading ? '—' : error ? '—' : data?.security.firewallEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-500">Status</span>
              <span className={`text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-md ${
                loading || error ? 'bg-gray-50 text-gray-400' :
                data?.security.status === 'active' ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]' : 'bg-amber-50 text-amber-600'
              }`}>{loading ? '—' : error ? '—' : data?.security.status || 'unknown'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Server Control */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-[13px] font-black text-gray-900 uppercase tracking-wider">Server Control</p>
          </div>
          <p className="text-[11px] text-gray-400 font-medium">{loading ? '—' : data?.hostname}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-gray-100">
          {/* Restart */}
          <button
            onClick={() => showPasswordModal(
              'Restart Server',
              'Enter your system password to restart the server. This will cause approximately 45 seconds of downtime.',
              'Restart Now',
              '/api/system/restart',
              'restart'
            )}
            disabled={actionLoading === 'restart'}
            className="flex flex-col items-center gap-2.5 p-5 hover:bg-gray-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
              <RefreshCw className={`w-4 h-4 text-gray-600 ${actionLoading === 'restart' ? 'animate-spin' : ''}`} />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-black text-gray-800">{actionLoading === 'restart' ? 'Restarting…' : 'Restart'}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">~45s downtime</p>
            </div>
          </button>

          {/* Clear Cache */}
          <button
            onClick={() => showPasswordModal(
              'Clear System Cache',
              'Enter your system password to clear the system cache and free up memory.',
              'Clear Cache',
              '/api/system/clear-cache',
              'cache'
            )}
            disabled={actionLoading === 'cache'}
            className="flex flex-col items-center gap-2.5 p-5 hover:bg-gray-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
              <Trash2 className="w-4 h-4 text-gray-600" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-black text-gray-800">{actionLoading === 'cache' ? 'Clearing…' : 'Clear Cache'}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Free memory</p>
            </div>
          </button>

          {/* Sync */}
          <button
            onClick={() => showPasswordModal(
              'Force Synchronization',
              'Enter your system password to force data synchronization across all services.',
              'Sync Now',
              '/api/system/sync',
              'sync'
            )}
            className="flex flex-col items-center gap-2.5 p-5 hover:bg-gray-50 transition-all group active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
              <CloudSync className="w-4 h-4 text-gray-600" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-black text-gray-800">Sync</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Force sync</p>
            </div>
          </button>

          {/* Shutdown */}
          <button
            onClick={() => showPasswordModal(
              'Shutdown Server',
              'WARNING: This will completely shut down the server. You will need physical access to turn it back on.',
              'Shutdown',
              '/api/system/shutdown',
              'shutdown'
            )}
            disabled={actionLoading === 'shutdown'}
            className="flex flex-col items-center gap-2.5 p-5 hover:bg-red-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-red-100 flex items-center justify-center transition-colors">
              <Power className="w-4 h-4 text-gray-600 group-hover:text-red-500 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-black text-gray-800 group-hover:text-red-600 transition-colors">{actionLoading === 'shutdown' ? 'Shutting down…' : 'Shutdown'}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Permanent off</p>
            </div>
          </button>
        </div>
      </div>

      {/* Infrastructure Log */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <CloudSync className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-[13px] font-black text-gray-900 uppercase tracking-wider">Infrastructure Log</p>
          </div>
          <button onClick={onNavigateToLogs} className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 hover:text-gray-700 transition-colors group">
            <span>View all</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-300">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-[12px] text-red-400 font-medium">Unable to load logs</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-[12px] text-gray-400">No recent logs</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.slice(0, 6).map((log, i) => {
              const parsed = parseLogEvent(log.event);
              const style = getLogStyle(log.status);
              return (
                <div key={i} className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border flex-shrink-0 mt-0.5 ${style.badge}`}>
                    {parsed.service}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-medium ${style.text} leading-snug line-clamp-2`}>
                      {colorizeMessage(parsed.message)}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium flex-shrink-0 mt-0.5">{log.time}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Countdown toast for restart / shutdown */}
      {countdown && countdown.seconds > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-white/10">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 flex-shrink-0" />
          <span className="text-[13px] font-semibold">{countdown.label}</span>
          <span className="text-[13px] font-black tabular-nums text-indigo-300">{countdown.seconds}s</span>
        </div>
      )}
    </div>
  );
};

export default ServerView;
