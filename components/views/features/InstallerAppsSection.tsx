import React, { useState, useEffect, useRef } from 'react';
import { Download, Trash2, ExternalLink, RefreshCw, Terminal, Loader2, AlertCircle, Star, Package, Play } from 'lucide-react';

interface AppStatus {
  installed: boolean;
  running: boolean;
  ports?: Record<number, number>;
}
interface Statuses {
  [key: string]: AppStatus;
}

interface InstallerApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  port: number | null;
  webUI: boolean;
  isRequired?: boolean;
  isApt?: boolean;
  isCurl?: boolean;
  rating: number;
  reviewCount: string;
  installCount: string;
  accentFrom: string;
  accentTo: string;
}

// ─── App catalogue ────────────────────────────────────────────────────────────

const APPS: InstallerApp[] = [
  // ── Infrastructure ──
  {
    id: 'docker',
    name: 'Docker Engine',
    icon: '/assets/apps/docker.svg',
    description: 'Container runtime required by all Docker-based apps. Install this first.',
    category: 'Infrastructure',
    port: null,
    webUI: false,
    isRequired: true,
    isApt: true,
    rating: 4.9, reviewCount: '48.2k', installCount: '142k',
    accentFrom: 'from-sky-400/20', accentTo: 'to-blue-500/10',
  },
  {
    id: 'portainer',
    name: 'Portainer',
    icon: '/assets/apps/portainer.svg',
    description: 'Visual Docker management — monitor, start, stop, and configure all containers.',
    category: 'Infrastructure',
    port: 9000,
    webUI: true,
    rating: 4.7, reviewCount: '14.2k', installCount: '52k',
    accentFrom: 'from-sky-400/20', accentTo: 'to-cyan-400/10',
  },
  {
    id: 'watchtower',
    name: 'Watchtower',
    icon: '/assets/apps/watchtower.svg',
    description: 'Automatically updates your Docker containers when new image versions are released.',
    category: 'Infrastructure',
    port: null,
    webUI: false,
    rating: 4.6, reviewCount: '8.9k', installCount: '38k',
    accentFrom: 'from-slate-400/20', accentTo: 'to-gray-400/10',
  },

  // ── Networking ──
  {
    id: 'cloudflare',
    name: 'Cloudflare Tunnel',
    icon: '/assets/apps/cloudflare.svg',
    description: 'Expose Arcellite securely to the internet without opening firewall ports.',
    category: 'Networking',
    port: null,
    webUI: false,
    isApt: true,
    rating: 4.8, reviewCount: '21.3k', installCount: '87k',
    accentFrom: 'from-orange-400/20', accentTo: 'to-amber-400/10',
  },

  // ── Cloud Services ──
  {
    id: 'minio',
    name: 'MinIO',
    icon: '/assets/apps/minio.svg',
    description: 'High-performance S3-compatible object storage for files, backups, and datasets.',
    category: 'Cloud Services',
    port: 9001,
    webUI: true,
    rating: 4.7, reviewCount: '9.3k', installCount: '41k',
    accentFrom: 'from-rose-400/20', accentTo: 'to-pink-400/10',
  },
  {
    id: 'n8n',
    name: 'n8n',
    icon: '/assets/apps/n8n.svg',
    description: 'Workflow automation — connect Arcellite AI to any API or service with zero code.',
    category: 'Cloud Services',
    port: 5678,
    webUI: true,
    rating: 4.8, reviewCount: '19.5k', installCount: '63k',
    accentFrom: 'from-pink-400/20', accentTo: 'to-rose-400/10',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    icon: '/assets/apps/ollama.svg',
    description: 'Run AI models locally or offload to Ollama Cloud. Private AI compute for your stack.',
    category: 'Cloud Services',
    port: 11434,
    webUI: true,
    isCurl: true,
    rating: 4.9, reviewCount: '33.7k', installCount: '210k',
    accentFrom: 'from-[#5D5FEF]/20', accentTo: 'to-violet-400/10',
  },

  // ── Database ──
  {
    id: 'redis',
    name: 'Redis',
    icon: '/assets/apps/redis.svg',
    description: 'In-memory data store for caching, queues, sessions, and pub/sub messaging.',
    category: 'Database',
    port: 6379,
    webUI: false,
    rating: 4.9, reviewCount: '44.6k', installCount: '198k',
    accentFrom: 'from-red-500/20', accentTo: 'to-orange-400/10',
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    icon: '/assets/apps/postgresql.svg',
    description: 'Powerful open-source relational database. The primary DB layer for your private cloud.',
    category: 'Database',
    port: 5432,
    webUI: false,
    rating: 4.9, reviewCount: '52.1k', installCount: '220k',
    accentFrom: 'from-blue-400/20', accentTo: 'to-sky-400/10',
  },
  {
    id: 'mysql',
    name: 'MySQL',
    icon: '/assets/apps/mysql.svg',
    description: 'The world\'s most popular open-source relational database — fast and battle-tested.',
    category: 'Database',
    port: 3306,
    webUI: false,
    rating: 4.8, reviewCount: '61.4k', installCount: '310k',
    accentFrom: 'from-orange-400/20', accentTo: 'to-yellow-400/10',
  },

  // ── Monitoring ──
  {
    id: 'uptime-kuma',
    name: 'Uptime Kuma',
    icon: '/assets/apps/uptime-kuma.svg',
    description: 'Self-hosted monitoring dashboard to track uptime and response times for all your services.',
    category: 'Monitoring',
    port: 3001,
    webUI: true,
    rating: 4.8, reviewCount: '22.1k', installCount: '58k',
    accentFrom: 'from-green-400/20', accentTo: 'to-emerald-400/10',
  },
  {
    id: 'loki',
    name: 'Loki',
    icon: '/assets/apps/loki.svg',
    description: 'Log aggregation by Grafana — collect and query logs from all your services in one place.',
    category: 'Monitoring',
    port: 3100,
    webUI: false,
    rating: 4.5, reviewCount: '7.4k', installCount: '29k',
    accentFrom: 'from-orange-400/20', accentTo: 'to-yellow-400/10',
  },

  // ── Security ──
  {
    id: 'keycloak',
    name: 'Keycloak',
    icon: '/assets/apps/keycloak.svg',
    description: 'Open-source identity and access management — SSO, OAuth2, and user federation.',
    category: 'Security',
    port: 8080,
    webUI: true,
    rating: 4.6, reviewCount: '11.8k', installCount: '44k',
    accentFrom: 'from-red-400/20', accentTo: 'to-rose-400/10',
  },
];

