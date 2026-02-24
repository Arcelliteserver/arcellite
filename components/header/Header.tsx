import React from 'react';
import { HelpCircle, Bell, Menu, PanelLeft } from 'lucide-react';
import { authApi } from '../../services/api.client';
import SearchBar from './SearchBar';
import ProfileDropdown from './ProfileDropdown';
import HelpDropdown from './HelpDropdown';
import NotificationDropdown from './NotificationDropdown';
import type { UserData } from '@/types';

// Full map from tab ID → display name
const TAB_NAMES: Record<string, string> = {
  all: 'Files',
  overview: 'Overview',
  usb: 'USB',
  drive: 'Drive',
  appearance: 'Smart Features',
  apikeys: 'AI Models',
  aisecurity: 'AI Security',
  myapps: 'Integrations',
  system: 'System',
  server: 'System',
  stats: 'Monitoring',
  logs: 'Logs',
  activity: 'Activity Log',
  sessions: 'Sessions',
  chat: 'AI Chat',
  family: 'Users & Family',
  security: 'Security Vault',
  'manage-storage': 'Storage & Usage',
  domain: 'Domain',
  export: 'Export',
  shared: 'Shared',
  trash: 'Trash',
  photos: 'Photos',
  videos: 'Videos',
  music: 'Music',
  database: 'Database',
};

// Parent breadcrumb label per tab
const TAB_PARENTS: Record<string, string> = {
  all: 'Vault', overview: 'Vault', photos: 'Vault', videos: 'Vault',
  music: 'Vault', shared: 'Vault', trash: 'Vault', usb: 'Vault', drive: 'Vault',
  system: 'Infrastructure', server: 'Infrastructure', stats: 'Infrastructure',
  logs: 'Infrastructure', activity: 'Infrastructure', backup: 'Infrastructure',
  appearance: 'Settings', apikeys: 'Settings', aisecurity: 'Settings',
  'manage-storage': 'Settings', domain: 'Settings', export: 'Settings', family: 'Settings',
  sessions: 'Security', security: 'Security',
  myapps: 'Apps', database: 'Apps',
  chat: 'AI',
};

interface HeaderProps {
  activeTab: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNavigate: (id: string | null) => void;
  onAccountSettings: () => void;
  onSecurityVault: () => void;
  onTabChange?: (tab: string) => void;
  onSignOut?: () => void;
  onMobileMenuToggle?: () => void;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
  hasActiveModal?: boolean;
  user?: UserData | null;
}

