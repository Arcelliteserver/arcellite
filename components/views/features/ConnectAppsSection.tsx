import React, { useState, useEffect } from 'react';
import { Plug, Loader2, AlertCircle, Eye, EyeOff, CheckCircle2, ChevronUp, ArrowRight } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Field {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
}

interface StaticApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  iconBg: string;
  fields: Field[];
}

interface McpInstance {
  id: string; // e.g. 'mcp_1700000000000'
}

interface ConnectState {
  connected: boolean;
  fields: Record<string, string>;
  statusMessage?: string;
}

type AllConnectState = Record<string, ConnectState>;

// ─── Static apps ─────────────────────────────────────────────────────────────

const STATIC_APPS: StaticApp[] = [
  {
    id: 'discord',
    name: 'Discord',
    icon: '/assets/apps/discord.svg',
    description: 'Connect your Discord server to access channels and send messages via Arcellite AI.',
    category: 'Communication',
    iconBg: 'from-indigo-100 to-violet-50',
    fields: [
      { key: 'channelsUrl', label: 'Channels Webhook URL', type: 'text', placeholder: 'https://your-n8n.com/webhook/...' },
      { key: 'sendUrl', label: 'Send Webhook URL', type: 'text', placeholder: 'https://your-n8n.com/webhook/...' },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '/assets/apps/slack.svg',
    description: 'Access Slack workspace files and channel data directly inside Arcellite.',
    category: 'Communication',
    iconBg: 'from-green-100 to-teal-50',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', placeholder: 'https://your-n8n.com/webhook/...' },
    ],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '/assets/apps/gmail.svg',
    description: 'Send automated emails via Gmail SMTP. Used by AI Task automation rules.',
    category: 'Communication',
    iconBg: 'from-red-100 to-orange-50',
    fields: [
      { key: 'smtpHost', label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com' },
      { key: 'smtpPort', label: 'SMTP Port', type: 'text', placeholder: '587' },
      { key: 'smtpUser', label: 'Gmail Address', type: 'text', placeholder: 'you@gmail.com' },
      { key: 'smtpPass', label: 'App Password', type: 'password', placeholder: 'Google App Password (not your Gmail password)' },
    ],
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    icon: '/assets/apps/postgresql.svg',
    description: 'Connect a local or remote PostgreSQL database to query and manage data from inside Arcellite.',
    category: 'Database',
    iconBg: 'from-blue-100 to-sky-50',
    fields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost' },
      { key: 'port', label: 'Port', type: 'text', placeholder: '5432' },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'mydb' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'postgres' },
      { key: 'password', label: 'Password', type: 'password', placeholder: 'your password' },
    ],
  },
];

const MCP_FIELDS: Field[] = [
  { key: 'name', label: 'Server Name', type: 'text', placeholder: 'My MCP Server' },
  { key: 'apiUrl', label: 'MCP Server URL', type: 'text', placeholder: 'https://your-mcp-server.com/mcp' },
  { key: 'apiKey', label: 'Bearer Token', type: 'password', placeholder: 'Your Bearer token' },
];

const CATEGORY_COLORS: Record<string, string> = {
  Communication: 'bg-indigo-50 text-indigo-600',
  AI: 'bg-purple-50 text-purple-600',
  Database: 'bg-blue-50 text-blue-600',
};

const STORAGE_KEY = 'connectAppsV2';
const MCP_INSTANCES_KEY = 'mcpInstances';

// ─── State helpers ────────────────────────────────────────────────────────────

function loadState(): AllConnectState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);

    // Migrate from old legacy system (connectedApps array)
    const oldRaw = localStorage.getItem('connectedApps');
    if (oldRaw) {
      const oldApps = JSON.parse(oldRaw);
      if (Array.isArray(oldApps)) {
        const migrated: AllConnectState = {};
        for (const app of oldApps) {
          if ((app.id === 'discord' || app.id === 'slack') && app.status === 'connected') {
            migrated[app.id] = {
              connected: true,
              fields: {
                channelsUrl: app.config?.channelsUrl ?? '',
                sendUrl: app.config?.sendUrl ?? '',
                webhookUrl: app.config?.webhookUrl ?? '',
              },
              statusMessage: app.statusMessage ?? 'Connected',
            };
          }
        }
        if (Object.keys(migrated).length > 0) return migrated;
      }
    }
  } catch {}
  return {};
}

