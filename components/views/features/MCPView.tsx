import React, { useState, useEffect } from 'react';
import {
  Plus, Eye, EyeOff, AlertCircle, CheckCircle2,
  Server, Pencil, Trash2, Loader2, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface McpInstance {
  id: string;
}

interface ConnectState {
  connected: boolean;
  fields: Record<string, string>;
  statusMessage?: string;
}

// ─── Icon catalogue ───────────────────────────────────────────────────────────

const ICON_CATALOGUE = [
  { slug: 'mcp',             path: '/assets/apps/mcp.svg' },
  { slug: 'n8n',             path: '/assets/apps/n8n.svg' },
  { slug: 'discord',         path: '/assets/apps/discord.svg' },
  { slug: 'slack',           path: '/assets/apps/slack.svg' },
  { slug: 'home-assistant',  path: '/assets/apps/home-assistant.svg' },
  { slug: 'ollama',          path: '/assets/apps/ollama.svg' },
  { slug: 'docker',          path: '/assets/apps/docker.svg' },
  { slug: 'portainer',       path: '/assets/apps/portainer.svg' },
  { slug: 'postgres',        path: '/assets/apps/postgresql.svg' },
  { slug: 'postgresql',      path: '/assets/apps/postgresql.svg' },
  { slug: 'mysql',           path: '/assets/apps/mysql.svg' },
  { slug: 'redis',           path: '/assets/apps/redis.svg' },
  { slug: 'minio',           path: '/assets/apps/minio.svg' },
  { slug: 'loki',            path: '/assets/apps/loki.svg' },
  { slug: 'keycloak',        path: '/assets/apps/keycloak.svg' },
  { slug: 'authelia',        path: '/assets/apps/authelia.svg' },
  { slug: 'cloudflare',      path: '/assets/apps/cloudflare.svg' },
  { slug: 'plex',            path: '/assets/apps/plex.svg' },
  { slug: 'watchtower',      path: '/assets/apps/watchtower.svg' },
  { slug: 'uptime-kuma',     path: '/assets/apps/uptime-kuma.svg' },
  { slug: 'azure',           path: '/assets/apps/azure.svg' },
  { slug: 'dropbox',         path: '/assets/apps/dropbox.svg' },
  { slug: 'google-drive',    path: '/assets/apps/google-drive.svg' },
  { slug: 'onedrive',        path: '/assets/apps/microsoft-onedrive.svg' },
  { slug: 'openclaw',        path: '/assets/apps/openclaw.svg' },
];

const UNIQUE_ICONS = ICON_CATALOGUE.filter(
  (ic, idx, arr) => arr.findIndex(x => x.path === ic.path) === idx
);

function suggestIcons(name: string): typeof ICON_CATALOGUE {
  if (!name.trim()) return [];
  const lower = name.toLowerCase();
  return ICON_CATALOGUE.filter(ic => lower.includes(ic.slug) || ic.slug.includes(lower.split(' ')[0]));
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'connectAppsV2';
const MCP_INSTANCES_KEY = 'mcpInstances';

function loadMcpInstances(): McpInstance[] {
  try { const r = localStorage.getItem(MCP_INSTANCES_KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}

function saveMcpInstances(instances: McpInstance[]) {
  localStorage.setItem(MCP_INSTANCES_KEY, JSON.stringify(instances));
}

function loadConnectState(): Record<string, ConnectState> {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch {}
  return {};
}

function saveConnectState(state: Record<string, ConnectState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

// ─── Add / Edit Form ──────────────────────────────────────────────────────────

interface FormData { name: string; apiUrl: string; apiKey: string; icon: string; }

interface SaveResult extends FormData {
  id?: string;
  connected: boolean;
  statusMessage: string;
}

interface ServerFormProps {
  initial?: FormData & { id?: string };
  onSave: (result: SaveResult) => void;
  onCancel: () => void;
}

const ServerForm: React.FC<ServerFormProps> = ({ initial, onSave, onCancel }) => {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<FormData>({
    name: initial?.name ?? '',
    apiUrl: initial?.apiUrl ?? '',
    apiKey: initial?.apiKey ?? '',
    icon: initial?.icon ?? '/assets/apps/mcp.svg',
  });
  const [showKey, setShowKey] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const suggestions = suggestIcons(form.name);
  const set = (k: keyof FormData, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleNameChange = (v: string) => {
    set('name', v);
    const matches = suggestIcons(v);
    if (matches.length === 1 && form.icon === '/assets/apps/mcp.svg') {
      set('icon', matches[0].path);
    }
  };

  const validate = () => {
    if (!form.name.trim()) { setError('Server name is required'); return false; }
    if (!form.apiUrl.trim()) { setError('MCP Server URL is required'); return false; }
    try { new URL(form.apiUrl); } catch { setError('Invalid URL format'); return false; }
    if (!form.apiKey.trim()) { setError('Bearer token is required'); return false; }
    return true;
  };

  const handleConnect = async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/apps/n8n/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl: form.apiUrl, apiKey: form.apiKey, apiType: 'mcp' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      // Connection verified — pass result up
      onSave({
        ...form,
        id: initial?.id,
        connected: true,
        statusMessage: `${form.name} connected`,
      });
    } catch (e: any) {
      setError(e.message || 'Connection failed. Check your URL and token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-sm font-black text-gray-900 mb-4">
        {isEdit ? 'Edit MCP Server' : 'Add MCP Server'}
      </h3>

      <div className="space-y-3">
        {/* Name + icon auto-suggest */}
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Server Name</label>
          <div className="relative">
            <input
              type="text"
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. n8n Home Lab"
              disabled={loading}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#5D5FEF]/50 focus:ring-1 focus:ring-[#5D5FEF]/20 transition-all pr-10 disabled:opacity-60"
            />
            <img
              src={form.icon}
              alt=""
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 object-contain cursor-pointer"
              onClick={() => !loading && setShowIconPicker(p => !p)}
            />
          </div>
          {suggestions.length > 0 && form.icon === '/assets/apps/mcp.svg' && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[9px] text-gray-400 self-center">Suggested icons:</span>
              {suggestions.map(ic => (
                <button
                  key={ic.path}
                  type="button"
                  onClick={() => set('icon', ic.path)}
                  className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center hover:border-[#5D5FEF]/40 hover:bg-[#5D5FEF]/5 transition-all"
                  title={ic.slug}
                >
                  <img src={ic.path} alt={ic.slug} className="w-4 h-4 object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Icon picker grid */}
        {showIconPicker && (
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Select Icon</p>
            <div className="grid grid-cols-8 gap-1.5">
              {UNIQUE_ICONS.map(ic => (
                <button
                  key={ic.path}
                  type="button"
                  onClick={() => { set('icon', ic.path); setShowIconPicker(false); }}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white hover:shadow-sm border ${
                    form.icon === ic.path ? 'border-[#5D5FEF] bg-[#5D5FEF]/5' : 'border-transparent'
                  }`}
                  title={ic.slug}
                >
                  <img src={ic.path} alt={ic.slug} className="w-5 h-5 object-contain" />
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowIconPicker(false)} className="mt-2 text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
              Close
            </button>
          </div>
        )}

        {/* URL */}
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">MCP Server URL</label>
          <input
            type="text"
            value={form.apiUrl}
            onChange={e => set('apiUrl', e.target.value)}
            placeholder="https://your-mcp-server.com/mcp"
            disabled={loading}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#5D5FEF]/50 focus:ring-1 focus:ring-[#5D5FEF]/20 transition-all disabled:opacity-60"
          />
        </div>

        {/* Bearer Token */}
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Bearer Token</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={e => set('apiKey', e.target.value)}
              placeholder="Your Bearer token"
              disabled={loading}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#5D5FEF]/50 focus:ring-1 focus:ring-[#5D5FEF]/20 transition-all pr-10 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowKey(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 border border-red-100 mt-3">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-red-600">{error}</p>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConnect}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5D5FEF] text-white text-xs font-bold hover:bg-[#4B4DE0] transition-all active:scale-95 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {loading ? 'Connecting…' : isEdit ? 'Test & Save' : 'Test & Connect'}
        </button>
      </div>
    </div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

const MCPView: React.FC = () => {
  const [instances, setInstances] = useState<McpInstance[]>(loadMcpInstances);
  const [connectState, setConnectState] = useState<Record<string, ConnectState>>(loadConnectState);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = React.useRef(0);

  // Sync from localStorage on mount and when storage changes (same as desktop / other tab)
  const syncFromStorage = React.useCallback(() => {
    setInstances(loadMcpInstances());
    setConnectState(loadConnectState());
  }, []);

  useEffect(() => { syncFromStorage(); }, [syncFromStorage]);
  useEffect(() => { saveMcpInstances(instances); }, [instances]);
  useEffect(() => { saveConnectState(connectState); }, [connectState]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === MCP_INSTANCES_KEY || e.key === STORAGE_KEY) syncFromStorage();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [syncFromStorage]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const handleAdd = (result: SaveResult) => {
    const id = `mcp_${Date.now()}`;
    setInstances(prev => [...prev, { id }]);
    setConnectState(prev => ({
      ...prev,
      [id]: {
        connected: result.connected,
        fields: { name: result.name, apiUrl: result.apiUrl, apiKey: result.apiKey, icon: result.icon },
        statusMessage: result.statusMessage,
      },
    }));
    setAdding(false);
    addToast('success', `${result.name} connected successfully`);
  };

  const handleEdit = (result: SaveResult) => {
    if (!result.id) return;
    setConnectState(prev => ({
      ...prev,
      [result.id!]: {
        connected: result.connected,
        fields: { name: result.name, apiUrl: result.apiUrl, apiKey: result.apiKey, icon: result.icon },
        statusMessage: result.statusMessage,
      },
    }));
    setEditing(null);
    addToast('success', `${result.name} updated and connected`);
  };

  const handleDelete = (id: string) => {
    setInstances(prev => prev.filter(i => i.id !== id));
    setConnectState(prev => { const n = { ...prev }; delete n[id]; return n; });
    setConfirmDelete(null);
    if (editing === id) setEditing(null);
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#5D5FEF]/5 border border-[#5D5FEF]/10">
        <div className="w-8 h-8 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Server className="w-4 h-4 text-[#5D5FEF]" />
        </div>
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <span className="font-black text-gray-800">MCP Servers</span> — Add and test your MCP / n8n connections here. Once connected, head to{' '}
          <span className="font-black text-gray-800">Connect</span> to toggle them on. The marketplace will install directly into your connected server.
        </p>
      </div>

      {/* Empty state */}
      {instances.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <img src="/assets/apps/mcp.svg" alt="MCP" className="w-8 h-8 object-contain opacity-40" />
          </div>
          <p className="text-sm font-bold text-gray-400 mb-1">No MCP servers yet</p>
          <p className="text-xs text-gray-400">Add your first server to get started.</p>
        </div>
      )}

      {/* Server cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {instances.map((inst, index) => {
          const conn = connectState[inst.id];
          const fields = conn?.fields ?? {};
          const isConnected = conn?.connected ?? false;
          const displayName = fields.name || `MCP Server ${index + 1}`;
          const iconPath = fields.icon || '/assets/apps/mcp.svg';
          const isEditing = editing === inst.id;
          const confirmingDelete = confirmDelete === inst.id;

          if (isEditing) {
            return (
              <div key={inst.id} className="lg:col-span-2">
                <ServerForm
                  initial={{ id: inst.id, name: fields.name || '', apiUrl: fields.apiUrl || '', apiKey: fields.apiKey || '', icon: iconPath }}
                  onSave={handleEdit}
                  onCancel={() => setEditing(null)}
                />
              </div>
            );
          }

          return (
            <div
              key={inst.id}
              className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 p-5"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-sm ${
                  isConnected ? 'bg-gradient-to-br from-green-100 to-emerald-50 border-green-200/50' : 'bg-gradient-to-br from-purple-100 to-violet-50 border-black/5'
                }`}>
                  <img src={iconPath} alt={displayName} className="w-7 h-7 object-contain" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-gray-900 truncate">{displayName}</h3>
                    {isConnected ? (
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Connected
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Not tested
                      </span>
                    )}
                  </div>
                  {fields.apiUrl && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{fields.apiUrl}</p>
                  )}
                  {isConnected && conn?.statusMessage && (
                    <p className="text-[10px] text-green-600 font-medium mt-0.5">{conn.statusMessage}</p>
                  )}
                </div>

                {/* Edit / Delete */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditing(inst.id); setConfirmDelete(null); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#5D5FEF] hover:bg-[#5D5FEF]/5 transition-all"
                    title="Edit & re-test"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(confirmingDelete ? null : inst.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Delete confirmation */}
              {confirmingDelete && (
                <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-[11px] font-bold text-red-700 mb-2">Remove "{displayName}"?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(null)} className="flex-1 py-1.5 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-600 hover:bg-gray-50 transition-all">Cancel</button>
                    <button onClick={() => handleDelete(inst.id)} className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-[11px] font-bold hover:bg-red-600 transition-all">Remove</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add form or button */}
      {adding ? (
        <ServerForm onSave={handleAdd} onCancel={() => setAdding(false)} />
      ) : (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => { setAdding(true); setEditing(null); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-[#5D5FEF]/30 text-[#5D5FEF] text-xs font-bold hover:border-[#5D5FEF]/60 hover:bg-[#5D5FEF]/5 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Add MCP Server
          </button>
        </div>
      )}

      {/* Bottom toasts */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-bold animate-in slide-in-from-bottom-4 fade-in duration-300 pointer-events-auto ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MCPView;
