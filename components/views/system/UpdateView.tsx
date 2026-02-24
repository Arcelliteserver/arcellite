import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ArrowUpCircle,
  ShieldCheck,
  FileText,
  Terminal,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Download,
  GitBranch,
  Clock,
  Package,
  Lock,
  GitMerge,
  Database,
  Server,
  CheckCheck,
  AlertTriangle,
  Activity,
  RotateCw,
} from 'lucide-react';

interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  lastChecked: string;
  error?: string;
}

interface UpdateLog {
  running: boolean;
  step: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lines: string[];
  success: boolean | null;
}

type SectionId = 'overview' | 'security' | 'changelog' | 'log';

const UpdateView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [log, setLog] = useState<UpdateLog>({ running: false, step: null, startedAt: null, finishedAt: null, lines: [], success: null });
  const [updating, setUpdating] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = localStorage.getItem('sessionToken') || '';
  const headers = { Authorization: `Bearer ${token}` };

  const checkUpdate = useCallback(async (force = false) => {
    setChecking(true);
    try {
      const r = await fetch(`/api/update/check${force ? '?force=1' : ''}`, { headers });
      const data = await r.json();
      setInfo(data);
    } catch { /* silent */ }
    finally { setChecking(false); }
  }, []);

  const pollLog = useCallback(async () => {
    try {
      const r = await fetch('/api/update/log', { headers });
      const data: UpdateLog = await r.json();
      setLog(data);
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      if (!data.running && data.finishedAt) {
        if (pollRef.current) clearInterval(pollRef.current);
        setUpdating(false);
        setTimeout(() => checkUpdate(true), 2000);
      }
    } catch { /* silent */ }
  }, [checkUpdate]);

  useEffect(() => {
    checkUpdate();
    pollLog();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    setActiveSection('log');
    setLog({ running: true, step: 'Starting update...', startedAt: new Date().toISOString(), finishedAt: null, lines: [], success: null });
    try {
      await fetch('/api/update/run', { method: 'POST', headers });
      pollRef.current = setInterval(pollLog, 1500);
    } catch { setUpdating(false); }
  };

  const sidebarItems: { id: SectionId; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'overview',  label: 'Overview',    icon: Package,    badge: info?.updateAvailable ? 'New' : undefined },
    { id: 'security',  label: 'Security',    icon: ShieldCheck },
    { id: 'changelog', label: "What's New",  icon: FileText },
    { id: 'log',       label: 'Update Log',  icon: Terminal,   badge: log.running ? '…' : log.success === false ? '!' : undefined },
  ];

  const isUpToDate = info && !info.updateAvailable;

  return (
    <div className="py-2">
      {/* ── Header ── */}
      <div className="mb-6 md:mb-8 pb-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 md:h-10 bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full flex-shrink-0" />
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 tracking-tight">Updates</h1>
            <p className="text-sm text-gray-500 mt-1">
              Keep Arcellite current — you control when updates happen. Your data is never touched.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* ── Sidebar ── */}
        <nav className="w-full md:w-52 flex-shrink-0">
          <div className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl transition-all text-left ${
                    isActive
                      ? 'bg-[#5D5FEF]/10 text-[#5D5FEF] font-bold'
                      : 'text-gray-500 hover:bg-gray-50 font-medium'
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                  <span className="text-[14px] flex-1">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                      item.badge === '!' ? 'bg-red-100 text-red-600'
                      : item.badge === '…' ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]'
                      : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* ═══ OVERVIEW ═══ */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Version Overview</h2>
                <p className="text-sm text-gray-400">Your installed version compared to the latest available release.</p>
              </div>

              {/* Metric cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {/* Installed */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-indigo-600 flex items-center justify-center shadow-lg shadow-[#5D5FEF]/25">
                      <GitBranch className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Installed</span>
                  </div>
                  {checking
                    ? <div className="h-9 w-24 bg-gray-100 rounded-lg animate-pulse" />
                    : <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">
                        <span className="text-lg text-gray-400 font-bold">v</span>{info?.currentVersion ?? '—'}
                      </p>
                  }
                  <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Current Version</p>
                </div>

                {/* Latest */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                      info?.updateAvailable
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/25'
                        : 'bg-gradient-to-br from-[#5D5FEF] to-indigo-700 shadow-[#5D5FEF]/25'
                    }`}>
                      <Download className="w-5 h-5 text-white" />
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                      info?.updateAvailable ? 'bg-amber-100 text-amber-600' : 'bg-[#5D5FEF]/10 text-[#5D5FEF]'
                    }`}>
                      {checking ? '…' : info?.updateAvailable ? 'New' : 'Latest'}
                    </span>
                  </div>
                  {checking
                    ? <div className="h-9 w-24 bg-gray-100 rounded-lg animate-pulse" />
                    : <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">
                        <span className="text-lg text-gray-400 font-bold">v</span>{info?.latestVersion ?? '—'}
                      </p>
                  }
                  <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Latest Release</p>
                </div>

                {/* Status */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                      log.running
                        ? 'bg-gradient-to-br from-[#5D5FEF] to-indigo-600 shadow-[#5D5FEF]/25'
                        : isUpToDate
                          ? 'bg-gradient-to-br from-gray-800 to-gray-900 shadow-gray-800/25'
                          : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/25'
                    }`}>
                      {log.running
                        ? <RotateCw className="w-5 h-5 text-white animate-spin" />
                        : isUpToDate
                          ? <CheckCheck className="w-5 h-5 text-white" />
                          : <AlertTriangle className="w-5 h-5 text-white" />
                      }
                    </div>
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Status</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-gray-900 leading-none">
                    {log.running ? 'Updating' : isUpToDate ? 'Current' : info?.updateAvailable ? 'Outdated' : '—'}
                  </p>
                  <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Install Status</p>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {info?.lastChecked && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-gray-300 flex-shrink-0" />
                        <span className="text-[10px] text-gray-400">
                          Checked {new Date(info.lastChecked).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Error banner */}
              {info?.error && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">{info.error}</p>
                </div>
              )}

              {/* Update available callout */}
              {info?.updateAvailable && (
                <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 border-b border-amber-100 flex items-center gap-3">
                    <ArrowUpCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="text-sm font-black text-amber-900">v{info.latestVersion} is available</p>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <p className="text-[13px] text-gray-600">The update will:</p>
                    <ul className="space-y-2">
                      {[
                        ['Git pull',     'Download the latest code from the update server'],
                        ['npm install',  'Install any new or updated dependencies'],
                        ['Build',        'Rebuild the frontend and compile the server'],
                        ['Restart',      'Reload via PM2 — zero manual steps required'],
                      ].map(([step, desc]) => (
                        <li key={step} className="flex items-start gap-3">
                          <span className="text-[10px] font-black bg-[#5D5FEF]/10 text-[#5D5FEF] px-2 py-0.5 rounded-md mt-0.5 flex-shrink-0">{step}</span>
                          <span className="text-[13px] text-gray-500">{desc}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[12px] text-gray-400 pt-1">
                      Your files, databases, and settings are not affected by updates.
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => checkUpdate(true)}
                  disabled={checking || updating}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                  {checking ? 'Checking…' : 'Re-check'}
                </button>
                {info?.updateAvailable && (
                  <button
                    onClick={handleUpdate}
                    disabled={updating}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#5D5FEF] hover:bg-[#4B4DD4] rounded-xl transition-all disabled:opacity-60 shadow-sm shadow-[#5D5FEF]/20"
                  >
                    <Download className="w-4 h-4" />
                    {updating ? 'Updating…' : `Install v${info.latestVersion}`}
                  </button>
                )}
              </div>

              {/* Success banner */}
              {log.success === true && (
                <div className="flex items-start gap-3 bg-[#5D5FEF]/5 border border-[#5D5FEF]/15 rounded-2xl px-5 py-4">
                  <CheckCircle2 className="w-5 h-5 text-[#5D5FEF] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black text-gray-900">Update complete!</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Arcellite has restarted. Refresh this page to load the new version.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ SECURITY ═══ */}
          {activeSection === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Update Security</h2>
                <p className="text-sm text-gray-400">How Arcellite keeps your installation safe during the update process.</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
                {[
                  {
                    icon: Lock,
                    color: 'text-[#5D5FEF]',
                    bg: 'bg-[#5D5FEF]/5',
                    title: 'Verified source',
                    description: 'Updates are pulled directly from the official Arcellite update server via HTTPS — no third-party servers involved.',
                    status: 'Verified',
                    statusColor: 'bg-[#5D5FEF]/10 text-[#5D5FEF]',
                  },
                  {
                    icon: GitMerge,
                    color: 'text-[#5D5FEF]',
                    bg: 'bg-[#5D5FEF]/5',
                    title: 'Git-based updates',
                    description: 'git pull preserves your local .env, uploads, and databases. Only source code files are changed — never your data.',
                    status: 'Safe',
                    statusColor: 'bg-[#5D5FEF]/10 text-[#5D5FEF]',
                  },
                  {
                    icon: Database,
                    color: 'text-blue-500',
                    bg: 'bg-blue-50',
                    title: 'Data is preserved',
                    description: 'Your PostgreSQL, MySQL, and SQLite databases are untouched. All uploaded files remain in ~/arcellite-data.',
                    status: 'Protected',
                    statusColor: 'bg-blue-100 text-blue-700',
                  },
                  {
                    icon: Server,
                    color: 'text-amber-500',
                    bg: 'bg-amber-50',
                    title: 'Build before restart',
                    description: 'The frontend and server are fully compiled before PM2 restarts. A failed build will not restart your instance.',
                    status: 'Isolated',
                    statusColor: 'bg-amber-100 text-amber-700',
                  },
                  {
                    icon: ShieldCheck,
                    color: 'text-[#5D5FEF]',
                    bg: 'bg-[#5D5FEF]/5',
                    title: 'You control when to update',
                    description: 'Auto-updates are disabled. Arcellite only updates when you press "Install" — never silently in the background.',
                    status: 'Manual Only',
                    statusColor: 'bg-[#5D5FEF]/10 text-[#5D5FEF]',
                  },
                  {
                    icon: Activity,
                    color: 'text-[#5D5FEF]',
                    bg: 'bg-[#5D5FEF]/5',
                    title: 'Full update log',
                    description: 'Every step of the update — git pull, npm install, build, restart — is logged and visible in the Update Log tab.',
                    status: 'Auditable',
                    statusColor: 'bg-[#5D5FEF]/10 text-[#5D5FEF]',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 px-5 py-4">
                    <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-bold text-gray-900">{item.title}</p>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.statusColor}`}>{item.status}</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rollback note */}
              <div className="bg-gray-50 rounded-2xl border border-gray-100 px-5 py-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-gray-700">Manual rollback</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    If an update causes issues, run <code className="bg-gray-200 px-1 rounded text-[11px]">git log</code> to find the previous commit and <code className="bg-gray-200 px-1 rounded text-[11px]">git checkout &lt;hash&gt;</code> to revert, then rebuild.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══ CHANGELOG ═══ */}
          {activeSection === 'changelog' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">What's New</h2>
                <p className="text-sm text-gray-400">
                  {info?.updateAvailable
                    ? `Changes included in v${info.latestVersion}`
                    : 'You are running the latest version of Arcellite.'}
                </p>
              </div>

              {info?.updateAvailable ? (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-[#5D5FEF]/5 to-indigo-50 px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <ArrowUpCircle className="w-4 h-4 text-[#5D5FEF]" />
                    <span className="text-sm font-black text-gray-900">v{info.latestVersion}</span>
                    <span className="ml-auto text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">New release</span>
                  </div>
                  <div className="px-5 py-5 space-y-3">
                    <p className="text-xs text-gray-500 leading-relaxed">
                      A new version of Arcellite is available. Install it from the Overview tab to get the latest features, improvements, and security fixes.
                    </p>
                    <button
                      onClick={() => { setActiveSection('overview'); }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#5D5FEF] hover:bg-[#4B4DD4] rounded-xl transition-all shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      Go to Overview to install
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-[#5D5FEF]/5 to-indigo-50 px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#5D5FEF]" />
                    <span className="text-sm font-black text-gray-900">v{info?.currentVersion ?? '—'} — Current</span>
                  </div>
                  <div className="px-5 py-5">
                    <p className="text-xs text-gray-500 leading-relaxed">
                      You are on the latest version. When a new release is available, a summary of changes will appear here.
                    </p>
                  </div>
                </div>
              )}

              {/* Installation details — no external URLs */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
                <div className="px-5 py-3">
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">Installation details</p>
                </div>
                {[
                  { label: 'Installed version', value: info ? `v${info.currentVersion}` : '—' },
                  { label: 'Latest release',     value: info ? `v${info.latestVersion}` : '—' },
                  { label: 'Last checked',       value: info?.lastChecked ? new Date(info.lastChecked).toLocaleString() : '—' },
                  { label: 'Update channel',     value: 'Stable' },
                  { label: 'Update method',      value: 'git pull + npm install + build' },
                  { label: 'Auto-update',        value: 'Disabled (manual only)' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm font-medium text-gray-500">{row.label}</p>
                    <p className="text-sm font-bold text-gray-900 text-right">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ UPDATE LOG ═══ */}
          {activeSection === 'log' && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Update Log</h2>
                  <p className="text-sm text-gray-400">
                    {log.running
                      ? `Running: ${log.step}`
                      : log.finishedAt
                        ? `Finished at ${new Date(log.finishedAt).toLocaleTimeString()}`
                        : 'No update has been run yet.'}
                  </p>
                </div>
                {!log.running && info?.updateAvailable && (
                  <button
                    onClick={handleUpdate}
                    disabled={updating}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#5D5FEF] hover:bg-[#4B4DD4] rounded-xl transition-all flex-shrink-0 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Install v{info.latestVersion}
                  </button>
                )}
              </div>

              {/* Step progress */}
              {(log.running || log.lines.length > 0) && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { label: 'Git pull',    key: 'Pulling' },
                    { label: 'npm install', key: 'Installing' },
                    { label: 'Build',       key: 'Building' },
                    { label: 'Compile',     key: 'Compiling' },
                    { label: 'Restart',     key: 'Restarting' },
                  ].map((step) => {
                    const isDone   = log.lines.some(l => l.includes(`── ${step.key}`));
                    const isActive = log.running && log.step?.includes(step.key);
                    return (
                      <div key={step.label} className={`rounded-xl px-3 py-2.5 text-center text-[11px] font-bold border ${
                        isActive ? 'bg-[#5D5FEF]/10 border-[#5D5FEF]/20 text-[#5D5FEF]' :
                        isDone   ? 'bg-gray-900 border-gray-800 text-white' :
                                   'bg-gray-50 border-gray-100 text-gray-400'
                      }`}>
                        <div className="flex items-center justify-center gap-1.5 mb-0.5">
                          {isActive ? <RotateCw className="w-3 h-3 animate-spin" />
                            : isDone ? <CheckCircle2 className="w-3 h-3" />
                            : <div className="w-3 h-3 rounded-full border-2 border-current opacity-30" />}
                        </div>
                        {step.label}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Terminal log */}
              {log.lines.length > 0 || log.running ? (
                <div className="bg-[#0f0f14] rounded-2xl overflow-hidden shadow-lg">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      {log.running
                        ? <RotateCw className="w-4 h-4 text-[#5D5FEF] animate-spin flex-shrink-0" />
                        : log.success
                          ? <CheckCircle2 className="w-4 h-4 text-[#5D5FEF] flex-shrink-0" />
                          : log.success === false
                            ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            : <Terminal className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      }
                      <span className="text-sm font-bold text-white">
                        {log.running ? log.step || 'Updating…'
                          : log.success ? 'Update complete!'
                          : log.success === false ? 'Update failed'
                          : 'Update log'}
                      </span>
                    </div>
                    {log.startedAt && (
                      <span className="text-[11px] text-gray-500">
                        {new Date(log.startedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div
                    ref={logRef}
                    className="h-72 overflow-y-auto p-5 font-mono text-[11px] leading-relaxed"
                  >
                    {log.lines.map((line, i) =>
                      line.startsWith('──') ? (
                        <div key={i} className="text-[#5D5FEF] font-bold mt-2 mb-0.5">{line}</div>
                      ) : line.startsWith('[  OK  ]') ? (
                        <div key={i} className="text-white font-bold">{line}</div>
                      ) : line.startsWith('[ERROR]') ? (
                        <div key={i} className="text-red-400 font-bold">{line}</div>
                      ) : line.trim() === '' ? (
                        <div key={i} className="h-1" />
                      ) : (
                        <div key={i} className="text-gray-400">{line}</div>
                      )
                    )}
                    {log.running && <div className="text-[#5D5FEF] animate-pulse mt-1">▋</div>}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-12 text-center">
                  <Terminal className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-400">No update log yet</p>
                  <p className="text-xs text-gray-300 mt-1">Run an update from the Overview tab to see the log here.</p>
                </div>
              )}

              {/* Post-update success */}
              {log.success === true && (
                <div className="flex items-start gap-3 bg-[#5D5FEF]/5 border border-[#5D5FEF]/15 rounded-2xl px-5 py-4">
                  <CheckCircle2 className="w-5 h-5 text-[#5D5FEF] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black text-gray-900">Arcellite restarted successfully!</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Hard refresh this page (<kbd className="bg-gray-100 px-1 rounded text-[11px]">Ctrl+Shift+R</kbd>) to load the new version.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default UpdateView;
