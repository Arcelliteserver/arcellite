import React from 'react';
import { ChevronRight, HelpCircle, Bell, Menu } from 'lucide-react';
import { authApi } from '../../services/api.client';
import SearchBar from './SearchBar';
import ProfileDropdown from './ProfileDropdown';
import HelpDropdown from './HelpDropdown';
import NotificationDropdown from './NotificationDropdown';
import type { UserData } from '../../App';

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

  // Play notification sound — creates a fresh Audio element each time for reliability
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

  // Unlock audio on first user interaction (browsers require user gesture for audio)
  React.useEffect(() => {
    const unlockAudio = () => {
      // Create a throwaway audio element to unlock the audio context
      const testSound = new Audio('/audio/notification.wav');
      testSound.volume = 0;
      testSound.play().then(() => {
        testSound.pause();
        audioUnlockedRef.current = true;
      }).catch(() => {
        // Even if the first play fails, mark as unlocked — subsequent user-gesture–initiated plays may still work
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

  // Fetch unread notification count on mount and periodically
  React.useEffect(() => {
    const fetchCount = () => {
      authApi.getNotifications(50)
        .then(data => {
          const unread = (data.notifications || []).filter((n: any) => !n.read).length;
          // Play sound when new notifications arrive (not on initial load)
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
    const interval = setInterval(fetchCount, 6000);
    return () => clearInterval(interval);
  }, [playNotificationSound]);

  const toggleProfile = () => {
    setIsProfileOpen(!isProfileOpen);
    setIsHelpOpen(false);
    setIsNotificationOpen(false);
  };

  const closeProfile = () => setIsProfileOpen(false);

  const toggleHelp = () => {
    setIsHelpOpen(!isHelpOpen);
    setIsProfileOpen(false);
    setIsNotificationOpen(false);
  };

  const closeHelp = () => setIsHelpOpen(false);

  const toggleNotification = () => {
    setIsNotificationOpen(!isNotificationOpen);
    setIsProfileOpen(false);
    setIsHelpOpen(false);
  };

  const closeNotification = () => setIsNotificationOpen(false);

  // Refresh unread count when dropdown closes
  const handleNotificationClose = () => {
    closeNotification();
    authApi.getNotifications(50)
      .then(data => {
        const unread = (data.notifications || []).filter((n: any) => !n.read).length;
        setUnreadNotificationCount(unread);
      })
      .catch(() => {});
  };

  const handleAccountSettings = () => {
    onAccountSettings();
    closeProfile();
  };

  const handleSecurityVault = () => {
    onSecurityVault();
    closeProfile();
  };

  return (
    <header className={`fixed md:relative top-0 left-0 right-0 md:inset-y-auto md:left-auto md:right-auto z-[200] h-14 sm:h-16 md:h-20 flex items-center justify-between px-3 sm:px-4 md:px-6 lg:px-10 bg-white/80 backdrop-blur-md border-b border-gray-50/50 pt-safe-area-inset-top md:pt-0 transition-all duration-200 ${
      hasActiveModal ? 'opacity-50 pointer-events-none' : ''
    }`}>
      {/* Mobile Menu Button */}
      <button
        onClick={onMobileMenuToggle}
        className="md:hidden p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-all flex-shrink-0"
        aria-label="Toggle menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop Sidebar Toggle (visible when sidebar is collapsed) */}
      {sidebarCollapsed && onSidebarToggle && (
        <button
          onClick={onSidebarToggle}
          className="hidden md:flex p-2 -ml-2 mr-2 rounded-lg text-gray-400 hover:text-[#5D5FEF] hover:bg-gray-50 transition-all flex-shrink-0 group"
          aria-label="Show sidebar"
          title="Show sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" className="fill-current">
            <path d="M320-240 80-480l240-240 57 57-184 184 183 183-56 56Zm320 0-57-57 184-184-183-183 56-56 240 240-240 240Z"/>
          </svg>
        </button>
      )}

      {/* Breadcrumb - Left side */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 text-[10px] sm:text-xs md:text-sm text-gray-400 font-medium flex-shrink-0 min-w-0">
        <span
          className="cursor-pointer hover:text-[#5D5FEF] transition-colors whitespace-nowrap"
          onClick={() => onNavigate(null)}
        >
          Vault
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
        <span className="text-gray-900 font-bold capitalize truncate">
          {activeTab === 'all' ? 'Files' : activeTab === 'overview' ? 'Overview' : activeTab === 'usb' ? 'USB' : activeTab === 'drive' ? 'Drive' : activeTab.replace('-', ' ')}
        </span>
      </div>

      {/* Search Bar - Centered/Right Desktop Only */}
      <div className="hidden md:flex flex-1 max-w-md lg:max-w-xl mx-4 lg:mx-8 justify-end">
        <div className="w-full max-w-md">
          <SearchBar value={searchQuery} onChange={onSearchChange} />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 flex-shrink-0">
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleHelp();
            }}
            className={`p-2 md:p-2.5 rounded-xl transition-all relative ${
              isHelpOpen ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]' : 'text-gray-400 hover:bg-gray-50'
            }`}
            aria-label="Help"
          >
            <HelpCircle className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <HelpDropdown
            isOpen={isHelpOpen}
            onClose={closeHelp}
            onNavigate={onTabChange || (() => {})}
          />
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleNotification();
            }}
            className={`p-2 md:p-2.5 rounded-xl transition-all relative ${
              isNotificationOpen ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]' : 'text-gray-400 hover:bg-gray-50'
            }`}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 md:w-5 md:h-5" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-2 md:top-2.5 right-2 md:right-2.5 w-1.5 h-1.5 bg-[#5D5FEF] rounded-full animate-pulse" />
            )}
          </button>
          <NotificationDropdown
            isOpen={isNotificationOpen}
            onClose={handleNotificationClose}
            onNavigate={onTabChange || (() => {})}
          />
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleProfile();
            }}
            className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-transparent hover:border-[#5D5FEF]/30 transition-all shadow-sm flex items-center justify-center bg-[#5D5FEF]"
            aria-label="Profile"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="User" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-black text-sm">
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
