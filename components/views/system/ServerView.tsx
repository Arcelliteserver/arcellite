
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

  const handleServerAction = async (action: string, endpoint: string, password: string) => {
    setActionLoading(action);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password })
      });
      const result = await res.json();

      if (res.ok) {
        // Show success message briefly
        setTimeout(() => setActionLoading(null), 2000);
      } else {
        alert(`Error: ${result.error || 'Operation failed'}`);
        setActionLoading(null);
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
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

  const metrics = [
    {
      label: 'CPU Load',
      value: loading ? '—' : error ? 'N/A' : `${data?.cpu.loadPercent || 0}%`,
      status: loading ? 'Loading' : error ? 'Error' : (data?.cpu.loadPercent || 0) < 50 ? 'Optimal' : (data?.cpu.loadPercent || 0) < 80 ? 'Normal' : 'High',
      icon: <Cpu className="w-8 h-8" />,
      color: 'text-blue-500',
    },
    {
      label: 'RAM Usage',
      value: loading ? '—' : error ? 'N/A' : data?.memory.usedHuman || '0B',
      status: loading ? 'Loading' : error ? 'Error' : (data?.memory.usedPercent || 0) < 70 ? 'Healthy' : (data?.memory.usedPercent || 0) < 90 ? 'Normal' : 'High',
      icon: <HardDrive className="w-8 h-8" />,
      color: 'text-purple-500',
    },
    {
      label: 'Network',
      value: loading ? '—' : error ? 'N/A' : data?.network.bytesPerSecHuman || '0b/s',
      status: loading ? 'Loading' : error ? 'Error' : data?.network.status === 'high' ? 'High' : data?.network.status === 'medium' ? 'Medium' : 'Low',
      icon: <Signal className="w-8 h-8" />,
      color: 'text-green-500',
    },
    {
      label: 'Security',
      value: loading ? '—' : error ? 'N/A' : data?.security.status === 'active' ? 'Active' : 'Inactive',
      status: loading ? 'Loading' : error ? 'Error' : data?.security.firewallEnabled ? 'Secure' : 'Warning',
      icon: <ShieldCheck className="w-8 h-8" />,
      color: 'text-[#5D5FEF]',
    },
  ];

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
    <div className="w-full animate-in fade-in duration-500">
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

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-10 gap-4">
        <div className="relative">
          <div className="absolute -left-2 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 capitalize pl-4 md:pl-6 relative">
            {loading ? 'Loading...' : data?.hostname || 'Server Node'}
            <span className="absolute -top-2 -right-8 md:-right-12 w-16 h-16 md:w-20 md:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h2>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap items-center gap-4 mb-10 pl-2">
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

      {/* Metrics Grid - NO HOVER EFFECTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
        {metrics.map((m, i) => (
          <div key={i} className="bg-white p-4 md:p-6 rounded-xl md:rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
             <div className={`${m.color} mb-4 md:mb-6`}>
                <div className="w-6 h-6 md:w-8 md:h-8">{m.icon}</div>
             </div>

             <p className="text-[9px] md:text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-2 md:mb-3">{m.label}</p>
             <div className="flex items-end justify-between gap-2">
                <h3 className="text-xl md:text-2xl lg:text-3xl font-black text-gray-900 truncate">{m.value}</h3>
                <span className={`text-[9px] md:text-[10px] font-black ${m.color} uppercase tracking-widest pb-1 flex-shrink-0`}>{m.status}</span>
             </div>
          </div>
        ))}
      </div>

      {/* Bottom Sections */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
        {/* Infrastructure Log */}
        <div className="bg-white rounded-xl md:rounded-[2rem] p-5 md:p-6 lg:p-8 border border-gray-100 shadow-sm">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4">
              <h3 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2 md:gap-3">
                 <CloudSync className="w-5 h-5 md:w-6 md:h-6 text-[#5D5FEF]" />
                 Infrastructure Log
              </h3>
              <button
                onClick={onNavigateToLogs}
                className="flex items-center gap-2 text-[10px] font-black text-[#5D5FEF] uppercase tracking-[0.2em] hover:opacity-70 transition-opacity group/btn whitespace-nowrap"
              >
                <span>View Full Log</span>
                <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
              </button>
           </div>
           {loading && (
             <div className="text-center py-8 text-gray-400 text-sm">Loading logs...</div>
           )}
           {error && (
             <div className="text-center py-8 text-red-400 text-sm">Unable to load logs</div>
           )}
           {!loading && !error && logs.length === 0 && (
             <div className="text-center py-8 text-gray-400 text-sm">No recent logs</div>
           )}
           {!loading && !error && logs.length > 0 && (
             <div className="space-y-3 md:space-y-4">
                {logs.slice(0, 4).map((log, i) => {
                  const parsed = parseLogEvent(log.event);
                  const style = getLogStyle(log.status);
                  return (
                    <div key={i} className="flex items-center gap-3 md:gap-4 p-4 md:p-6 rounded-xl md:rounded-2xl bg-gray-50/50 border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all group min-h-[72px] md:min-h-[88px]">
                       <span className={`px-2 py-1 rounded-lg text-[9px] md:text-[10px] font-black border flex-shrink-0 whitespace-nowrap ${style.badge}`}>
                         {style.icon}
                       </span>
                       <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <span className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest flex-shrink-0">
                              {parsed.service}
                            </span>
                            <span className="text-[8px] md:text-[9px] font-black text-gray-400 flex-shrink-0">{log.time}</span>
                          </div>
                          <p className={`text-sm md:text-[14px] font-bold ${style.text} leading-snug line-clamp-2`}>
                            {colorizeMessage(parsed.message)}
                          </p>
                       </div>
                    </div>
                  );
                })}
             </div>
           )}
        </div>

        {/* Server Control Panel */}
        <div className="bg-white rounded-xl md:rounded-[2rem] p-5 md:p-6 lg:p-8 border border-gray-100 shadow-sm relative overflow-hidden">
           <div className="absolute top-0 right-0 p-6 md:p-8 opacity-5 pointer-events-none">
              <Database className="w-20 md:w-24 h-20 md:h-24 text-gray-900" />
           </div>

           <div className="flex items-center gap-2 md:gap-3 mb-6 md:mb-8 min-w-0 relative z-10">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sliders className="text-amber-500 w-4 h-4 md:w-5 md:h-5" />
              </div>
              <h3 className="text-lg md:text-xl font-black text-gray-900 tracking-tight truncate">
                Server Control Panel
              </h3>
           </div>

           <div className="grid grid-cols-1 gap-3 md:gap-4 relative z-10">
              <button
                onClick={() => showPasswordModal(
                  'Restart Server',
                  'Enter your system password to restart the server. This will cause approximately 45 seconds of downtime.',
                  'Restart',
                  '/api/system/restart',
                  'restart'
                )}
                disabled={actionLoading === 'restart'}
                className="flex items-center justify-between p-4 md:p-6 bg-gray-50/50 rounded-xl md:rounded-2xl border border-transparent hover:border-[#5D5FEF]/30 hover:bg-[#5D5FEF]/5 transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed min-h-[72px] md:min-h-[88px]"
              >
                 <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 group-hover:text-[#5D5FEF] group-hover:bg-[#5D5FEF]/10 shadow-sm transition-all flex-shrink-0">
                       <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${actionLoading === 'restart' ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="text-left min-w-0 flex flex-col justify-center">
                       <span className="text-sm md:text-[14px] font-black text-gray-900 group-hover:text-[#5D5FEF] block truncate">
                         {actionLoading === 'restart' ? 'Restarting...' : 'Restart Server'}
                       </span>
                       <span className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1 block">Approx. 45s Downtime</span>
                    </div>
                 </div>
                 <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-300 group-hover:text-[#5D5FEF] flex-shrink-0 ml-2" />
              </button>

              <button
                onClick={() => showPasswordModal(
                  'Clear System Cache',
                  'Enter your system password to clear the system cache and free up memory.',
                  'Clear Cache',
                  '/api/system/clear-cache',
                  'cache'
                )}
                disabled={actionLoading === 'cache'}
                className="flex items-center justify-between p-4 md:p-6 bg-gray-50/50 rounded-xl md:rounded-2xl border border-transparent hover:border-[#5D5FEF]/30 hover:bg-[#5D5FEF]/5 transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed min-h-[72px] md:min-h-[88px]"
              >
                 <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 group-hover:text-[#5D5FEF] group-hover:bg-[#5D5FEF]/10 shadow-sm transition-all flex-shrink-0">
                       <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div className="text-left min-w-0 flex flex-col justify-center">
                       <span className="text-sm md:text-[14px] font-black text-gray-900 group-hover:text-[#5D5FEF] block truncate">
                         {actionLoading === 'cache' ? 'Clearing...' : 'Clear System Cache'}
                       </span>
                       <span className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1 block">Free up memory</span>
                    </div>
                 </div>
                 <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-300 group-hover:text-[#5D5FEF] flex-shrink-0 ml-2" />
              </button>

              <button
                onClick={() => setConfirmDialog({
                  isOpen: true,
                  title: 'Force Synchronization',
                  message: 'This will synchronize data across all nodes. Continue?',
                  confirmText: 'Sync Now',
                  action: () => alert('Sync functionality would be implemented based on your infrastructure'),
                  isDangerous: false
                })}
                className="flex items-center justify-between p-4 md:p-6 bg-gray-50/50 rounded-xl md:rounded-2xl border border-transparent hover:border-[#5D5FEF]/30 hover:bg-[#5D5FEF]/5 transition-all group active:scale-[0.98] min-h-[72px] md:min-h-[88px]"
              >
                 <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 group-hover:text-[#5D5FEF] group-hover:bg-[#5D5FEF]/10 shadow-sm transition-all flex-shrink-0">
                       <CloudSync className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div className="text-left min-w-0 flex flex-col justify-center">
                       <span className="text-sm md:text-[14px] font-black text-gray-900 group-hover:text-[#5D5FEF] block truncate">Force Synchronization</span>
                       <span className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1 block">Sync data across nodes</span>
                    </div>
                 </div>
                 <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-300 group-hover:text-[#5D5FEF] flex-shrink-0 ml-2" />
              </button>

              <button
                onClick={() => showPasswordModal(
                  'Shutdown Server',
                  'WARNING: This will completely shut down the server. You will need to manually turn it back on. Enter your system password to proceed.',
                  'Shutdown',
                  '/api/system/shutdown',
                  'shutdown'
                )}
                disabled={actionLoading === 'shutdown'}
                className="flex items-center justify-between p-4 md:p-6 bg-gray-50/50 rounded-xl md:rounded-2xl border border-transparent hover:border-red-200 hover:bg-red-50/50 transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed min-h-[72px] md:min-h-[88px]"
              >
                 <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="w-9 h-9 md:w-10 md:h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 group-hover:text-red-500 group-hover:bg-red-100 shadow-sm transition-all flex-shrink-0">
                       <Power className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div className="text-left min-w-0 flex flex-col justify-center">
                       <span className="text-sm md:text-[14px] font-black text-gray-900 group-hover:text-red-600 block truncate">
                         {actionLoading === 'shutdown' ? 'Shutting down...' : 'Shutdown Server'}
                       </span>
                       <span className="text-[8px] md:text-[9px] font-bold text-red-300 uppercase tracking-widest mt-1 block">Permanent Shutdown</span>
                    </div>
                 </div>
                 <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-300 group-hover:text-red-500 flex-shrink-0 ml-2" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ServerView;
