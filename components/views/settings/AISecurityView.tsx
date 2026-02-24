import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  FileEdit,
  FolderPlus,
  Trash2,
  RotateCcw,
  Database,
  Mail,
  FolderTree,
  Eye,
  MonitorPlay,
  Loader2,
  Lock,
  Unlock,
  Bot,
  ShieldOff,
  RefreshCw,
} from 'lucide-react';
import { authApi } from '@/services/api.client';

export interface AIPermissions {
  aiFileCreate: boolean;
  aiFileModify: boolean;
  aiFileDelete: boolean;
  aiFolderCreate: boolean;
  aiFileOrganize: boolean;
  aiTrashAccess: boolean;
  aiTrashRestore: boolean;
  aiTrashEmpty: boolean;
  aiDatabaseCreate: boolean;
  aiDatabaseDelete: boolean;
  aiDatabaseQuery: boolean;
  aiSendEmail: boolean;
  aiCastMedia: boolean;
  aiFileRead: boolean;
}

const DEFAULT_PERMISSIONS: AIPermissions = {
  aiFileCreate: true,
  aiFileModify: true,
  aiFileDelete: true,
  aiFolderCreate: true,
  aiFileOrganize: true,
  aiTrashAccess: true,
  aiTrashRestore: true,
  aiTrashEmpty: false,
  aiDatabaseCreate: true,
  aiDatabaseDelete: false,
  aiDatabaseQuery: true,
  aiSendEmail: true,
  aiCastMedia: true,
  aiFileRead: true,
};

interface PermissionRowProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onChange: (value: boolean) => void;
  saving?: boolean;
  dangerous?: boolean;
  isLast?: boolean;
}

