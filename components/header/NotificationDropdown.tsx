import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Bell, AlertCircle, CheckCircle, Info, AlertTriangle, Settings, CheckCheck, Trash2 } from 'lucide-react';
import { authApi } from '../../services/api.client';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  timestamp: number;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'error';
  category: 'system' | 'security' | 'storage' | 'update';
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose, onNavigate }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await authApi.getNotifications(30);
      setNotifications(data.notifications || []);
    } catch (e) {
      // Silent — notifications UI shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleNavigate = (tab: string) => {
    onNavigate(tab);
    onClose();
  };

  const handleMarkRead = async (notificationId: string) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
    try {
      await authApi.markNotificationRead(parseInt(notificationId, 10));
    } catch (e) {
      // Best-effort
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await authApi.markAllNotificationsRead();
    } catch (e) {
      // Best-effort
    }
  };

  const handleClearAll = async () => {
    setNotifications([]);
    try {
      await authApi.clearAllNotifications();
    } catch (e) {
      // Best-effort
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusColor = (type: string, read: boolean) => {
    if (read) return 'bg-white';
    switch (type) {
      case 'warning':
        return 'bg-amber-50';
      case 'error':
        return 'bg-red-50';
      case 'success':
        return 'bg-green-50';
      default:
        return 'bg-blue-50';
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-auto sm:mt-3 w-[calc(100vw-1rem)] sm:w-96 max-w-sm sm:max-w-none bg-white rounded-2xl sm:rounded-[2rem] shadow-2xl shadow-gray-200 border border-gray-100 py-3 z-[500] animate-in fade-in zoom-in duration-200 origin-top-right overflow-hidden" ref={dropdownRef}>
      <div className="px-6 py-4 bg-[#F5F5F7]/50 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5D5FEF]/10 rounded-2xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-[#5D5FEF]" />
          </div>
          <div>
            <p className="text-[15px] font-black text-gray-900">Notifications</p>
            <p className="text-[11px] font-bold text-gray-400">
              {loading ? 'Loading...' : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-2 hover:bg-white rounded-xl transition-all"
              aria-label="Clear all notifications"
              title="Clear all"
            >
              <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="p-2 hover:bg-white rounded-xl transition-all"
              aria-label="Mark all as read"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4 text-gray-400 hover:text-[#5D5FEF]" />
            </button>
          )}
          <button
            onClick={() => handleNavigate('notifications')}
            className="p-2 hover:bg-white rounded-xl transition-all"
            aria-label="View all notifications"
          >
            <Settings className="w-4 h-4 text-gray-400 hover:text-[#5D5FEF]" />
          </button>
        </div>
      </div>

      <div className="max-h-[calc(100vh-250px)] sm:max-h-96 overflow-y-auto px-2 py-2 space-y-1 custom-scrollbar">
        {loading ? (
          <div className="px-4 py-8 text-center">
            <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3 animate-pulse" />
            <p className="text-sm sm:text-[14px] font-bold text-gray-400">Loading notifications...</p>
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => !notification.read && handleMarkRead(notification.id)}
              className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all cursor-pointer hover:bg-[#F5F5F7] min-h-[44px] flex items-start gap-3 ${getStatusColor(notification.type, notification.read)}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm sm:text-[14px] font-bold mb-0.5 ${
                  !notification.read ? 'text-gray-900' : 'text-gray-600'
                }`}>
                  {notification.title}
                </p>
                <p className="text-[11px] sm:text-[12px] text-gray-500 mb-1 line-clamp-2">
                  {notification.message}
                </p>
                <p className="text-[10px] sm:text-[11px] text-gray-400">{notification.time}</p>
              </div>
              {!notification.read && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-2 h-2 rounded-full bg-[#5D5FEF]" />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="px-4 py-8 text-center">
            <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm sm:text-[14px] font-bold text-gray-400">No notifications</p>
          </div>
        )}
      </div>

      <div className="px-2 pt-2 border-t border-gray-50">
        <button
          onClick={() => handleNavigate('notifications')}
          className="w-full px-4 sm:px-5 py-3 text-sm sm:text-[14px] font-bold text-[#5D5FEF] hover:bg-[#5D5FEF]/5 rounded-xl sm:rounded-2xl transition-all min-h-[44px]"
        >
          View All Notifications
        </button>
      </div>
    </div>
  );
};

export default NotificationDropdown;
