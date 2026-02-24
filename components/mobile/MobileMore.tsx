import React, { useState, useEffect } from 'react';
import {
  Share2,
  Trash2,
  Fingerprint,
  BarChart3,
  Server,
  FileText,
  Download,
  Bell,
  Palette,
  Blocks,
  HelpCircle,
  Activity,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Users,
  HardDrive,
} from 'lucide-react';

/* Custom SVG icons from assets/icons */
const CableIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className={className} fill="currentColor">
    <path d="M200-120q-17 0-28.5-11.5T160-160v-40h-40v-160q0-17 11.5-28.5T160-400h40v-280q0-66 47-113t113-47q66 0 113 47t47 113v400q0 33 23.5 56.5T600-200q33 0 56.5-23.5T680-280v-280h-40q-17 0-28.5-11.5T600-600v-160h40v-40q0-17 11.5-28.5T680-840h80q17 0 28.5 11.5T800-800v40h40v160q0 17-11.5 28.5T800-560h-40v280q0 66-47 113t-113 47q-66 0-113-47t-47-113v-400q0-33-23.5-56.5T360-760q-33 0-56.5 23.5T280-680v280h40q17 0 28.5 11.5T360-360v160h-40v40q0 17-11.5 28.5T280-120h-80Z"/>
  </svg>
);

const DatabaseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className={className} fill="currentColor">
    <path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z"/>
  </svg>
);

// Admin-only item IDs hidden from family member sessions
const FAMILY_HIDDEN_ITEMS = new Set(['database', 'stats', 'server', 'logs', 'activity', 'security', 'export', 'family']);

interface MobileMoreProps {
  onNavigate: (tab: string) => void;
  user: {
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    email?: string;
  } | null;
  isFamilyMember?: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
}

interface StorageData {
  totalHuman: string;
  usedHuman: string;
  usedPercent: number;
}

const sections: { title: string; items: MenuItem[] }[] = [
  {
    title: 'CONTENT',
    items: [
      { id: 'shared', label: 'Shared Files', icon: Share2 },
      { id: 'family', label: 'Family Sharing', icon: Users },
      { id: 'database', label: 'Databases', icon: DatabaseIcon },
      { id: 'trash', label: 'Trash', icon: Trash2 },
      { id: 'myapps', label: 'Integrations', icon: Blocks },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { id: 'stats', label: 'Statistics', icon: BarChart3 },
      { id: 'server', label: 'Server', icon: Server },
      { id: 'logs', label: 'System Logs', icon: FileText },
      { id: 'usb', label: 'USB Devices', icon: CableIcon },
      { id: 'activity', label: 'Activity Log', icon: Activity },
    ],
  },
  {
    title: 'PREFERENCES',
    items: [
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'apikeys', label: 'API Keys', icon: Sparkles },
      { id: 'aisecurity', label: 'AI Security', icon: ShieldCheck },
      { id: 'security', label: 'Security Vault', icon: Fingerprint },
      { id: 'export', label: 'Export Data', icon: Download },
      { id: 'help', label: 'Help & Support', icon: HelpCircle },
    ],
  },
];

