import React, { useState, useEffect, useCallback } from 'react';
import {
  ListTodo, ScrollText, Zap, Clock, Trash2, ToggleLeft, ToggleRight,
  RefreshCw, CheckCircle2, XCircle, Loader2,
  Mail, Hash, Globe, Bell, Calendar, HardDrive, Cpu, Upload,
  MessageSquare, ChevronRight, Sparkles, AtSign, Check, Info, Lock, Database, Pencil, X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AutomationRule {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  enforcement_status: 'active' | 'disabled_due_to_plan' | 'disabled_due_to_billing';
  trigger_type: string;
  trigger_config: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
  trigger_description: string;
  action_description: string;
  last_triggered?: string;
  created_at: string;
}

interface ExecutionLog {
  id: number;
  rule_id: number;
  rule_name: string;
  status: 'success' | 'failed';
  trigger_value?: Record<string, any>;
  attempt_count: number;
  error_message?: string;
  created_at: string;
}

interface IntegrationAccount {
  id: string;
  name: string;
  user: string;
  icon: string;
}

interface EmailConfig {
  integrationAccounts: IntegrationAccount[];
  activeId: string | null;
  customFrom: string;
}

// ── Color palettes (inline styles — safe from Tailwind purging) ────────────────

const TRIGGER_PALETTE: Record<string, { main: string; light: string; dark: string }> = {
  storage_threshold: { main: '#3B82F6', light: '#EFF6FF', dark: '#1D4ED8' },
  cpu_threshold:     { main: '#F97316', light: '#FFF7ED', dark: '#C2410C' },
  file_upload:       { main: '#8B5CF6', light: '#F5F3FF', dark: '#6D28D9' },
  scheduled:         { main: '#6366F1', light: '#EEF2FF', dark: '#4338CA' },
  database_query:    { main: '#0D9488', light: '#F0FDFA', dark: '#0F766E' },
};

const ACTION_PALETTE: Record<string, { main: string; light: string; dark: string }> = {
  email:           { main: '#10B981', light: '#ECFDF5', dark: '#059669' },
  discord:         { main: '#7C3AED', light: '#EDE9FE', dark: '#6D28D9' },
  webhook:         { main: '#0EA5E9', light: '#F0F9FF', dark: '#0284C7' },
  dashboard_alert: { main: '#F59E0B', light: '#FFFBEB', dark: '#D97706' },
};

const DEFAULT_TRIGGER = { main: '#6B7280', light: '#F9FAFB', dark: '#374151' };
const DEFAULT_ACTION  = { main: '#10B981', light: '#ECFDF5', dark: '#059669' };
const WARNING_COLORS  = { main: '#F97316', light: '#FFF7ED', dark: '#C2410C' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader() {
  const token = localStorage.getItem('sessionToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function apiFetch(path: string, options: RequestInit = {}) {
  return fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(options.headers ?? {}) },
  });
}

function triggerIcon(type: string) {
  switch (type) {
    case 'storage_threshold': return <HardDrive className="w-4 h-4" />;
    case 'cpu_threshold':     return <Cpu className="w-4 h-4" />;
    case 'file_upload':       return <Upload className="w-4 h-4" />;
    case 'scheduled':         return <Calendar className="w-4 h-4" />;
    case 'database_query':    return <Database className="w-4 h-4" />;
    default:                  return <Zap className="w-4 h-4" />;
  }
}