const PermissionRow: React.FC<PermissionRowProps> = ({ label, description, icon, enabled, onChange, saving, dangerous, isLast }) => (
  <div className={`flex items-center justify-between py-4 ${!isLast ? 'border-b border-gray-100' : ''}`}>
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className={`w-[18px] h-[18px] flex-shrink-0 ${enabled ? (dangerous ? 'text-red-400' : 'text-gray-400') : 'text-gray-300'}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
    <button
      onClick={() => onChange(!enabled)}
      disabled={saving}
      className={`relative ml-3 inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${
        enabled ? (dangerous ? 'bg-red-500' : 'bg-[#5D5FEF]') : 'bg-gray-200'
      } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
      role="switch"
      aria-checked={enabled}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition flex items-center justify-center ${
        enabled ? 'translate-x-6' : 'translate-x-1'
      }`}>
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
        ) : enabled ? (
          <Unlock className="w-2.5 h-2.5 text-[#5D5FEF]" />
        ) : (
          <Lock className="w-2.5 h-2.5 text-gray-300" />
        )}
      </span>
    </button>
  </div>
);

interface AISecurityViewProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  isMobile?: boolean;
}

const AISecurityView: React.FC<AISecurityViewProps> = ({ showToast, isMobile }) => {
  const [permissions, setPermissions] = useState<AIPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { settings } = await authApi.getSettings();
        const loaded: AIPermissions = { ...DEFAULT_PERMISSIONS };
        for (const key of Object.keys(DEFAULT_PERMISSIONS) as (keyof AIPermissions)[]) {
          if (settings[key] !== undefined) loaded[key] = settings[key];
        }
        setPermissions(loaded);
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    };
    loadSettings();
  }, []);

  const handleToggle = useCallback(async (key: keyof AIPermissions, value: boolean) => {
    setSavingKey(key);
    const prev = permissions[key];
    setPermissions(p => ({ ...p, [key]: value }));
    try {
      await authApi.updateSettings({ [key]: value });
      if (showToast) {
        const label = key.replace(/^ai/, 'AI ').replace(/([A-Z])/g, ' $1').trim();
        showToast(`${label} ${value ? 'enabled' : 'disabled'}`, 'success');
      }
    } catch {
      setPermissions(p => ({ ...p, [key]: prev }));
      if (showToast) showToast('Failed to save setting', 'error');
    } finally { setSavingKey(null); }
  }, [permissions, showToast]);

  const handleEnableAll = useCallback(async () => {
    const allEnabled: AIPermissions = {} as AIPermissions;
    for (const key of Object.keys(DEFAULT_PERMISSIONS) as (keyof AIPermissions)[]) allEnabled[key] = true;
    setPermissions(allEnabled);
    try { await authApi.updateSettings(allEnabled); if (showToast) showToast('All AI permissions enabled', 'info'); }
    catch { if (showToast) showToast('Failed to save', 'error'); }
  }, [showToast]);

  const handleDisableAll = useCallback(async () => {
    const allDisabled: AIPermissions = {} as AIPermissions;
    for (const key of Object.keys(DEFAULT_PERMISSIONS) as (keyof AIPermissions)[]) allDisabled[key] = false;
    setPermissions(allDisabled);
    try { await authApi.updateSettings(allDisabled); if (showToast) showToast('All AI permissions disabled — AI is now read-only', 'info'); }
    catch { if (showToast) showToast('Failed to save', 'error'); }
  }, [showToast]);

  const handleResetDefaults = useCallback(async () => {
    setPermissions(DEFAULT_PERMISSIONS);
    try { await authApi.updateSettings(DEFAULT_PERMISSIONS as any); if (showToast) showToast('AI permissions reset to defaults', 'success'); }
    catch { if (showToast) showToast('Failed to save', 'error'); }
  }, [showToast]);

  const enabledCount = Object.values(permissions).filter(Boolean).length;
  const totalCount = Object.keys(permissions).length;
  const securityScore = Math.round((enabledCount / totalCount) * 100);

  type AISectionId = 'overview' | 'files' | 'trash' | 'database' | 'comms' | 'actions';
  const [activeSection, setActiveSection] = useState<AISectionId>('overview');

  const sidebarItems: { id: AISectionId; label: string; icon: React.ElementType; danger?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: ShieldCheck },
    { id: 'files', label: 'File Operations', icon: FileEdit },
    { id: 'trash', label: 'Trash', icon: Trash2 },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'comms', label: 'Communication', icon: Mail },
    { id: 'actions', label: 'Quick Actions', icon: RefreshCw },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#5D5FEF]" />
      </div>
    );
  }

  return (
    <div className="py-2">
      {/* ── Header ── */}
      <div className="mb-6 md:mb-8 pb-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 md:h-10 bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full flex-shrink-0" />
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-gray-900 tracking-tight">AI Security</h1>
            <p className="text-sm text-gray-500 mt-1">Control what the AI assistant can access and modify.</p>
          </div>
        </div>
      </div>

      <div className={`flex gap-6 md:gap-8 ${isMobile ? 'flex-col' : 'flex-row'}`}>
        {/* ── Navigation: top tabs on mobile, sidebar on desktop ── */}
        {isMobile ? (
          <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-white rounded-xl border border-gray-200 shadow-sm">
            {sidebarItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`px-2 py-2.5 rounded-lg text-xs font-semibold transition-all text-center ${
                    isActive ? 'bg-[#5D5FEF] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : (
          <nav className="w-52 flex-shrink-0">
            <div className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-left transition-all text-[14px] font-medium ${
                      isActive
                        ? 'bg-[#F5F5F7] text-gray-900'
                        : 'text-gray-500 hover:bg-[#F5F5F7] hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* ── Content Area ── */}
        <div className="flex-1 min-w-0">

          {/* ═══ Overview ═══ */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Permission Overview</h2>
                <p className="text-sm text-gray-400">Current AI access level and feature status.</p>
              </div>

              {/* Dark overview card */}
              <div className="rounded-2xl sm:rounded-3xl bg-[#1d1d1f] border border-[#2d2d2f] p-6 sm:p-8 md:p-10 shadow-xl shadow-black/10 overflow-hidden relative">
                <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#5D5FEF]/15 blur-3xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                        <Bot className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">AI Access Level</p>
                        <p className="text-2xl sm:text-3xl font-heading font-bold text-white leading-tight">
                          {enabledCount}/{totalCount} <span className="text-base font-bold text-white/40">Enabled</span>
                        </p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-5 md:gap-8">
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Active</p>
                        <p className="text-lg md:text-xl font-heading font-bold text-emerald-400">{enabledCount}</p>
                      </div>
                      <div className="w-px h-10 bg-white/10" />
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Blocked</p>
                        <p className="text-lg md:text-xl font-heading font-bold text-white/60">{totalCount - enabledCount}</p>
                      </div>
                      <div className="w-px h-10 bg-white/10" />
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Score</p>
                        <p className="text-lg md:text-xl font-heading font-bold text-white">{securityScore}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-3 w-full rounded-full bg-white/10 mb-3 overflow-hidden">
                    <div className="h-full bg-[#5D5FEF] rounded-full transition-all duration-700" style={{ width: `${securityScore}%` }} />
                  </div>
                  <p className="text-[11px] font-bold text-white/40">
                    {enabledCount === totalCount
                      ? 'All permissions enabled. AI has full access.'
                      : enabledCount === 0
                        ? 'All permissions disabled. AI is read-only.'
                        : `${totalCount - enabledCount} permission${totalCount - enabledCount !== 1 ? 's' : ''} restricted.`}
                  </p>
                </div>
              </div>

              {/* Feature status grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Read Files', enabled: permissions.aiFileRead, icon: Eye },
                  { label: 'Create Files', enabled: permissions.aiFileCreate, icon: FileEdit },
                  { label: 'Modify Files', enabled: permissions.aiFileModify, icon: FileEdit },
                  { label: 'Delete Files', enabled: permissions.aiFileDelete, icon: Trash2, dangerous: true },
                  { label: 'Create Folders', enabled: permissions.aiFolderCreate, icon: FolderPlus },
                  { label: 'Organize', enabled: permissions.aiFileOrganize, icon: FolderTree },
                  { label: 'Trash Access', enabled: permissions.aiTrashAccess, icon: Trash2 },
                  { label: 'Restore Trash', enabled: permissions.aiTrashRestore, icon: RotateCcw },
                  { label: 'Empty Trash', enabled: permissions.aiTrashEmpty, icon: Trash2, dangerous: true },
                  { label: 'Create DB', enabled: permissions.aiDatabaseCreate, icon: Database },
                  { label: 'Delete DB', enabled: permissions.aiDatabaseDelete, icon: Database, dangerous: true },
                  { label: 'SQL Queries', enabled: permissions.aiDatabaseQuery, icon: Database },
                  { label: 'Send Email', enabled: permissions.aiSendEmail, icon: Mail },
                  { label: 'Cast Media', enabled: permissions.aiCastMedia, icon: MonitorPlay },
                ].map(({ label, enabled, icon: FeatureIcon, dangerous }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col gap-3 min-h-[100px]">
                    <div className="flex items-center justify-between">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${enabled ? (dangerous ? 'bg-red-50' : 'bg-[#5D5FEF]/10') : 'bg-gray-100'}`}>
                        <FeatureIcon className={`w-4 h-4 ${enabled ? (dangerous ? 'text-red-400' : 'text-[#5D5FEF]') : 'text-gray-300'}`} />
                      </div>
                      <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                    </div>
                    <div className="min-w-0 mt-auto">
                      <p className="text-xs font-bold text-gray-900 truncate">{label}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${enabled ? (dangerous ? 'text-red-400' : 'text-emerald-600') : 'text-gray-300'}`}>
                        {enabled ? 'Allowed' : 'Blocked'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-1">How AI permissions work</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    These settings control what the AI assistant can do in chat. Disabling a permission blocks that action — the AI will suggest enabling it in settings. Changes take effect immediately.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══ File Operations ═══ */}
          {activeSection === 'files' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">File Operations</h2>
                <p className="text-sm text-gray-400">Control AI access to files and folders.</p>
              </div>

              <div className="space-y-0">
                <PermissionRow label="Read Files" description="Browse and view your files, folders, and contents" icon={<Eye className="w-[18px] h-[18px]" />} enabled={permissions.aiFileRead} onChange={(v) => handleToggle('aiFileRead', v)} saving={savingKey === 'aiFileRead'} />
                <PermissionRow label="Create Files" description="Create new documents, code files, and notes" icon={<FileEdit className="w-[18px] h-[18px]" />} enabled={permissions.aiFileCreate} onChange={(v) => handleToggle('aiFileCreate', v)} saving={savingKey === 'aiFileCreate'} />
                <PermissionRow label="Modify & Rename Files" description="Edit file contents and rename files or folders" icon={<FileEdit className="w-[18px] h-[18px]" />} enabled={permissions.aiFileModify} onChange={(v) => handleToggle('aiFileModify', v)} saving={savingKey === 'aiFileModify'} />
                <PermissionRow label="Delete Files" description="Move files and folders to trash" icon={<Trash2 className="w-[18px] h-[18px]" />} enabled={permissions.aiFileDelete} onChange={(v) => handleToggle('aiFileDelete', v)} saving={savingKey === 'aiFileDelete'} dangerous />
                <PermissionRow label="Create Folders" description="Create new folders in your vault categories" icon={<FolderPlus className="w-[18px] h-[18px]" />} enabled={permissions.aiFolderCreate} onChange={(v) => handleToggle('aiFolderCreate', v)} saving={savingKey === 'aiFolderCreate'} />
                <PermissionRow label="Organize & Move Files" description="Reorganize files by moving them between folders" icon={<FolderTree className="w-[18px] h-[18px]" />} enabled={permissions.aiFileOrganize} onChange={(v) => handleToggle('aiFileOrganize', v)} saving={savingKey === 'aiFileOrganize'} isLast />
              </div>
            </div>
          )}

          {/* ═══ Trash ═══ */}
          {activeSection === 'trash' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Trash Operations</h2>
                <p className="text-sm text-gray-400">Control AI access to deleted items.</p>
              </div>

              <div className="space-y-0">
                <PermissionRow label="Access Trash" description="View items currently in your trash" icon={<Trash2 className="w-[18px] h-[18px]" />} enabled={permissions.aiTrashAccess} onChange={(v) => handleToggle('aiTrashAccess', v)} saving={savingKey === 'aiTrashAccess'} />
                <PermissionRow label="Restore from Trash" description="Restore deleted items back to their original location" icon={<RotateCcw className="w-[18px] h-[18px]" />} enabled={permissions.aiTrashRestore} onChange={(v) => handleToggle('aiTrashRestore', v)} saving={savingKey === 'aiTrashRestore'} />
                <PermissionRow label="Empty Trash" description="Permanently delete all items from trash — cannot be undone" icon={<Trash2 className="w-[18px] h-[18px]" />} enabled={permissions.aiTrashEmpty} onChange={(v) => handleToggle('aiTrashEmpty', v)} saving={savingKey === 'aiTrashEmpty'} dangerous isLast />
              </div>
            </div>
          )}

          {/* ═══ Database ═══ */}
          {activeSection === 'database' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Database Operations</h2>
                <p className="text-sm text-gray-400">Control AI access to PostgreSQL databases.</p>
              </div>

              <div className="space-y-0">
                <PermissionRow label="Create Databases & Tables" description="Create new PostgreSQL databases and tables" icon={<Database className="w-[18px] h-[18px]" />} enabled={permissions.aiDatabaseCreate} onChange={(v) => handleToggle('aiDatabaseCreate', v)} saving={savingKey === 'aiDatabaseCreate'} />
                <PermissionRow label="Delete Databases & Tables" description="Delete databases and drop tables — data permanently lost" icon={<Database className="w-[18px] h-[18px]" />} enabled={permissions.aiDatabaseDelete} onChange={(v) => handleToggle('aiDatabaseDelete', v)} saving={savingKey === 'aiDatabaseDelete'} dangerous />
                <PermissionRow label="Run SQL Queries" description="Execute SQL queries (SELECT, INSERT, UPDATE, DELETE)" icon={<Database className="w-[18px] h-[18px]" />} enabled={permissions.aiDatabaseQuery} onChange={(v) => handleToggle('aiDatabaseQuery', v)} saving={savingKey === 'aiDatabaseQuery'} isLast />
              </div>
            </div>
          )}

          {/* ═══ Communication ═══ */}
          {activeSection === 'comms' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Communication & Media</h2>
                <p className="text-sm text-gray-400">Control AI access to email and device casting.</p>
              </div>

              <div className="space-y-0">
                <PermissionRow label="Send Emails" description="Send files to your email address as attachments" icon={<Mail className="w-[18px] h-[18px]" />} enabled={permissions.aiSendEmail} onChange={(v) => handleToggle('aiSendEmail', v)} saving={savingKey === 'aiSendEmail'} />
                <PermissionRow label="Cast to Devices" description="Cast media files to your smart TVs and displays" icon={<MonitorPlay className="w-[18px] h-[18px]" />} enabled={permissions.aiCastMedia} onChange={(v) => handleToggle('aiCastMedia', v)} saving={savingKey === 'aiCastMedia'} isLast />
              </div>
            </div>
          )}

          {/* ═══ Quick Actions ═══ */}
          {activeSection === 'actions' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Quick Actions</h2>
                <p className="text-sm text-gray-400">Bulk permission controls.</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleEnableAll}
                  className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-[#5D5FEF]/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] group-hover:bg-[#5D5FEF]/10 flex items-center justify-center transition-colors">
                      <ShieldCheck className="w-4 h-4 text-gray-400 group-hover:text-[#5D5FEF]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">Enable All Permissions</p>
                      <p className="text-xs text-gray-400">Grant AI full access to all features</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleDisableAll}
                  className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-red-200 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] group-hover:bg-red-50 flex items-center justify-center transition-colors">
                      <ShieldOff className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">Disable All Permissions</p>
                      <p className="text-xs text-gray-400">Make AI completely read-only</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleResetDefaults}
                  className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-gray-300 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] group-hover:bg-gray-100 flex items-center justify-center transition-colors">
                      <RefreshCw className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">Reset to Defaults</p>
                      <p className="text-xs text-gray-400">Restore recommended permission settings</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Current status summary */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Current Status</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-[#5D5FEF] rounded-full transition-all duration-500" style={{ width: `${securityScore}%` }} />
                    </div>
                  </div>
                  <p className="text-sm font-heading font-bold text-gray-900">{enabledCount}/{totalCount}</p>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {enabledCount} permission{enabledCount !== 1 ? 's' : ''} enabled, {totalCount - enabledCount} blocked
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AISecurityView;
