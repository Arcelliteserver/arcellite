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
    <header className="fixed top-0 left-0 right-0 z-[200] bg-white safe-area-top">
      <div className="flex items-center gap-3 px-5 h-16">
        {/* Search Bar */}
        <div className="flex-1 relative">
          <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-4 h-[46px] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <Search className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search files..."
              className="flex-1 ml-3 text-[15px] font-medium text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange?.('')}
                className="p-1 -mr-1 text-gray-400 active:scale-90 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Notification Bell */}
        <button
          onClick={onNotificationsClick}
          className="w-[46px] h-[46px] flex items-center justify-center bg-white border border-gray-200 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-95 transition-all relative flex-shrink-0"
          aria-label="Notifications"
        >
          <Bell className="w-[20px] h-[20px] text-gray-700" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-[#5D5FEF] text-white text-[10px] font-bold rounded-full border-2 border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

export default MobileHeader;