function saveState(state: AllConnectState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadMcpInstances(): McpInstance[] {
  try {
    const raw = localStorage.getItem(MCP_INSTANCES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveMcpInstances(instances: McpInstance[]) {
  localStorage.setItem(MCP_INSTANCES_KEY, JSON.stringify(instances));
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

const Toggle: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${
      checked ? 'bg-[#5D5FEF]' : 'bg-gray-200 hover:bg-gray-300'
    }`}
  >
    <span
      className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
        checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
      }`}
    />
  </button>
);

// ─── Component ────────────────────────────────────────────────────────────────

const ConnectAppsSection: React.FC = () => {
  const [state, setState] = useState<AllConnectState>(loadState);
  const [mcpInstances, setMcpInstances] = useState<McpInstance[]>(loadMcpInstances);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formFields, setFormFields] = useState<Record<string, Record<string, string>>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  useEffect(() => {
    saveState(state);
    // Sync to backend so server-side features (e.g. AI Task email actions) can read connection state
    const token = localStorage.getItem('sessionToken');
    if (!token) return;
    fetch('/api/apps/connections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(state),
    }).catch(() => {});
  }, [state]);
  useEffect(() => { saveMcpInstances(mcpInstances); }, [mcpInstances]);

  // One-time sync of localStorage state to DB on mount (so existing connections are visible server-side)
  useEffect(() => {
    const initialState = loadState();
    if (Object.keys(initialState).length === 0) return;
    const token = localStorage.getItem('sessionToken');
    if (!token) return;
    fetch('/api/apps/connections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(initialState),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load connection state from database on mount (fills in apps connected before v3 migration)
  useEffect(() => {
    const loadFromDb = async () => {
      try {
        const token = localStorage.getItem('sessionToken');
        if (!token) return;
        const res = await fetch('/api/apps/connections', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.apps || !Array.isArray(data.apps)) return;
        const fromDb: AllConnectState = {};
        for (const app of data.apps) {
          if (app.status !== 'connected') continue;
          if (app.id === 'discord' && app.discordWebhooks) {
            fromDb['discord'] = {
              connected: true,
              fields: {
                channelsUrl: app.discordWebhooks.channelsUrl ?? '',
                sendUrl: app.discordWebhooks.sendUrl ?? '',
              },
              statusMessage: app.statusMessage ?? 'Discord connected',
            };
          } else if (app.id === 'slack' && app.webhookUrl) {
            fromDb['slack'] = {
              connected: true,
              fields: { webhookUrl: app.webhookUrl },
              statusMessage: app.statusMessage ?? 'Slack connected',
            };
          }
        }
        if (Object.keys(fromDb).length === 0) return;
        // Merge: localStorage entries take precedence over DB entries
        setState(prev => {
          const merged = { ...fromDb };
          for (const [k, v] of Object.entries(prev)) { merged[k] = v; }
          return merged;
        });
      } catch {}
    };
    loadFromDb();
  }, []);

  const openForm = (id: string) => {
    const saved = state[id]?.fields ?? {};
    setFormFields(p => ({ ...p, [id]: { ...saved } }));
    setExpanded(prev => prev === id ? null : id);
    setErrors(p => { const n = { ...p }; delete n[id]; return n; });
  };

  const setField = (id: string, key: string, value: string) => {
    setFormFields(p => ({ ...p, [id]: { ...(p[id] ?? {}), [key]: value } }));
  };

  const addMcpInstance = () => {
    const newId = `mcp_${Date.now()}`;
    setMcpInstances(prev => [...prev, { id: newId }]);
    setFormFields(p => ({ ...p, [newId]: {} }));
    setExpanded(newId);
  };

  const removeMcpInstance = (id: string) => {
    setMcpInstances(prev => prev.filter(m => m.id !== id));
    setState(p => { const n = { ...p }; delete n[id]; return n; });
    if (expanded === id) setExpanded(null);
  };

  const connectStatic = async (app: StaticApp) => {
    const fields = formFields[app.id] ?? {};
    setLoading(p => ({ ...p, [app.id]: true }));
    setErrors(p => { const n = { ...p }; delete n[app.id]; return n; });
    try {
      let statusMessage = 'Connected';

      if (app.id === 'discord') {
        const { channelsUrl, sendUrl } = fields;
        if (!channelsUrl || !sendUrl) throw new Error('Both webhook URLs are required');
        const res = await fetch('/api/apps/webhook-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl: channelsUrl }),
        });
        if (!res.ok) throw new Error('Could not reach channels webhook URL');
        statusMessage = 'Discord connected';

      } else if (app.id === 'slack') {
        const { webhookUrl } = fields;
        if (!webhookUrl) throw new Error('Webhook URL is required');
        const res = await fetch('/api/apps/webhook-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl }),
        });
        if (!res.ok) throw new Error('Could not reach webhook URL');
        statusMessage = 'Slack connected';

      } else if (app.id === 'postgresql') {
        const { host, port, database, username, password } = fields;
        if (!host || !database || !username) throw new Error('Host, database, and username are required');
        const res = await fetch('/api/apps/postgres-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host, port: port || '5432', database, username, password }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Connection failed: HTTP ${res.status}`);
        statusMessage = `Connected to ${database}`;
      }

      setState(p => ({ ...p, [app.id]: { connected: true, fields, statusMessage } }));
      setExpanded(null);
    } catch (e: any) {
      setErrors(p => ({ ...p, [app.id]: e.message || String(e) }));
    } finally {
      setLoading(p => ({ ...p, [app.id]: false }));
    }
  };

  const connectMcp = async (instanceId: string) => {
    const fields = formFields[instanceId] ?? {};
    const { name, apiUrl, apiKey } = fields;
    if (!name?.trim()) { setErrors(p => ({ ...p, [instanceId]: 'Server name is required' })); return; }
    if (!apiUrl || !apiKey) { setErrors(p => ({ ...p, [instanceId]: 'URL and Bearer token are required' })); return; }

    setLoading(p => ({ ...p, [instanceId]: true }));
    setErrors(p => { const n = { ...p }; delete n[instanceId]; return n; });
    try {
      const res = await fetch('/api/apps/n8n/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, apiKey, apiType: 'mcp' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setState(p => ({
        ...p,
        [instanceId]: { connected: true, fields, statusMessage: 'MCP server connected' },
      }));
      setExpanded(null);
    } catch (e: any) {
      setErrors(p => ({ ...p, [instanceId]: e.message || String(e) }));
    } finally {
      setLoading(p => ({ ...p, [instanceId]: false }));
    }
  };

  const disconnect = (id: string) => {
    setState(p => ({ ...p, [id]: { connected: false, fields: p[id]?.fields ?? {} } }));
    setExpanded(null);
  };

  // ─── Inline credential form ───────────────────────────────────────────────

  const renderForm = (id: string, fields: Field[], onConnect: () => void) => {
    const fieldValues = formFields[id] ?? {};
    const isLoading = loading[id];
    const err = errors[id];

    return (
      <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
        {fields.map(field => (
          <div key={field.key}>
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
              {field.label}
            </label>
            <div className="relative">
              <input
                type={field.type === 'password' && !showPassword[`${id}-${field.key}`] ? 'password' : 'text'}
                value={fieldValues[field.key] ?? ''}
                onChange={e => setField(id, field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#5D5FEF]/50 focus:ring-1 focus:ring-[#5D5FEF]/20 transition-all"
              />
              {field.type === 'password' && (
                <button
                  type="button"
                  onClick={() => setShowPassword(p => ({ ...p, [`${id}-${field.key}`]: !p[`${id}-${field.key}`] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  {showPassword[`${id}-${field.key}`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        ))}

        {err && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-600">{err}</p>
          </div>
        )}

        <button
          onClick={onConnect}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5D5FEF] text-white text-xs font-bold hover:bg-[#4B4DE0] transition-all disabled:opacity-50 active:scale-[0.98]"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
          {isLoading ? 'Connecting…' : 'Save & Connect'}
        </button>
      </div>
    );
  };

  // ─── Render static card ───────────────────────────────────────────────────

  const renderStaticCard = (app: StaticApp) => {
    const conn = state[app.id];
    const isConnected = conn?.connected ?? false;
    const isLoading = loading[app.id];
    const isExpanded = expanded === app.id;

    return (
      <div
        key={app.id}
        className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden"
      >
        <div className="p-5 flex-1 relative">
          {/* Logo — top right */}
          <div className="absolute top-4 right-4">
            <div className={`w-[52px] h-[52px] rounded-2xl bg-gradient-to-br ${app.iconBg} flex items-center justify-center border border-black/5 shadow-sm`}>
              <img src={app.icon} alt={app.name} className="w-8 h-8 object-contain" />
            </div>
          </div>

          {/* Name + category */}
          <div className="pr-16">
            <h3 className="text-[16px] font-black text-gray-900 leading-tight">{app.name}</h3>
            <span className={`inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[app.category] ?? 'bg-gray-100 text-gray-500'}`}>
              {app.category}
            </span>
          </div>

          {/* Description */}
          <p className="text-[12px] text-gray-500 leading-relaxed mt-3 line-clamp-2">{app.description}</p>

          {/* Status message */}
          {isConnected && conn?.statusMessage && (
            <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold text-green-700">
              <CheckCircle2 className="w-3 h-3" />
              {conn.statusMessage}
            </div>
          )}

          {/* Expanded credential form */}
          {isExpanded && renderForm(app.id, app.fields, () => connectStatic(app))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-50 flex items-center justify-between gap-3">
          <button
            onClick={() => openForm(app.id)}
            className="flex items-center gap-1 text-[12px] font-semibold text-gray-500 hover:text-[#5D5FEF] transition-colors"
          >
            {isExpanded ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Hide</>
            ) : (
              <>{isConnected ? 'Reconfigure' : 'View integration'} <ArrowRight className="w-3.5 h-3.5" /></>
            )}
          </button>

          <div className="flex items-center gap-3">
            {isConnected && (
              <button
                onClick={() => disconnect(app.id)}
                className="text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors"
              >
                Disconnect
              </button>
            )}
            <Toggle
              checked={isConnected}
              onChange={() => {
                if (isConnected) {
                  disconnect(app.id);
                } else {
                  openForm(app.id);
                }
              }}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>
    );
  };

  // ─── Render MCP card (toggle-only — credentials are configured in My Apps → MCP) ──

  const renderMcpCard = (instance: McpInstance, index: number) => {
    const { id } = instance;
    const conn = state[id];
    const isConnected = conn?.connected ?? false;
    const isLoading = loading[id];
    const fields = conn?.fields ?? {};
    const displayName = fields.name || `MCP Server ${index + 1}`;
    const iconPath = fields.icon || '/assets/apps/mcp.svg';
    const hasCredentials = !!(fields.apiUrl && fields.apiKey);

    return (
      <div
        key={id}
        className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden"
      >
        <div className="p-5 flex-1 relative">
          {/* Logo — top right */}
          <div className="absolute top-4 right-4">
            <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-purple-100 to-violet-50 flex items-center justify-center border border-black/5 shadow-sm overflow-hidden">
              <img src={iconPath} alt={displayName} className="w-8 h-8 object-contain" />
            </div>
          </div>

          {/* Name + category */}
          <div className="pr-16">
            <h3 className="text-[16px] font-black text-gray-900 leading-tight truncate">{displayName}</h3>
            <span className="inline-block mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
              AI
            </span>
          </div>

          {/* Description */}
          <p className="text-[12px] text-gray-500 leading-relaxed mt-3 line-clamp-2">
            {!hasCredentials
              ? 'Configure this server in My Apps → MCP before enabling.'
              : isConnected
                ? 'MCP server connected and ready.'
                : 'Toggle to connect and verify the MCP server.'}
          </p>

          {/* URL preview */}
          {fields.apiUrl && (
            <p className="text-[10px] text-gray-400 truncate mt-1.5">{fields.apiUrl}</p>
          )}

          {/* Status message */}
          {isConnected && conn?.statusMessage && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-[#5D5FEF]">
              <CheckCircle2 className="w-3 h-3" />
              {conn.statusMessage}
            </div>
          )}

          {/* Inline error */}
          {errors[id] && (
            <div className="mt-2 flex items-start gap-1.5 p-2 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-600">{errors[id]}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-50 flex items-center justify-end gap-3">
          {isConnected && (
            <button
              onClick={() => disconnect(id)}
              className="text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors"
            >
              Disconnect
            </button>
          )}
          <Toggle
            checked={isConnected}
            onChange={() => {
              if (isConnected) {
                disconnect(id);
              } else if (hasCredentials) {
                setFormFields(p => ({ ...p, [id]: { ...fields } }));
                connectMcp(id);
              }
            }}
            disabled={isLoading || !hasCredentials}
          />
        </div>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-300">
        {STATIC_APPS.map(renderStaticCard)}
        {mcpInstances.map((inst, i) => renderMcpCard(inst, i))}
      </div>

    </div>
  );
};

export default ConnectAppsSection;
