import React from 'react';
import {
  Share2,
  Database,
  Trash2,
  Shield,
  BarChart3,
  Server,
  FileText,
  Download,
  Bell,
  Palette,
  Key,
  HelpCircle,
  Activity,
  LayoutGrid,
  Usb,
  ShieldCheck,
  ChevronRight,
  User,
  Sparkles,
} from 'lucide-react';

interface MobileMoreProps {
  onNavigate: (tab: string) => void;
  user: { firstName?: string | null; lastName?: string | null; avatarUrl?: string | null; email?: string } | null;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const sections: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Content',
    items: [
      { id: 'shared', label: 'Shared Files', icon: Share2 },
      { id: 'database', label: 'Databases', icon: Database },
      { id: 'trash', label: 'Trash', icon: Trash2 },
      { id: 'myapps', label: 'My Apps', icon: LayoutGrid },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'stats', label: 'Statistics', icon: BarChart3 },
      { id: 'server', label: 'Server', icon: Server },
      { id: 'logs', label: 'System Logs', icon: FileText },
      { id: 'usb', label: 'USB Devices', icon: Usb },
      { id: 'activity', label: 'Activity Log', icon: Activity },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { id: 'settings', label: 'Account', icon: User },
      { id: 'security', label: 'Security Vault', icon: Shield },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'apikeys', label: 'API Keys', icon: Key },
      { id: 'aisecurity', label: 'AI Security', icon: ShieldCheck },
      { id: 'export', label: 'Export Data', icon: Download },
      { id: 'help', label: 'Help & Support', icon: HelpCircle },
    ],
  },
];

const MobileMore: React.FC<MobileMoreProps> = ({ onNavigate, user }) => {
  return (
    <div className="animate-in fade-in duration-300">
      {/* Page Header — matches AccountSettingsView */}
      <div className="mb-6">
        <div className="relative">
          <div className="absolute -left-2 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl font-black tracking-tight text-gray-900 pl-3 mb-1">
            Settings
          </h1>
        </div>
        <p className="text-gray-400 font-medium text-xs pl-3">Manage your account & system</p>
      </div>

      {/* Profile Card — clean white card like AccountSettings identity section */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm">
        <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4">Personal Identity</p>
        <button
          onClick={() => onNavigate('settings')}
          className="w-full flex items-center gap-4 active:opacity-70 transition-all"
        >
          <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center bg-[#5D5FEF] flex-shrink-0 shadow-lg shadow-[#5D5FEF]/20">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="User" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-black text-lg">
                {user?.firstName?.[0]?.toUpperCase() || 'A'}
              </span>
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[15px] font-bold text-gray-900 truncate">
              {user?.firstName || 'User'} {user?.lastName || ''}
            </p>
            <p className="text-xs text-gray-400 font-medium truncate mt-0.5">{(user as any)?.email || 'Manage your profile'}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </button>
      </section>

      {/* Menu Sections — clean white cards matching AccountSettingsView style */}
      {sections.map((section) => (
        <section key={section.title} className="bg-white rounded-2xl border border-gray-100 mb-5 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">{section.title}</p>
          </div>
          {section.items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="w-full flex items-center gap-3.5 px-5 py-3.5 active:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#F5F5F7] flex-shrink-0">
                  <Icon className="w-[18px] h-[18px] text-gray-600" />
                </div>
                <span className="flex-1 text-left text-[14px] font-semibold text-gray-800">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            );
          })}
        </section>
      ))}

      {/* AI Model Badge — subtle accent */}
      <section className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#5D5FEF]/10 flex-shrink-0">
            <Sparkles className="w-[18px] h-[18px] text-[#5D5FEF]" />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">AI Engine</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">Powered by AI</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MobileMore;
