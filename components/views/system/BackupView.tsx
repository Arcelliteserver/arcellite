import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck, Play, Trash2, RefreshCw, Clock, CheckCircle2,
  AlertTriangle, Loader2, Archive, Database, FolderOpen,
  ChevronDown, ChevronUp, HardDrive, CalendarDays, Terminal,
} from 'lucide-react';

interface BackupEntry {
  id: string;
  date: string;
  type: 'daily' | 'weekly';
  sizeHuman: string;
}

interface BackupStatus {
  backupDir: string;
  backupDirExists: boolean;
  totalBackups: number;
  lastBackup: { date: string; id: string; sizeHuman: string } | null;
  running: { startedAt: string } | null;
  backups: BackupEntry[];
  scriptPath?: string;
}

interface LogState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  lines: string[];
}

const api = (path: string, opts?: RequestInit) => {
  const token = localStorage.getItem('sessionToken');
  return fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
};

function relativeTime(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

const INCLUDED_ITEMS = [
  { icon: Database, label: 'PostgreSQL Database', desc: 'Full schema + data, compressed' },
  { icon: Database, label: 'Chat History DB', desc: 'AI conversation history' },
  { icon: FolderOpen, label: 'User Files', desc: 'Photos, videos, music & uploads' },
];

const BackupView: React.FC = () => {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogState>({ running: false, startedAt: null, finishedAt: null, exitCode: null, lines: [] });
  const [showLog, setShowLog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api('/api/backup/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setRunning(!!data.running);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  const fetchLog = useCallback(async () => {
    try {
      const res = await api('/api/backup/log');
      if (res.ok) {
        const data: LogState = await res.json();
        // Always update log — server preserves completed log for 10 min
        setLog(data);
        setRunning(data.running);
        if (!data.running) {
          fetchStatus();
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
        if (logRef.current) {
          logRef.current.scrollTop = logRef.current.scrollHeight;
        }
      }
    } catch {}
  }, [fetchStatus]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleRunBackup = async () => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await api('/api/backup/run', { method: 'POST' });
      if (res.ok) {
        setRunning(true);
        setShowLog(true);
        setLog({ running: true, startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, lines: [] });
        pollRef.current = setInterval(fetchLog, 2000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to start backup');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError('');
    try {
      const res = await api(`/api/backup/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMsg('Backup deleted');
        fetchStatus();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete backup');
      }
    } catch {
      setError('Network error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full">

      {/* Action bar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] font-medium text-gray-400">Automated backup and restore for your database and files</p>
        <button
          onClick={() => { setLoading(true); fetchStatus(); }}
          disabled={loading}
          className="px-3 py-2 rounded-xl text-[12px] font-bold bg-[#5D5FEF] text-white hover:bg-[#4B4DD4] transition-all flex items-center gap-1.5 shadow-sm shadow-[#5D5FEF]/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 mb-5">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-[13px] font-bold text-red-700">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-green-50 border border-green-100 mb-5">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-[13px] font-bold text-green-700">{successMsg}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">

            {/* Last Backup — dark anchor card */}
            <div className="bg-[#1d1d1f] rounded-2xl border border-[#2d2d2f] p-4 sm:p-5 shadow-sm overflow-hidden relative">
              <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[#5D5FEF]/15 blur-3xl" />
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-white/70" />
                </div>
                <span className="text-[10px] font-black text-white/30 uppercase tracking-wider">
                  {status?.lastBackup ? status.lastBackup.sizeHuman : '—'}
                </span>
              </div>
              <p className="text-3xl font-black text-white leading-none">
                {status?.lastBackup ? relativeTime(status.lastBackup.date) : 'Never'}
              </p>
              <p className="text-[11px] font-bold text-white/40 mt-1 uppercase tracking-wider">Last Backup</p>
              <div className="mt-3 pt-3 border-t border-white/10">
                <span className="text-[10px] font-medium text-white/30">
                  {status?.lastBackup ? formatDate(status.lastBackup.date) : 'No backups recorded yet'}
                </span>
              </div>
            </div>

            {/* Total Backups */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Archive className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Stored</span>
              </div>
              <p className="text-3xl font-black text-gray-900 leading-none">{status?.totalBackups ?? 0}</p>
              <p className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-wider">Total Backups</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="text-[10px] font-medium text-gray-400">7 daily · 4 weekly retained</span>
              </div>
            </div>

            {/* Backup Directory */}
            <div className="col-span-2 lg:col-span-1 bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <HardDrive className="w-4 h-4 text-gray-600" />
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  status?.backupDirExists ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'
                }`}>
                  {status?.backupDirExists ? 'Ready' : 'Missing'}
                </span>
              </div>
              <p className="text-[13px] font-black text-gray-900 leading-snug truncate">
                {status?.backupDir || '/var/arcellite/backups'}
              </p>
              <p className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-wider">Backup Directory</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="text-[10px] font-medium text-gray-400">
                  {status?.backupDirExists ? 'Directory verified and writable' : 'Directory not found — check config'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Run Backup action card ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-[13px] font-black text-gray-900 uppercase tracking-wider">Manual Backup</p>
              {running && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  In progress
                </span>
              )}
            </div>
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[14px] font-bold text-gray-800">
                  {running ? 'Backup is running…' : 'Run a full backup now'}
                </p>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  {running ? 'Check the live log below for real-time output' : 'Backs up database and all user files immediately'}
                </p>
              </div>
              <button
                onClick={handleRunBackup}
                disabled={running}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#5D5FEF] hover:bg-[#4B4DD4] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-[#5D5FEF]/20 active:scale-[0.98] whitespace-nowrap flex-shrink-0"
              >
                {running ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {running ? 'Running…' : 'Start Backup'}
              </button>
            </div>
          </div>

          {/* ── Live Log ── */}
          {(running || log.lines.length > 0) && (
            <div className="bg-gray-950 rounded-2xl overflow-hidden border border-gray-800 mb-6">
              <button
                onClick={() => setShowLog(v => !v)}
                className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                    <Terminal className="w-3.5 h-3.5 text-gray-300" />
                  </div>
                  <div className="flex items-center gap-2">
                    {running ? (
                      <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                    ) : log.exitCode !== 0 && log.exitCode !== null ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span className="text-[13px] font-bold text-gray-200">
                      {running
                        ? 'Backup in progress…'
                        : log.exitCode !== 0 && log.exitCode !== null
                        ? 'Backup failed'
                        : 'Backup completed'}
                    </span>
                    {(log.finishedAt || log.startedAt) && (
                      <span className="text-[11px] text-gray-500">
                        {relativeTime(log.finishedAt || log.startedAt!)}
                      </span>
                    )}
                  </div>
                </div>
                {showLog ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>
              {showLog && (
                <div
                  ref={logRef}
                  className="px-5 pb-5 max-h-64 overflow-y-auto font-mono text-[11px] space-y-0.5 leading-relaxed border-t border-white/5"
                >
                  {log.lines.length === 0 ? (
                    <p className="text-gray-500 pt-3">Starting backup process…</p>
                  ) : (
                    log.lines.map((line, i) => (
                      <p
                        key={i}
                        className={
                          line.includes('ERROR') || line.includes('fail')
                            ? 'text-red-400'
                            : line.includes('OK') || line.includes('complete') || line.includes('success')
                            ? 'text-emerald-400'
                            : line.includes('WARN')
                            ? 'text-amber-400'
                            : 'text-gray-400'
                        }
                      >
                        {line}
                      </p>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Backup History ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-[13px] font-black text-gray-900 uppercase tracking-wider">Backup History</p>
              <span className="text-[11px] font-bold text-gray-400">
                {status?.totalBackups ?? 0} {(status?.totalBackups ?? 0) === 1 ? 'backup' : 'backups'}
              </span>
            </div>

            {!status?.backups?.length ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <Archive className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-[13px] font-bold text-gray-500">No backups yet</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Run your first backup above to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {status.backups.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors group">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <CalendarDays className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-gray-800 truncate">{formatDate(b.date)}</p>
                        <p className="text-[11px] text-gray-400">
                          {b.sizeHuman}
                          <span className="mx-1.5 text-gray-200">·</span>
                          <span className={`font-bold ${b.type === 'weekly' ? 'text-gray-500' : 'text-gray-400'}`}>
                            {b.type === 'weekly' ? 'Weekly' : 'Daily'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        b.type === 'weekly' ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {b.type}
                      </span>
                      <button
                        onClick={() => handleDelete(b.id)}
                        disabled={!!deletingId}
                        className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-30"
                        title="Delete backup"
                      >
                        {deletingId === b.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── What's included ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-[13px] font-black text-gray-900 uppercase tracking-wider">What's Included</p>
            </div>
            <div className="divide-y divide-gray-50">
              {INCLUDED_ITEMS.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-800">{label}</p>
                    <p className="text-[11px] text-gray-400">{desc}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* ── Scheduled Backups ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-[13px] font-black text-gray-900 uppercase tracking-wider">Scheduled Backups</p>
              <span className="text-[11px] font-bold text-gray-400">Cron setup</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-[13px] text-gray-600 font-medium mb-3">
                Add to crontab to run automatic daily backups at 2 AM:
              </p>
              <div className="px-4 py-3 rounded-xl bg-gray-950 font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-nowrap">
                0 2 * * * {status?.scriptPath || '/path/to/arcellite/scripts/backup.sh'} {'>>'} ~/.arcellite/logs/backup.log 2{'>&'}1
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                Retention policy: last 7 daily backups + last 4 weekly snapshots. Older backups are pruned automatically.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BackupView;
