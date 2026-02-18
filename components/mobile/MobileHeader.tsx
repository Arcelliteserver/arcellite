import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Search, X } from 'lucide-react';
import { authApi } from '../../services/api.client';

interface MobileHeaderProps {
  title: string;
  user: { firstName?: string | null; lastName?: string | null; avatarUrl?: string | null } | null;
  onProfileClick: () => void;
  onNotificationsClick: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  showSearch?: boolean;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  user,
  onProfileClick,
  onNotificationsClick,
  searchQuery = '',
  onSearchChange,
  showSearch = false,
}) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const prevUnreadRef = useRef<number>(0);
  const audioUnlockedRef = useRef(false);
  const isFirstFetchRef = useRef(true);

  // Play notification sound — creates a fresh Audio element each time for reliability
  const playNotificationSound = useCallback(() => {
    if (!audioUnlockedRef.current) return;
    try {
      const sound = new Audio('/audio/notification.wav');
      sound.volume = 0.5;
      sound.play().catch((e) => console.warn('[Notification] Sound play failed:', e.message));
    } catch (e) {
      console.warn('[Notification] Sound error:', e);
    }
  }, []);

  // Unlock audio on first user interaction (mobile browsers require user gesture)
  useEffect(() => {
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

  useEffect(() => {
    const fetchCount = () => {
      authApi.getNotifications(50)
        .then(data => {
          const count = (data.notifications || []).filter((n: any) => !n.read).length;
          // Play sound when new notifications arrive (not on initial load)
          if (!isFirstFetchRef.current && count > prevUnreadRef.current) {
            playNotificationSound();
          }
          isFirstFetchRef.current = false;
          prevUnreadRef.current = count;
          setUnreadCount(count);
        })
        .catch(() => {});
    };
    fetchCount();
    const id = setInterval(fetchCount, 6000);
    return () => clearInterval(id);
  }, [playNotificationSound]);

  return (
    <header className="fixed top-0 left-0 right-0 z-[200] safe-area-top">
      <div className="flex items-center gap-3 px-5 h-[72px] pt-1">
        {/* Search input — individual container with border */}
        <div className="flex-1 relative">
          <div className="flex items-center h-[48px] bg-white border border-gray-200/80 rounded-[14px] px-3.5 shadow-sm">
            <Search className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search files..."
              className="flex-1 ml-3 text-[15px] font-medium text-gray-900 placeholder:text-gray-400 bg-transparent focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange?.('')}
                className="p-1 text-gray-400 active:scale-90 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Notification Bell — individual container with border */}
        <button
          onClick={onNotificationsClick}
          className="w-[48px] h-[48px] flex items-center justify-center active:scale-95 transition-all relative flex-shrink-0 bg-white border border-gray-200/80 rounded-[14px] shadow-sm"
          aria-label="Notifications"
        >
          <Bell className="w-[21px] h-[21px] text-gray-700" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#5D5FEF] rounded-full animate-pulse shadow-sm shadow-[#5D5FEF]/50" />
          )}
        </button>
      </div>
    </header>
  );
};

export default MobileHeader;