function actionIcon(type: string) {
  switch (type) {
    case 'email':           return <Mail className="w-4 h-4" />;
    case 'discord':         return <Hash className="w-4 h-4" />;
    case 'webhook':         return <Globe className="w-4 h-4" />;
    case 'dashboard_alert': return <Bell className="w-4 h-4" />;
    default:                return <Zap className="w-4 h-4" />;
  }
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function describeCondition(type: string, cfg: Record<string, any>): string {
  switch (type) {
    case 'storage_threshold': return `IF storage used ≥ ${cfg.threshold ?? 90}%`;
    case 'cpu_threshold':
      return `IF CPU load ≥ ${cfg.threshold ?? 80}%${cfg.duration_minutes ? ` for ${cfg.duration_minutes}min` : ''}`;
    case 'file_upload': {
      const types = cfg.file_types?.length ? cfg.file_types.join(', ') : 'any type';
      const size = cfg.min_size_mb ? ` ≥ ${cfg.min_size_mb}MB` : '';
      return `IF file uploaded (${types}${size})`;
    }
    case 'scheduled':
      return `IF schedule: ${cfg.cron ?? '* * * * *'}`;
    case 'database_query': {
      const q = (cfg.query ?? '').trim();
      return `IF query returns rows: ${q.length > 55 ? q.slice(0, 55) + '…' : q || '(no query)'}`;
    }
    default: return `IF ${type}`;
  }
}

function describeEffect(type: string, cfg: Record<string, any>): string {
  switch (type) {
    case 'email':
      return `THEN email → ${cfg.to?.trim() || '(no recipient — click edit to set)'}`;
    case 'discord':
      return `THEN Discord → ${cfg.channel?.trim() ? `#${cfg.channel.trim()}` : cfg.webhook_url?.trim() ? 'webhook' : '(no channel — click edit to set)'}`;
    case 'webhook':
      return `THEN ${cfg.method || 'POST'} → ${cfg.url?.trim() || '(no URL — click edit to set)'}`;
    case 'dashboard_alert':
      return `THEN alert: "${cfg.title || 'Notification'}"`;
    default: return `THEN ${type}`;
  }
}

// ── Edit form field helpers ───────────────────────────────────────────────────

const FieldLabel: React.FC<{ label: string; hint?: string }> = ({ label, hint }) => (
  <div className="mb-1.5">
    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">{label}</label>
    {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
  </div>
);

const TextInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; type?: string }> = ({ value, onChange, placeholder, type = 'text' }) => (
  <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#5D5FEF] focus:ring-1 focus:ring-[#5D5FEF]/30 transition-all bg-white" />
);

const NumberInput: React.FC<{ value: number | string; onChange: (v: number) => void; placeholder?: string; min?: number; max?: number }> = ({ value, onChange, placeholder, min, max }) => (
  <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} placeholder={placeholder} min={min} max={max}
    className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#5D5FEF] focus:ring-1 focus:ring-[#5D5FEF]/30 transition-all bg-white" />
);

const TextareaInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }> = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#5D5FEF] focus:ring-1 focus:ring-[#5D5FEF]/30 transition-all bg-white resize-none font-mono" />
);

const SelectInput: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ value, onChange, options }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}
    className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#5D5FEF] focus:ring-1 focus:ring-[#5D5FEF]/30 transition-all bg-white">
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

// ── Trigger / Action edit fields ──────────────────────────────────────────────