const Header: React.FC<HeaderProps> = ({
  activeTab,
  searchQuery,
  onSearchChange,
  onNavigate,
  onAccountSettings,
  onSecurityVault,
  onTabChange,
  onSignOut,
  onMobileMenuToggle,
  sidebarCollapsed,
  onSidebarToggle,
  hasActiveModal = false,
  user,
}) => {
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = React.useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = React.useState(0);
  const prevUnreadRef = React.useRef<number>(0);
  const audioUnlockedRef = React.useRef(false);
  const isFirstFetchRef = React.useRef(true);

  const playNotificationSound = React.useCallback(() => {
    if (!audioUnlockedRef.current) return;
    try {
      const sound = new Audio('/audio/notification.wav');
      sound.volume = 0.5;
      sound.play().catch((e) => console.warn('[Notification] Sound play failed:', e.message));
    } catch (e) {
      console.warn('[Notification] Sound error:', e);
    }
  }, []);

  React.useEffect(() => {
    const unlockAudio = () => {
      const testSound = new Audio('/audio/notification.wav');
      testSound.volume = 0;
      testSound.play().then(() => {
        testSound.pause();
        audioUnlockedRef.current = true;
      }).catch(() => {
        audioUnlockedRef.current = true;
      });
    };
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  React.useEffect(() => {
    const fetchCount = () => {
      authApi.getNotifications(50)
        .then(data => {
          const unread = (data.notifications || []).filter((n: any) => !n.read).length;
          if (!isFirstFetchRef.current && unread > prevUnreadRef.current) {
            playNotificationSound();
          }
          isFirstFetchRef.current = false;
          prevUnreadRef.current = unread;
          setUnreadNotificationCount(unread);
        })
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => clearInterval(interval);
  }, [playNotificationSound]);

  const toggleProfile = () => { setIsProfileOpen(v => !v); setIsHelpOpen(false); setIsNotificationOpen(false); };
  const closeProfile = () => setIsProfileOpen(false);
  const toggleHelp = () => { setIsHelpOpen(v => !v); setIsProfileOpen(false); setIsNotificationOpen(false); };
  const closeHelp = () => setIsHelpOpen(false);
  const toggleNotification = () => { setIsNotificationOpen(v => !v); setIsProfileOpen(false); setIsHelpOpen(false); };
  const closeNotification = () => setIsNotificationOpen(false);

  const handleNotificationClose = () => {
    closeNotification();
    authApi.getNotifications(50)
      .then(data => {
        const unread = (data.notifications || []).filter((n: any) => !n.read).length;
        setUnreadNotificationCount(unread);
      })
      .catch(() => {});
  };

  const handleAccountSettings = () => { onAccountSettings(); closeProfile(); };
  const handleSecurityVault = () => { onSecurityVault(); closeProfile(); };

  const pageTitle = TAB_NAMES[activeTab] ?? activeTab.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const parentLabel = TAB_PARENTS[activeTab] ?? null;

  return (
    <header
      className={`relative z-[1000] flex-shrink-0 h-[60px] flex items-center justify-between px-4 md:px-6 bg-[#F0F1F5]/80 backdrop-blur-xl border-b border-gray-300/90 transition-all duration-200 ${
        hasActiveModal ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      {/* ── Left: mobile menu + sidebar toggle + page title ── */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all flex-shrink-0"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop: expand sidebar when collapsed (icon-only mode) */}
        {sidebarCollapsed && onSidebarToggle && (
          <button
            onClick={onSidebarToggle}
            className="hidden md:flex p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all flex-shrink-0"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeft className="w-4 h-4 rotate-180" />
          </button>
        )}

        {/* Breadcrumb: Parent › Page */}
        <div
          className="flex items-center gap-1.5 cursor-pointer select-none min-w-0"
          onClick={() => onNavigate(null)}
        >
          {parentLabel && (
            <>
              <span className="text-[14px] font-medium text-gray-400 truncate hidden sm:block">{parentLabel}</span>
              <span className="text-gray-300 text-[14px] hidden sm:block">›</span>
            </>
          )}
          <h1 className="text-[14px] font-bold text-[#5D5FEF] tracking-tight truncate">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* ── Center: Search ── */}
      <div className="hidden md:flex flex-1 max-w-xs lg:max-w-sm mx-4 lg:mx-8">
        <SearchBar value={searchQuery} onChange={onSearchChange} />
      </div>

      {/* ── Right: Actions ── */}
      <div className="flex items-center gap-1 flex-shrink-0">

        {/* Help */}
        <div className="relative">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleHelp(); }}
            className={`p-2 rounded-xl transition-all ${
              isHelpOpen
                ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="Help"
          >
            <HelpCircle className="w-[18px] h-[18px]" />
          </button>
          <HelpDropdown isOpen={isHelpOpen} onClose={closeHelp} onNavigate={onTabChange || (() => {})} />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleNotification(); }}
            className={`p-2 rounded-xl transition-all relative ${
              isNotificationOpen
                ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="Notifications"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-2 right-2 w-[7px] h-[7px] bg-[#5D5FEF] rounded-full ring-2 ring-white" />
            )}
          </button>
          <NotificationDropdown
            isOpen={isNotificationOpen}
            onClose={handleNotificationClose}
            onNavigate={onTabChange || (() => {})}
          />
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-100 mx-1" />

        {/* Profile */}
        <div className="relative">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleProfile(); }}
            className={`w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center bg-[#5D5FEF] transition-all ring-2 ring-offset-1 ${
              isProfileOpen ? 'ring-[#5D5FEF]/50' : 'ring-transparent hover:ring-[#5D5FEF]/20'
            }`}
            aria-label="Profile"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="User" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-black text-[12px] leading-none">
                {user?.firstName?.[0]?.toUpperCase() || 'A'}
              </span>
            )}
          </button>
          <ProfileDropdown
            isOpen={isProfileOpen}
            onToggle={toggleProfile}
            onClose={closeProfile}
            onAccountSettings={handleAccountSettings}
            onSecurityVault={handleSecurityVault}
            onNavigate={onTabChange}
            onSignOut={onSignOut}
            user={user}
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
