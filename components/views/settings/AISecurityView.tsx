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
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Bot,
  ShieldOff,
  RefreshCw,
} from 'lucide-react';
import { authApi } from '../../../services/api.client';

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

interface PermissionToggleProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onChange: (value: boolean) => void;
  saving?: boolean;
  dangerous?: boolean;
}

const PermissionToggle: React.FC<PermissionToggleProps> = ({
  label,
  description,
  icon,
  enabled,
  onChange,
  saving,
  dangerous,
}) => (
  <div className={`flex items-center justify-between px-5 sm:px-6 md:px-8 py-4 sm:py-5 transition-all ${
    enabled
      ? dangerous
        ? 'bg-red-50/30'
        : ''
      : 'opacity-70'
  }`}>
    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ${
        enabled
          ? dangerous
            ? 'bg-red-100 text-red-500'
            : 'bg-[#5D5FEF]/10 text-[#5D5FEF]'
          : 'bg-gray-100 text-gray-400'
      }`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] sm:text-[14px] font-bold ${enabled ? 'text-gray-900' : 'text-gray-500'}`}>
          {label}
        </p>
        <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
    <button
      onClick={() => onChange(!enabled)}
      disabled={saving}
      className={`relative ml-3 sm:ml-4 w-11 sm:w-12 h-[26px] sm:h-7 rounded-full transition-all duration-300 flex-shrink-0 ${
        enabled
          ? dangerous
            ? 'bg-red-500'
            : 'bg-[#5D5FEF]'
          : 'bg-gray-200'
      } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className={`absolute top-0.5 w-[22px] sm:w-6 h-[22px] sm:h-6 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${
        enabled ? 'left-[20px] sm:left-[22px]' : 'left-0.5'
      }`}>
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
        ) : enabled ? (
          <Unlock className="w-3 h-3 text-[#5D5FEF]" />
        ) : (
          <Lock className="w-3 h-3 text-gray-300" />
        )}
      </div>
    </button>
  </div>
);

interface AISecurityViewProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const AISecurityView: React.FC<AISecurityViewProps> = ({ showToast }) => {
  const [permissions, setPermissions] = useState<AIPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { settings } = await authApi.getSettings();
        // Merge saved AI permissions with defaults
        const loaded: AIPermissions = { ...DEFAULT_PERMISSIONS };
        for (const key of Object.keys(DEFAULT_PERMISSIONS) as (keyof AIPermissions)[]) {
          if (settings[key] !== undefined) {
            loaded[key] = settings[key];
          }
        }
        setPermissions(loaded);
      } catch {
        // Use defaults on error
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleToggle = useCallback(async (key: keyof AIPermissions, value: boolean) => {
    setSavingKey(key);
    const prev = permissions[key];
    // Optimistic update
    setPermissions(p => ({ ...p, [key]: value }));

    try {
      await authApi.updateSettings({ [key]: value });
      if (showToast) {
        const label = key.replace(/^ai/, 'AI ').replace(/([A-Z])/g, ' $1').trim();
        showToast(`${label} ${value ? 'enabled' : 'disabled'}`, 'success');
      }
    } catch {
      // Revert on error
      setPermissions(p => ({ ...p, [key]: prev }));
      if (showToast) showToast('Failed to save setting', 'error');
    } finally {
      setSavingKey(null);
    }
  }, [permissions, showToast]);

  const handleEnableAll = useCallback(async () => {
    const allEnabled: AIPermissions = {} as AIPermissions;
    for (const key of Object.keys(DEFAULT_PERMISSIONS) as (keyof AIPermissions)[]) {
      allEnabled[key] = true;
    }
    setPermissions(allEnabled);
    try {
      await authApi.updateSettings(allEnabled);
      if (showToast) showToast('All AI permissions enabled', 'info');
    } catch {
      if (showToast) showToast('Failed to save', 'error');
    }
  }, [showToast]);

  const handleDisableAll = useCallback(async () => {
    const allDisabled: AIPermissions = {} as AIPermissions;
    for (const key of Object.keys(DEFAULT_PERMISSIONS) as (keyof AIPermissions)[]) {
      allDisabled[key] = false;
    }
    setPermissions(allDisabled);
    try {
      await authApi.updateSettings(allDisabled);
      if (showToast) showToast('All AI permissions disabled — AI is now read-only', 'info');
    } catch {
      if (showToast) showToast('Failed to save', 'error');
    }
  }, [showToast]);

  const handleResetDefaults = useCallback(async () => {
    setPermissions(DEFAULT_PERMISSIONS);
    try {
      await authApi.updateSettings(DEFAULT_PERMISSIONS as any);
      if (showToast) showToast('AI permissions reset to defaults', 'success');
    } catch {
      if (showToast) showToast('Failed to save', 'error');
    }
  }, [showToast]);

  const enabledCount = Object.values(permissions).filter(Boolean).length;
  const totalCount = Object.keys(permissions).length;
  const securityLevel = enabledCount <= 5 ? 'Restrictive' : enabledCount <= 10 ? 'Balanced' : 'Permissive';
  const securityColor = enabledCount <= 5 ? 'text-green-600' : enabledCount <= 10 ? 'text-yellow-600' : 'text-red-500';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#5D5FEF]" />
      </div>
    );
  }

  return (
    <div className="py-2 animate-in fade-in duration-500">
      {/* Page Header — standard settings header pattern */}
      <div className="mb-8 md:mb-12">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            AI Security
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <p className="text-gray-500 font-medium text-sm pl-3 sm:pl-4 md:pl-6">Control what the AI assistant can access and modify</p>
      </div>

      {/* Security Status Card */}
      <div className={`rounded-2xl md:rounded-[2rem] border shadow-sm p-5 sm:p-6 md:p-8 mb-6 md:mb-8 ${
        enabledCount <= 5
          ? 'bg-green-50/50 border-green-100'
          : enabledCount <= 10
          ? 'bg-yellow-50/50 border-yellow-100'
          : 'bg-red-50/50 border-red-100'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center ${
              enabledCount <= 5 ? 'bg-green-100' : enabledCount <= 10 ? 'bg-yellow-100' : 'bg-red-100'
            }`}>
              {enabledCount <= 10 ? (
                <CheckCircle2 className={`w-5 h-5 sm:w-6 sm:h-6 ${securityColor}`} />
              ) : (
                <AlertTriangle className={`w-5 h-5 sm:w-6 sm:h-6 ${securityColor}`} />
              )}
            </div>
            <div>
              <p className={`text-[14px] sm:text-[15px] font-black ${securityColor}`}>
                {securityLevel} Mode
              </p>
              <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5">
                {enabledCount} of {totalCount} permissions enabled
              </p>
            </div>
          </div>

        </div>
        {/* Progress bar */}
        <div className="mt-4 sm:mt-5 h-2 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              enabledCount <= 5 ? 'bg-green-400' : enabledCount <= 10 ? 'bg-yellow-400' : 'bg-red-400'
            }`}
            style={{ width: `${(enabledCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* File Operations Section */}
      <div className="bg-white rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden mb-6 md:mb-8">
        <div className="px-5 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center">
              <FileEdit className="w-4 h-4 text-[#5D5FEF]" />
            </div>
            <p className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">File Operations</p>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          <PermissionToggle
            label="Read Files"
            description="Allow AI to browse and view your files, folders, and their contents"
            icon={<Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiFileRead}
            onChange={(v) => handleToggle('aiFileRead', v)}
            saving={savingKey === 'aiFileRead'}
          />
          <PermissionToggle
            label="Create Files"
            description="Allow AI to create new files (documents, code, notes) in your vault"
            icon={<FileEdit className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiFileCreate}
            onChange={(v) => handleToggle('aiFileCreate', v)}
            saving={savingKey === 'aiFileCreate'}
          />
          <PermissionToggle
            label="Modify & Rename Files"
            description="Allow AI to edit existing file contents and rename files or folders"
            icon={<FileEdit className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiFileModify}
            onChange={(v) => handleToggle('aiFileModify', v)}
            saving={savingKey === 'aiFileModify'}
          />
          <PermissionToggle
            label="Delete Files"
            description="Allow AI to move files and folders to trash"
            icon={<Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiFileDelete}
            onChange={(v) => handleToggle('aiFileDelete', v)}
            saving={savingKey === 'aiFileDelete'}
            dangerous
          />
          <PermissionToggle
            label="Create Folders"
            description="Allow AI to create new folders in your vault categories"
            icon={<FolderPlus className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiFolderCreate}
            onChange={(v) => handleToggle('aiFolderCreate', v)}
            saving={savingKey === 'aiFolderCreate'}
          />
          <PermissionToggle
            label="Organize & Move Files"
            description="Allow AI to reorganize files by moving them between folders"
            icon={<FolderTree className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiFileOrganize}
            onChange={(v) => handleToggle('aiFileOrganize', v)}
            saving={savingKey === 'aiFileOrganize'}
          />
        </div>
      </div>

      {/* Trash Operations Section */}
      <div className="bg-white rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden mb-6 md:mb-8">
        <div className="px-5 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">Trash Operations</p>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          <PermissionToggle
            label="Access Trash"
            description="Allow AI to view items currently in your trash"
            icon={<Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiTrashAccess}
            onChange={(v) => handleToggle('aiTrashAccess', v)}
            saving={savingKey === 'aiTrashAccess'}
          />
          <PermissionToggle
            label="Restore from Trash"
            description="Allow AI to restore deleted items back to their original location"
            icon={<RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiTrashRestore}
            onChange={(v) => handleToggle('aiTrashRestore', v)}
            saving={savingKey === 'aiTrashRestore'}
          />
          <PermissionToggle
            label="Empty Trash"
            description="Allow AI to permanently delete all items from trash — this cannot be undone"
            icon={<Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiTrashEmpty}
            onChange={(v) => handleToggle('aiTrashEmpty', v)}
            saving={savingKey === 'aiTrashEmpty'}
            dangerous
          />
        </div>
      </div>

      {/* Database Operations Section */}
      <div className="bg-white rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden mb-6 md:mb-8">
        <div className="px-5 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Database className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">Database Operations</p>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          <PermissionToggle
            label="Create Databases & Tables"
            description="Allow AI to create new PostgreSQL databases and tables"
            icon={<Database className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiDatabaseCreate}
            onChange={(v) => handleToggle('aiDatabaseCreate', v)}
            saving={savingKey === 'aiDatabaseCreate'}
          />
          <PermissionToggle
            label="Delete Databases & Tables"
            description="Allow AI to delete databases and drop tables — data will be permanently lost"
            icon={<Database className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiDatabaseDelete}
            onChange={(v) => handleToggle('aiDatabaseDelete', v)}
            saving={savingKey === 'aiDatabaseDelete'}
            dangerous
          />
          <PermissionToggle
            label="Run SQL Queries"
            description="Allow AI to execute SQL queries (SELECT, INSERT, UPDATE, DELETE) on your databases"
            icon={<Database className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiDatabaseQuery}
            onChange={(v) => handleToggle('aiDatabaseQuery', v)}
            saving={savingKey === 'aiDatabaseQuery'}
          />
        </div>
      </div>

      {/* Communication & Media Section */}
      <div className="bg-white rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden mb-6 md:mb-8">
        <div className="px-5 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Mail className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">Communication & Media</p>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          <PermissionToggle
            label="Send Emails"
            description="Allow AI to send files to your email address as attachments"
            icon={<Mail className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiSendEmail}
            onChange={(v) => handleToggle('aiSendEmail', v)}
            saving={savingKey === 'aiSendEmail'}
          />
          <PermissionToggle
            label="Cast to Devices"
            description="Allow AI to cast media files to your smart TVs and displays"
            icon={<MonitorPlay className="w-4 h-4 sm:w-5 sm:h-5" />}
            enabled={permissions.aiCastMedia}
            onChange={(v) => handleToggle('aiCastMedia', v)}
            saving={savingKey === 'aiCastMedia'}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden mb-6 md:mb-8">
        <div className="px-5 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </div>
            <p className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">Quick Actions</p>
          </div>
        </div>
        <div className="px-5 sm:px-6 md:px-8 py-5 sm:py-6 flex flex-wrap items-center gap-3">
          <button
            onClick={handleEnableAll}
            className="px-4 sm:px-5 py-2.5 sm:py-3 bg-[#5D5FEF]/5 text-[#5D5FEF] rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-[#5D5FEF]/10 transition-all border border-[#5D5FEF]/10 flex items-center gap-2"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Enable All
          </button>
          <button
            onClick={handleDisableAll}
            className="px-4 sm:px-5 py-2.5 sm:py-3 bg-red-50 text-red-500 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 flex items-center gap-2"
          >
            <ShieldOff className="w-3.5 h-3.5" />
            Disable All
          </button>
          <button
            onClick={handleResetDefaults}
            className="px-4 sm:px-5 py-2.5 sm:py-3 bg-gray-50 text-gray-500 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100 flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Info footer */}
      <div className="bg-[#F5F5F7] rounded-2xl md:rounded-[2rem] p-5 sm:p-6 md:p-8 border border-gray-100">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          </div>
          <div>
            <p className="text-[12px] sm:text-[13px] font-black text-gray-700 mb-1">How AI permissions work</p>
            <p className="text-[11px] sm:text-[12px] text-gray-400 leading-relaxed">
              These settings control what actions the AI assistant can perform when you interact with it in the chat. 
              Disabling a permission will prevent the AI from executing that type of action — it will inform you 
              that the action is blocked and suggest enabling it in AI Security settings. Changes take effect immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISecurityView;