const TriggerEditFields: React.FC<{ type: string; config: Record<string, any>; onChange: (cfg: Record<string, any>) => void }> = ({ type, config, onChange }) => {
  const set = (key: string, value: any) => onChange({ ...config, [key]: value });
  switch (type) {
    case 'storage_threshold':
      return (
        <div>
          <FieldLabel label="Storage threshold (%)" hint="Trigger when storage used is at or above this value" />
          <NumberInput value={config.threshold ?? 90} onChange={(v) => set('threshold', v)} min={1} max={100} />
        </div>
      );
    case 'cpu_threshold':
      return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel label="CPU threshold (%)" />
            <NumberInput value={config.threshold ?? 80} onChange={(v) => set('threshold', v)} min={1} max={100} />
          </div>
          <div>
            <FieldLabel label="Duration (minutes)" hint="Optional" />
            <NumberInput value={config.duration_minutes ?? ''} onChange={(v) => set('duration_minutes', v)} min={0} />
          </div>
        </div>
      );
    case 'file_upload':
      return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel label="File types" hint="Comma-separated (empty = any)" />
            <TextInput value={(config.file_types ?? []).join(', ')} onChange={(v) => set('file_types', v.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="jpg, png, pdf" />
          </div>
          <div>
            <FieldLabel label="Min size (MB)" hint="0 = any size" />
            <NumberInput value={config.min_size_mb ?? 0} onChange={(v) => set('min_size_mb', v)} min={0} />
          </div>
        </div>
      );
    case 'scheduled':
      return (
        <div>
          <FieldLabel label="Cron schedule" hint='5-field: min hour day month weekday. Example: "0 9 * * 1" = Monday 9am' />
          <TextInput value={config.cron ?? ''} onChange={(v) => set('cron', v)} placeholder="0 9 * * 1" />
        </div>
      );
    case 'database_query':
      return (
        <div className="space-y-3">
          <div>
            <FieldLabel label="Database ID" hint="ID of the database to query" />
            <TextInput value={config.database_id ?? ''} onChange={(v) => set('database_id', v)} placeholder="database-id" />
          </div>
          <div>
            <FieldLabel label="SQL Query" hint="Rule fires when query returns 1+ rows. Put your condition in the WHERE clause." />
            <TextareaInput value={config.query ?? ''} onChange={(v) => set('query', v)} placeholder="SELECT * FROM products WHERE quantity < reorder_threshold" rows={3} />
          </div>
          <div>
            <FieldLabel label="Debounce (minutes)" hint="Minimum time between firings" />
            <NumberInput value={config.debounce_minutes ?? 5} onChange={(v) => set('debounce_minutes', v)} min={1} />
          </div>
        </div>
      );
    default:
      return <p className="text-[12px] text-gray-400">No editable fields for this trigger type.</p>;
  }
};

const ActionEditFields: React.FC<{ type: string; config: Record<string, any>; onChange: (cfg: Record<string, any>) => void }> = ({ type, config, onChange }) => {
  const set = (key: string, value: any) => onChange({ ...config, [key]: value });
  switch (type) {
    case 'email':
      return (
        <div className="space-y-3">
          <div>
            <FieldLabel label="To (recipient email)" />
            <TextInput value={config.to ?? ''} onChange={(v) => set('to', v)} placeholder="you@example.com" type="email" />
          </div>
          <div>
            <FieldLabel label="Subject" />
            <TextInput value={config.subject ?? ''} onChange={(v) => set('subject', v)} placeholder="Arcellite Alert" />
          </div>
          <div>
            <FieldLabel label="Body" hint="Use {{field_name}} to insert trigger data. Leave blank for auto-generated." />
            <TextareaInput value={config.body ?? ''} onChange={(v) => set('body', v)} placeholder="Storage is at {{storage_percent}}%" rows={3} />
          </div>
        </div>
      );
    case 'discord':
      return (
        <div className="space-y-3">
          <div>
            <FieldLabel label="Discord Channel" hint="Use a channel name from your connected Discord (e.g. alerts, general)" />
            <TextInput value={config.channel ?? ''} onChange={(v) => set('channel', v)} placeholder="alerts" />
          </div>
          <div>
            <FieldLabel label="Message" hint="Use {{field_name}} to insert trigger data" />
            <TextareaInput value={config.message ?? ''} onChange={(v) => set('message', v)} placeholder="Alert: rule triggered" rows={2} />
          </div>
        </div>
      );
    case 'webhook':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <FieldLabel label="URL" />
              <TextInput value={config.url ?? ''} onChange={(v) => set('url', v)} placeholder="https://your-api.com/webhook" />
            </div>
            <div>
              <FieldLabel label="Method" />
              <SelectInput value={config.method ?? 'POST'} onChange={(v) => set('method', v)} options={[{ value: 'POST', label: 'POST' }, { value: 'GET', label: 'GET' }]} />
            </div>
          </div>
          <div>
            <FieldLabel label="Body (JSON)" hint="Leave empty for default payload" />
            <TextareaInput value={config.body ?? ''} onChange={(v) => set('body', v)} placeholder='{"event": "alert", "value": "{{storage_percent}}"}' rows={3} />
          </div>
        </div>
      );
    case 'dashboard_alert':
      return (
        <div className="space-y-3">
          <div>
            <FieldLabel label="Title" />
            <TextInput value={config.title ?? ''} onChange={(v) => set('title', v)} placeholder="Storage Alert" />
          </div>
          <div>
            <FieldLabel label="Message" hint="Use {{field_name}} to insert trigger data" />
            <TextareaInput value={config.message ?? ''} onChange={(v) => set('message', v)} placeholder="Storage is at {{storage_percent}}%" rows={2} />
          </div>
          <div>
            <FieldLabel label="Severity" />
            <SelectInput value={config.severity ?? 'info'} onChange={(v) => set('severity', v)} options={[{ value: 'info', label: 'Info' }, { value: 'warning', label: 'Warning' }, { value: 'error', label: 'Error' }]} />
          </div>
        </div>
      );
    default:
      return <p className="text-[12px] text-gray-400">No editable fields for this action type.</p>;
  }
};