const MobileMore: React.FC<MobileMoreProps> = ({ onNavigate, user, isFamilyMember }) => {
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [folderCount, setFolderCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);

  useEffect(() => {
    const fetchShareCount = async () => {
      try {
        const token = localStorage.getItem('sessionToken');
        if (!token) return;
        const resp = await fetch('/api/share/count', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          setShareCount(data.count || 0);
        }
      } catch { /* ignore */ }
    };
    fetchShareCount();
  }, []);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    CONTENT: true,
    SYSTEM: true,
    PREFERENCES: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('sessionToken');
        const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
        const [storageRes, countRes] = await Promise.all([
          fetch('/api/system/storage', { headers: authHeader }),
          fetch('/api/files/total-count', { headers: authHeader }),
        ]);
        if (storageRes.ok) {
          const data = await storageRes.json();
          if (data.familyMemberStorage) {
            const fm = data.familyMemberStorage;
            setStorage({
              totalHuman: fm.quotaHuman,
              usedHuman: fm.usedHuman,
              usedPercent: fm.usedPercent,
            });
          } else if (data.rootStorage) {
            setStorage({
              totalHuman: data.rootStorage.totalHuman,
              usedHuman: data.rootStorage.usedHuman,
              usedPercent: data.rootStorage.usedPercent,
            });
          }
        }
        if (countRes.ok) {
          const data = await countRes.json();
          setFileCount(data.totalFiles || 0);
          setFolderCount(data.totalFolders || 0);
        }
      } catch {}
    };
    fetchData();
  }, []);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div className="font-heading animate-in fade-in duration-300 pb-4">
      {/* ===== Profile Header — gradient card ===== */}
      <div className="mb-5 rounded-3xl overflow-hidden shadow-xl shadow-[#5D5FEF]/15">
        <div className="bg-gradient-to-br from-[#5D5FEF] to-[#4D4FCF] p-6">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-4">
            <div className="w-[90px] h-[90px] rounded-full overflow-hidden border-[3px] border-white/30 shadow-lg mb-3">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="User" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                  <span className="text-white text-3xl font-extrabold">
                    {user?.firstName?.[0]?.toUpperCase() || 'A'}
                  </span>
                </div>
              )}
            </div>
            <h2 className="text-white text-[24px] font-extrabold tracking-tight">
              {user?.firstName || 'User'} {user?.lastName || ''}
            </h2>
            <p className="text-white/70 text-[14px] font-medium mt-0.5">
              {(user as any)?.email || 'Personal Cloud'}
            </p>
            {/* Plan badge */}
            <div className="mt-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm">
              <span className="text-white text-[12px] font-bold">Self-Hosted</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-around pt-4 mt-2 border-t border-white/20">
            <div className="flex flex-col items-center">
              <span className="text-white text-[28px] font-black tracking-tight leading-none">
                {fileCount + folderCount}
              </span>
              <span className="text-white/70 text-[13px] font-semibold mt-1">Items</span>
            </div>
            <div className="w-px h-[44px] bg-white/20" />
            <div className="flex flex-col items-center">
              <span className="text-white text-[28px] font-black tracking-tight leading-none">
                {storage?.usedHuman || '—'}
              </span>
              <span className="text-white/70 text-[13px] font-semibold mt-1">Storage</span>
            </div>
            <div className="w-px h-[44px] bg-white/20" />
            <div className="flex flex-col items-center">
              <span className="text-white text-[28px] font-black tracking-tight leading-none">
                {storage?.usedPercent ?? '—'}%
              </span>
              <span className="text-white/70 text-[13px] font-semibold mt-1">Used</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Account Settings CTA ===== */}
      <button
        onClick={() => onNavigate('settings')}
        className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-3 flex items-center gap-4 active:scale-[0.98] transition-all"
      >
        <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-[#5D5FEF] to-[#4D4FCF] flex items-center justify-center shadow-md shadow-[#5D5FEF]/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-[16px] font-bold text-gray-900">Account Settings</p>
          <p className="text-[13px] text-gray-400 font-medium">Manage your profile & preferences</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-300" />
      </button>

      {/* ===== Manage Storage CTA (family members) ===== */}
      {isFamilyMember && (
        <button
          onClick={() => onNavigate('manage-storage')}
          className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5 flex items-center gap-4 active:scale-[0.98] transition-all"
        >
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <HardDrive className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[16px] font-bold text-gray-900">Manage Storage</p>
            <p className="text-[13px] text-gray-400 font-medium">View usage & request more space</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </button>
      )}
      {!isFamilyMember && <div className="mb-2" />}

      {/* ===== Grouped Sections — Arcnota style ===== */}
      {sections.map((section) => {
        const visibleItems = isFamilyMember
          ? section.items.filter(item => !FAMILY_HIDDEN_ITEMS.has(item.id))
          : section.items;
        if (visibleItems.length === 0) return null;
        return (
          <div
            key={section.title}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-5 overflow-hidden"
          >
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full flex items-center justify-between px-[18px] py-[18px] active:bg-gray-50 transition-colors"
            >
              <span className="text-[12px] font-semibold tracking-[1px] uppercase text-gray-400">
                {section.title}
              </span>
              {expandedSections[section.title] ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {/* Section Items — Arcnota-style: icon in secondaryBg, consistent colors */}
            {expandedSections[section.title] && (
              <div>
                {visibleItems.map((item, idx) => {
                  const Icon = item.icon;
                  const isLast = idx === visibleItems.length - 1;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-3 px-[18px] py-[18px] active:bg-gray-50 transition-colors ${
                        !isLast ? 'border-b border-gray-50' : ''
                      }`}
                    >
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-[#F7F7F7] flex-shrink-0">
                        <Icon className="w-[18px] h-[18px] text-gray-600" />
                      </div>
                      <span className="flex-1 text-left text-[16px] font-semibold text-gray-800 tracking-tight">
                        {item.label}
                      </span>
                      {item.id === 'shared' && shareCount > 0 && (
                        <span className="min-w-[20px] h-[20px] flex items-center justify-center px-1.5 rounded-full bg-[#5D5FEF] text-white text-[11px] font-black leading-none mr-1">
                          {shareCount > 99 ? '99+' : shareCount}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ===== Version ===== */}
      <p className="text-center text-[12px] text-gray-300 font-medium mt-4 mb-2">
        Arcellite — Self-Hosted
      </p>
    </div>
  );
};

export default MobileMore;