const CATEGORY_ORDER = ['Infrastructure', 'Networking', 'Cloud Services', 'Database', 'Monitoring', 'Security'];

// ─── Skeleton card ───────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 animate-pulse">
    <div className="flex items-center gap-3.5 mb-4">
      <div className="w-11 h-11 rounded-xl bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-28 bg-gray-200 rounded" />
        <div className="h-3 w-20 bg-gray-100 rounded" />
      </div>
    </div>
    <div className="h-3 w-full bg-gray-100 rounded mb-2" />
    <div className="h-3 w-3/4 bg-gray-100 rounded mb-5" />
    <div className="h-3 w-1/2 bg-gray-50 rounded mb-4" />
    <div className="flex items-center gap-2">
      <div className="h-9 w-9 rounded-xl bg-gray-100" />
      <div className="h-9 flex-1 rounded-xl bg-gray-100" />
    </div>
  </div>
);

// ─── Star Rating ──────────────────────────────────────────────────────────────

const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(i => {
      const filled = rating >= i;
      const half = !filled && rating >= i - 0.5;
      return (
        <div key={i} className="relative w-3 h-3">
          <Star className="w-3 h-3 text-gray-200 fill-gray-200" />
          {(filled || half) && (
            <div className={`absolute inset-0 overflow-hidden ${half ? 'w-1/2' : 'w-full'}`}>
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            </div>
          )}
        </div>
      );
    })}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const InstallerAppsSection: React.FC = () => {
  const [statuses, setStatuses] = useState<Statuses | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [actionApp, setActionApp] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [showLogs, setShowLogs] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [iconErrors, setIconErrors] = useState<Record<string, boolean>>({});
  const [iconLoaded, setIconLoaded] = useState<Record<string, boolean>>({});
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const logsEndRef = useRef<Record<string, HTMLDivElement | null>>({});

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('sessionToken');
      const res = await fetch('/api/apps/installers/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStatuses(await res.json());
        setIsInitialLoad(false);
      }
    } catch {}
  };

  const handleManualRefresh = async () => {
    setManualRefreshing(true);
    await fetchStatus();
    setManualRefreshing(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  useEffect(() => {
    Object.keys(logs).forEach(id => {
      logsEndRef.current[id]?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [logs]);

  const runAction = async (appId: string, action: 'install' | 'uninstall') => {
    setActionApp(appId);
    setLogs(prev => ({ ...prev, [appId]: [] }));
    setActionError(prev => { const n = { ...prev }; delete n[appId]; return n; });
    try {
      const token = localStorage.getItem('sessionToken');
      const res = await fetch(`/api/apps/installers/${appId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const contentType = res.headers.get('Content-Type') || '';
      if (!res.ok) {
        const errBody = await res.text();
        let errMsg = `Request failed (${res.status})`;
        try {
          const j = JSON.parse(errBody);
          if (j.error) errMsg = j.error;
        } catch {}
        setActionError(p => ({ ...p, [appId]: errMsg }));
        return;
      }
      if (!contentType.includes('text/event-stream') || !res.body) {
        await fetchStatus();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.replace(/^data: /, '').trim();
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'log') setLogs(p => ({ ...p, [appId]: [...(p[appId] ?? []), msg.text] }));
            else if (msg.type === 'error') setActionError(p => ({ ...p, [appId]: msg.text }));
          } catch {}
        }
      }
      await fetchStatus();
    } catch (e: any) {
      setActionError(p => ({ ...p, [appId]: e.message || String(e) || 'Network error' }));
    } finally {
      setActionApp(null);
    }
  };

  const dockerOk = statuses?.docker?.installed ?? false;

  const renderCard = (app: InstallerApp) => {
    const status = statuses?.[app.id];
    const isLoading = actionApp === app.id;
    const err = actionError[app.id];
    const hasLogs = (logs[app.id]?.length ?? 0) > 0;
    const logsVisible = showLogs[app.id];
    const canInstall = (app.isApt || app.isCurl) ? true : dockerOk;
    const isRunning = status?.running ?? false;
    const isInstalled = status?.installed ?? false;
    const iconError = iconErrors[app.id];
    const iconReady = iconLoaded[app.id] || iconError;
    const actualPort = app.port != null
      ? (status?.ports?.[app.port] ?? app.port)
      : null;

    return (
      <div
        key={app.id}
        className="group bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:border-[#5D5FEF]/20 hover:shadow-md transition-all duration-300 flex flex-col"
      >
        <div className="p-5 flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-start gap-3.5 mb-3">
            <div className="w-11 h-11 rounded-xl bg-[#F5F5F7] flex items-center justify-center flex-shrink-0 overflow-hidden relative">
              {!iconReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-lg bg-gray-200 animate-pulse" aria-hidden />
                </div>
              )}
              {!iconError ? (
                <img
                  src={app.icon}
                  alt={app.name}
                  className={`w-7 h-7 object-contain transition-opacity duration-200 ${iconReady ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setIconLoaded(p => ({ ...p, [app.id]: true }))}
                  onError={() => setIconErrors(p => ({ ...p, [app.id]: true }))}
                />
              ) : (
                <Package className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-gray-900 leading-tight truncate">{app.name}</h3>
                {app.isRequired && (
                  <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#5D5FEF] text-white flex-shrink-0">Required</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[11px] font-semibold text-[#5D5FEF]">{app.category}</span>
                {app.port != null && (
                  <span className="text-[10px] text-gray-400">
                    :{actualPort}
                    {actualPort !== app.port && (
                      <span className="ml-0.5 text-amber-500" title={`Remapped from ${app.port}`}>&#8593;</span>
                    )}
                  </span>
                )}
                {app.isApt && <span className="text-[9px] font-semibold px-1.5 py-px rounded bg-gray-100 text-gray-400">apt</span>}
                {app.isCurl && <span className="text-[9px] font-semibold px-1.5 py-px rounded bg-gray-100 text-gray-400">curl</span>}
              </div>
            </div>
            <div className="flex-shrink-0 mt-0.5">
              {isRunning && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Running
                </span>
              )}
              {isInstalled && !isRunning && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  Stopped
                </span>
              )}
            </div>
          </div>

          <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2 mb-4 flex-1">{app.description}</p>

          {/* Rating + stats */}
          <div className="flex items-center gap-3 mb-4">
            <StarRating rating={app.rating} />
            <span className="text-[10px] font-semibold text-gray-400">{app.rating}</span>
            <span className="text-[10px] text-gray-300">|</span>
            <span className="text-[10px] text-gray-400">{app.installCount} installs</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={manualRefreshing}
              className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#5D5FEF] hover:border-[#5D5FEF]/30 transition-all disabled:opacity-40"
              title="Refresh status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${manualRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {isRunning && app.webUI && actualPort && (
              <a
                href={`http://${window.location.hostname}:${actualPort}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5D5FEF] text-white text-xs font-bold hover:bg-[#4B4DD4] transition-all shadow-sm shadow-[#5D5FEF]/15"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </a>
            )}
            {isInstalled && !isRunning && app.webUI && app.port && (
              <span
                title="Start the app first"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-400 text-xs font-bold cursor-not-allowed select-none"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </span>
            )}

            {hasLogs && (
              <button
                onClick={() => setShowLogs(p => ({ ...p, [app.id]: !p[app.id] }))}
                className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#5D5FEF] hover:border-[#5D5FEF]/30 transition-all"
                title="Toggle output"
              >
                <Terminal className="w-3.5 h-3.5" />
              </button>
            )}

            {!isInstalled ? (
              <button
                key={`install-${app.id}`}
                onClick={() => runAction(app.id, 'install')}
                disabled={isLoading || !canInstall}
                title={!canInstall ? 'Install Docker Engine first' : undefined}
                className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#5D5FEF] text-white text-xs font-bold hover:bg-[#4B4DD4] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-[#5D5FEF]/15"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {isLoading ? 'Installing\u2026' : 'Install'}
              </button>
            ) : isInstalled && !isRunning ? (
              <button
                key={`start-${app.id}`}
                onClick={() => runAction(app.id, 'install')}
                disabled={isLoading}
                className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-sm"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {isLoading ? 'Starting\u2026' : 'Start'}
              </button>
            ) : (
              <button
                key={`uninstall-${app.id}`}
                onClick={() => runAction(app.id, 'uninstall')}
                disabled={isLoading}
                className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-500 hover:text-white hover:border-red-500 transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {isLoading ? 'Removing\u2026' : 'Uninstall'}
              </button>
            )}
          </div>

          {err && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-700 font-medium whitespace-pre-wrap">{err}</p>
            </div>
          )}
        </div>

        {logsVisible && hasLogs && (
          <div className="border-t border-gray-200 bg-[#1d1d1f] p-4 max-h-44 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-3 h-3 text-gray-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{isLoading ? 'Running\u2026' : 'Output'}</span>
            </div>
            {logs[app.id].map((line, i) => (
              <p key={i} className="text-[11px] font-mono text-green-400 leading-relaxed whitespace-pre-wrap">{line}</p>
            ))}
            <div ref={el => { logsEndRef.current[app.id] = el; }} />
          </div>
        )}
      </div>
    );
  };

  const grouped = CATEGORY_ORDER
    .map(cat => ({ category: cat, apps: APPS.filter(a => a.category === cat) }))
    .filter(g => g.apps.length > 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {isInitialLoad ? (
        grouped.map(group => (
          <div key={group.category}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="flex-1 h-px bg-gray-100" />
              <div className="h-3 w-8 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {group.apps.map((app, i) => (
                <SkeletonCard key={`skeleton-${group.category}-${app.id}-${i}`} />
              ))}
            </div>
          </div>
        ))
      ) : (
        grouped.map(group => (
          <div key={group.category}>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-widest">{group.category}</h3>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
              <span className="text-[10px] font-semibold text-gray-400">{group.apps.length}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {group.apps.map(renderCard)}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default InstallerAppsSection;