// ── Main component ─────────────────────────────────────────────────────────────

interface MyTasksViewProps {
  showToast?: (msg: string, type?: string) => void;
  onOpenChat?: () => void;
}

type TabId = 'active' | 'logs' | 'email';

const MyTasksView: React.FC<MyTasksViewProps> = ({ showToast, onOpenChat }) => {
  const [activeTab, setActiveTab] = useState<TabId>('active');

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editTriggerConfig, setEditTriggerConfig] = useState<Record<string, any>>({});
  const [editActionConfig, setEditActionConfig] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);

  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [customFrom, setCustomFrom] = useState('');

  // ── Data fetching ──

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const r = await apiFetch('/api/tasks/rules');
      const data = await r.json();
      if (data.ok) setRules(data.rules);
    } catch {}
    setRulesLoading(false);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const r = await apiFetch('/api/tasks/logs');
      const data = await r.json();
      if (data.ok) setLogs(data.logs);
    } catch {}
    setLogsLoading(false);
  }, []);

  const fetchEmailConfig = useCallback(async () => {
    setEmailLoading(true);
    try {
      const r = await apiFetch('/api/tasks/email-config');
      const data = await r.json();
      if (data.ok) { setEmailConfig(data); setCustomFrom(data.customFrom ?? ''); }
    } catch {}
    setEmailLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);
  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
    if (activeTab === 'email') fetchEmailConfig();
  }, [activeTab, fetchLogs, fetchEmailConfig]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleToggle = async (rule: AutomationRule) => {
    setTogglingId(rule.id);
    try {
      const r = await apiFetch(`/api/tasks/rules/${rule.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !rule.is_active }) });
      const data = await r.json();
      if (data.ok) setRules((prev) => prev.map((ru) => ru.id === rule.id ? { ...ru, is_active: !ru.is_active } : ru));
    } catch {}
    setTogglingId(null);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const r = await apiFetch(`/api/tasks/rules/${id}`, { method: 'DELETE' });
      if (r.ok) { setRules((prev) => prev.filter((ru) => ru.id !== id)); if (editingId === id) setEditingId(null); showToast?.('Rule deleted', 'success'); }
    } catch {}
    setDeletingId(null);
  };

  const startEdit = (rule: AutomationRule) => {
    setEditingId(rule.id);
    setEditName(rule.name);
    setEditTriggerConfig({ ...rule.trigger_config });
    setEditActionConfig({ ...rule.action_config });
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveRule = async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const r = await apiFetch(`/api/tasks/rules/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName.trim(), trigger_config: editTriggerConfig, action_config: editActionConfig }),
      });
      const data = await r.json();
      if (data.ok) { setRules((prev) => prev.map((ru) => ru.id === editingId ? { ...ru, ...data.rule } : ru)); setEditingId(null); showToast?.('Rule saved', 'success'); }
      else showToast?.(data.error || 'Failed to save', 'error');
    } catch { showToast?.('Failed to save', 'error'); }
    setEditSaving(false);
  };

  const handleClearLogs = async () => {
    setClearingLogs(true);
    try { await apiFetch('/api/tasks/logs', { method: 'DELETE' }); setLogs([]); showToast?.('Logs cleared', 'success'); } catch {}
    setClearingLogs(false);
  };

  const handleSelectAccount = async (id: string) => {
    const newId = emailConfig?.activeId === id ? null : id;
    setEmailSaving(true);
    try {
      const r = await apiFetch('/api/tasks/email-config', { method: 'PUT', body: JSON.stringify({ activeId: newId, customFrom: emailConfig?.customFrom ?? '' }) });
      const data = await r.json();
      if (data.ok) setEmailConfig((prev) => prev ? { ...prev, activeId: newId } : prev);
    } catch {}
    setEmailSaving(false);
  };

  const handleSaveFrom = async () => {
    setEmailSaving(true);
    try {
      const r = await apiFetch('/api/tasks/email-config', { method: 'PUT', body: JSON.stringify({ activeId: emailConfig?.activeId ?? null, customFrom }) });
      const data = await r.json();
      if (data.ok) { setEmailConfig((prev) => prev ? { ...prev, customFrom } : prev); showToast?.('From address saved', 'success'); }
      else showToast?.(data.error || 'Failed to save', 'error');
    } catch { showToast?.('Failed to save', 'error'); }
    setEmailSaving(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="py-2">
      {/* Header */}
      <div className="mb-6 md:mb-8 pb-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 md:h-10 bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full flex-shrink-0" />
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 tracking-tight">My Tasks</h1>
            <p className="text-sm text-gray-500 mt-0.5">AI-powered automation rules for your infrastructure</p>
          </div>
        </div>
      </div>

      {/* Create via AI Chat banner */}
      <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-[#5D5FEF]/10 to-[#5D5FEF]/5 border border-[#5D5FEF]/20">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#5D5FEF]/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-[#5D5FEF]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-gray-900">Create automation tasks with AI</p>
            <p className="text-[13px] text-gray-600 mt-1 mb-3">Ask Arcellite AI to set up an automation for you. It will create the rule and you'll see it below.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1.5 bg-white border border-[#5D5FEF]/20 text-[#5D5FEF] text-[11px] font-semibold rounded-lg">"Email me when storage hits 90%"</span>
              <span className="px-3 py-1.5 bg-white border border-[#5D5FEF]/20 text-[#5D5FEF] text-[11px] font-semibold rounded-lg">"Alert me when CPU is above 80% for 5 minutes"</span>
            </div>
            <button type="button" onClick={() => onOpenChat?.()} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#5D5FEF] text-white rounded-xl text-[13px] font-semibold hover:bg-[#4D4FCF] transition-all shadow-sm shadow-[#5D5FEF]/20">
              <MessageSquare className="w-4 h-4" />Open AI Chat<ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { id: 'active', icon: ListTodo, label: 'Active Tasks' },
          { id: 'logs', icon: ScrollText, label: 'Execution Logs' },
          { id: 'email', icon: AtSign, label: 'Email Settings' },
        ] as { id: TabId; icon: any; label: string }[]).map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab === id ? 'bg-white text-[#5D5FEF] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" />{label}
            {id === 'active' && rules.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-[#5D5FEF]/10 text-[#5D5FEF] text-[10px] font-bold rounded-md">
                {rules.filter((r) => r.is_active).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Active Tasks ── */}
      {activeTab === 'active' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-bold text-gray-700">{rules.filter((r) => r.is_active).length} active · {rules.length} total</p>
            <button onClick={fetchRules} disabled={rulesLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-[12px] font-semibold rounded-lg hover:bg-gray-200 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${rulesLoading ? 'animate-spin' : ''}`} />Refresh
            </button>
          </div>

          {rulesLoading && rules.length === 0 ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
              <ListTodo className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-[14px] font-bold text-gray-500">No automation rules yet</p>
              <p className="text-[12px] text-gray-400 mt-1">Ask Arcellite AI to create one for you</p>
              <button onClick={() => onOpenChat?.()} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#5D5FEF] text-white text-[13px] font-semibold rounded-xl hover:bg-[#4D4FCF] transition-colors">
                <MessageSquare className="w-4 h-4" />Open AI Chat
              </button>
            </div>
          ) : (
            <>
              {rules.some((r) => r.enforcement_status !== 'active') && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-3">
                  <Lock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-amber-800">Some rules are locked due to your plan</p>
                    <p className="text-[12px] text-amber-700 mt-0.5">
                      Rules exceeding your current limit are paused — no data is lost.{' '}
                      <a href="https://www.arcellite.com/pricing" target="_blank" rel="noopener noreferrer" className="font-bold underline">Upgrade to re-activate</a>
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {rules.map((rule) => {
                  const isLocked = rule.enforcement_status !== 'active';
                  const isEditing = editingId === rule.id;
                  const tc = isLocked ? { main: '#F59E0B', light: '#FFFBEB', dark: '#D97706' } : (TRIGGER_PALETTE[rule.trigger_type] ?? DEFAULT_TRIGGER);
                  const hasWarning = (rule.action_type === 'email' && !rule.action_config.to?.trim())
                    || (rule.action_type === 'discord' && !rule.action_config.channel?.trim() && !rule.action_config.webhook_url?.trim())
                    || (rule.action_type === 'webhook' && !rule.action_config.url?.trim());
                  const ac = hasWarning ? WARNING_COLORS : (ACTION_PALETTE[rule.action_type] ?? DEFAULT_ACTION);
                  const condition = describeCondition(rule.trigger_type, rule.trigger_config);
                  const effect = describeEffect(rule.action_type, rule.action_config);

                  return (
                    <div key={rule.id}
                      className={`rounded-2xl overflow-hidden transition-all ${
                        isEditing
                          ? 'shadow-[0_0_0_2px_#5D5FEF,0_8px_32px_rgba(93,95,239,0.15)]'
                          : rule.is_active && !isLocked
                          ? 'shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)]'
                          : 'shadow-sm opacity-70'
                      }`}
                    >
                      {/* Card with left accent strip */}
                      <div className="flex">
                        {/* Left accent */}
                        <div style={{ width: '5px', flexShrink: 0, backgroundColor: tc.main }} />

                        {/* Card body */}
                        <div className="flex-1 bg-white">
                          <div className="p-4">
                            {/* Top row: icon bubble + name + controls */}
                            <div className="flex items-start gap-3">
                              {/* Trigger type icon bubble */}
                              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: tc.light, color: tc.main }}>
                                {triggerIcon(rule.trigger_type)}
                              </div>

                              {/* Name + meta */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[15px] font-bold text-gray-900 leading-tight">{rule.name}</p>
                                  {isLocked && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-600">
                                      <Lock className="w-2.5 h-2.5" />Locked
                                    </span>
                                  )}
                                  {hasWarning && !isEditing && !isLocked && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-orange-100 text-orange-600 uppercase tracking-wider">
                                      Needs Setup
                                    </span>
                                  )}
                                </div>
                                {rule.last_triggered ? (
                                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />Last fired {relativeTime(rule.last_triggered)}
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-gray-400 mt-0.5">Never triggered</p>
                                )}
                              </div>

                              {/* Controls */}
                              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                                {!isLocked && (
                                  <>
                                    {/* Toggle */}
                                    <button onClick={() => handleToggle(rule)} disabled={togglingId === rule.id || isEditing}
                                      className={`transition-colors ${togglingId === rule.id ? 'opacity-40' : ''}`}
                                      aria-label={rule.is_active ? 'Deactivate' : 'Activate'}>
                                      {rule.is_active
                                        ? <ToggleRight className="w-7 h-7 text-[#5D5FEF]" />
                                        : <ToggleLeft className="w-7 h-7 text-gray-300" />}
                                    </button>
                                    {/* Edit */}
                                    <button onClick={() => isEditing ? cancelEdit() : startEdit(rule)}
                                      className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]' : 'text-gray-400 hover:text-[#5D5FEF] hover:bg-[#5D5FEF]/10'}`}
                                      aria-label={isEditing ? 'Close editor' : 'Edit rule'}>
                                      {isEditing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                                    </button>
                                  </>
                                )}
                                {/* Delete */}
                                <button onClick={() => handleDelete(rule.id)} disabled={deletingId === rule.id}
                                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  aria-label="Delete rule">
                                  {deletingId === rule.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            {/* IF / THEN condition block */}
                            <div className="mt-3 rounded-xl overflow-hidden border border-gray-100">
                              {/* IF row */}
                              <div className="flex items-start gap-2 px-3 py-2.5" style={{ backgroundColor: tc.light, borderBottom: '1px solid #F3F4F6' }}>
                                <span style={{ color: tc.main, flexShrink: 0, marginTop: '1px' }}>{triggerIcon(rule.trigger_type)}</span>
                                <span className="text-[12px] font-mono leading-snug break-all" style={{ color: tc.dark }}>{condition}</span>
                              </div>
                              {/* THEN row */}
                              <div className="flex items-start gap-2 px-3 py-2.5" style={{ backgroundColor: ac.light }}>
                                <span style={{ color: ac.main, flexShrink: 0, marginTop: '1px' }}>{actionIcon(rule.action_type)}</span>
                                <span className="text-[12px] font-mono leading-snug break-all" style={{ color: ac.dark }}>{effect}</span>
                              </div>
                            </div>
                          </div>

                          {/* ── Inline edit panel ── */}
                          {isEditing && (
                            <div className="border-t border-gray-100 bg-gray-50/70 p-4 space-y-5">
                              {/* Name */}
                              <div>
                                <FieldLabel label="Rule name" />
                                <TextInput value={editName} onChange={setEditName} placeholder="My automation rule" />
                              </div>

                              {/* Trigger fields */}
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: tc.light, color: tc.main }}>{triggerIcon(rule.trigger_type)}</div>
                                  <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Trigger Condition</p>
                                  <span className="text-[10px] text-gray-400 font-mono bg-gray-200 px-1.5 py-0.5 rounded">{rule.trigger_type}</span>
                                </div>
                                <TriggerEditFields type={rule.trigger_type} config={editTriggerConfig} onChange={setEditTriggerConfig} />
                              </div>

                              <div className="border-t border-dashed border-gray-200" />

                              {/* Action fields */}
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: ac.light, color: ac.main }}>{actionIcon(rule.action_type)}</div>
                                  <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Action</p>
                                  <span className="text-[10px] text-gray-400 font-mono bg-gray-200 px-1.5 py-0.5 rounded">{rule.action_type}</span>
                                </div>
                                <ActionEditFields type={rule.action_type} config={editActionConfig} onChange={setEditActionConfig} />
                              </div>

                              {/* Save/Cancel */}
                              <div className="flex gap-2 pt-1">
                                <button onClick={handleSaveRule} disabled={editSaving || !editName.trim()}
                                  className="flex items-center gap-2 px-4 py-2 bg-[#5D5FEF] text-white rounded-xl text-[13px] font-semibold hover:bg-[#4D4FCF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save Changes
                                </button>
                                <button onClick={cancelEdit} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-[13px] font-semibold hover:bg-gray-50 transition-colors">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Execution Logs ── */}
      {activeTab === 'logs' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-bold text-gray-700">{logs.length} execution{logs.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <button onClick={fetchLogs} disabled={logsLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-[12px] font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />Refresh
              </button>
              {logs.length > 0 && (
                <button onClick={handleClearLogs} disabled={clearingLogs} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 text-[12px] font-semibold rounded-lg hover:bg-red-100 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />Clear
                </button>
              )}
            </div>
          </div>

          {logsLoading && logs.length === 0 ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
              <ScrollText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-[14px] font-bold text-gray-500">No executions yet</p>
              <p className="text-[12px] text-gray-400 mt-1">Logs appear here when rules are triggered</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Rule</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Trigger Value</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          {log.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{log.rule_name ?? `Rule #${log.rule_id}`}</p>
                          {log.error_message && <p className="text-[11px] text-red-500 mt-0.5">{log.error_message}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-[12px] font-mono">
                          {log.trigger_value ? Object.entries(log.trigger_value).filter(([k]) => k !== 'rows').map(([k, v]) => `${k}: ${v}`).join(', ') : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{relativeTime(log.created_at)}</td>
                        <td className="px-4 py-3 text-gray-500 text-center">{log.attempt_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Email Settings ── */}
      {activeTab === 'email' && (
        <div className="space-y-5">
          {emailLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
          ) : (
            <>
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-blue-700">
                  Choose which connected email account sends automation emails. Connect Gmail in{' '}
                  <span className="font-bold">Integration</span> first. Set the recipient on each rule card using the <strong>pencil</strong> icon.
                </p>
              </div>

              {(emailConfig?.integrationAccounts.length ?? 0) === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-200">
                  <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-[14px] font-bold text-gray-500">No email accounts connected</p>
                  <p className="text-[12px] text-gray-400 mt-1 max-w-xs mx-auto">Go to <span className="font-semibold">Integration</span> and connect your Gmail account first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {emailConfig!.integrationAccounts.map((acc) => {
                    const isActive = emailConfig?.activeId === acc.id;
                    return (
                      <div key={acc.id} onClick={() => !emailSaving && handleSelectAccount(acc.id)}
                        className={`flex items-center gap-4 p-4 bg-white rounded-2xl border-2 cursor-pointer transition-all ${isActive ? 'border-[#5D5FEF] shadow-sm shadow-[#5D5FEF]/10' : 'border-gray-200 hover:border-gray-300'} ${emailSaving ? 'opacity-60 pointer-events-none' : ''}`}>
                        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 flex items-center justify-center">
                          {acc.icon === 'gmail' ? <img src="/assets/apps/gmail.svg" alt="Gmail" className="w-6 h-6 object-contain" /> : <Mail className="w-5 h-5 text-gray-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-gray-900">{acc.name}</p>
                          <p className="text-[12px] text-gray-500 mt-0.5 truncate">{acc.user}</p>
                        </div>
                        {isActive
                          ? <div className="w-6 h-6 rounded-full bg-[#5D5FEF] flex items-center justify-center flex-shrink-0"><Check className="w-3.5 h-3.5 text-white" /></div>
                          : <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {emailConfig?.activeId && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <label className="block text-[13px] font-bold text-gray-800 mb-1">From address <span className="text-gray-400 font-normal">(optional)</span></label>
                  <p className="text-[12px] text-gray-500 mb-3">Customize the sender name shown to recipients. Leave blank to use the connected email address.</p>
                  <div className="flex gap-2">
                    <input type="text" placeholder='e.g. Arcellite AI <assistant@yourco.com>' value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                      className="flex-1 px-3 py-2.5 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 transition-all" />
                    <button onClick={handleSaveFrom} disabled={emailSaving || customFrom === (emailConfig?.customFrom ?? '')}
                      className="px-4 py-2.5 bg-[#5D5FEF] text-white rounded-xl text-[13px] font-semibold hover:bg-[#4D4FCF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                      {emailSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MyTasksView;
