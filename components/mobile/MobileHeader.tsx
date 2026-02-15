import React, { useState, useEffect } from 'react';
import { Bell, Search, X } from 'lucide-react';

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

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/notifications/unread-count');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count || 0);
        }
      } catch {}
    };
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => clearInterval(id);
  }, []);

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
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-[#5D5FEF] text-white text-[10px] font-bold rounded-full border-[1.5px] border-[#F7F7F7]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

export default MobileHeader;
