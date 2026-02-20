import React, { useState, useEffect, useCallback } from 'react';
import { Bell, AlertCircle, CheckCircle, Info, AlertTriangle, CheckCheck } from 'lucide-react';
import { authApi } from '@/services/api.client';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  timestamp: number;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'error';
  category: 'system' | 'security' | 'storage' | 'update';
  createdAt: string;
}

const NotificationsView: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'security' | 'system'>('all');

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await authApi.getNotifications(100);
      setNotifications(data.notifications || []);
    } catch (e) {
      // Silent — notifications UI shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (notificationId: string) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
    try {
      await authApi.markNotificationRead(parseInt(notificationId, 10));
    } catch (e) {
      // Best-effort — optimistic update already applied
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await authApi.markAllNotificationsRead();
    } catch (e) {
      // Best-effort — optimistic update already applied
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusColor = (type: string, read: boolean) => {
    if (read) return 'bg-white hover:bg-gray-50';
    switch (type) {
      case 'warning':
        return 'bg-amber-50 hover:bg-amber-100/50';
      case 'error':
        return 'bg-red-50 hover:bg-red-100/50';
      case 'success':
        return 'bg-green-50 hover:bg-green-100/50';
      default:
        return 'bg-blue-50 hover:bg-blue-100/50';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'security':
        return { label: 'Security', color: 'bg-red-100 text-red-700' };
      case 'storage':
        return { label: 'Storage', color: 'bg-purple-100 text-purple-700' };
      case 'update':
        return { label: 'Update', color: 'bg-blue-100 text-blue-700' };
      default:
        return { label: 'System', color: 'bg-gray-100 text-gray-700' };
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'security') return n.category === 'security';
    if (filter === 'system') return n.category === 'system';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const formatFullTime = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    if (isToday) return `Today at ${time}`;
    if (isYesterday) return `Yesterday at ${time}`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ` at ${time}`;
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] sm:text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 mb-1">
          Notifications
        </h1>
        <p className="text-gray-400 font-medium text-[14px]">
          {loading ? 'Loading...' : `${notifications.length} notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        </p>
      </div>

      {/* Filter chips — horizontally scrollable on mobile */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap sm:flex-nowrap">
        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
          {[
            { key: 'all', label: 'All' },
            { key: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
            { key: 'security', label: 'Security' },
            { key: 'system', label: 'System' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-3.5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all active:scale-95 touch-manipulation ${
                filter === key
                  ? 'bg-[#5D5FEF] text-white shadow-md shadow-[#5D5FEF]/20'
                  : 'bg-white text-gray-600 border border-gray-200/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-bold text-[#5D5FEF] bg-[#5D5FEF]/5 active:bg-[#5D5FEF]/10 transition-all whitespace-nowrap touch-manipulation flex-shrink-0"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200/60 px-6 py-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-[#5D5FEF]/5 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-[#5D5FEF]/40 animate-pulse" />
            </div>
            <p className="text-[15px] font-bold text-gray-400">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification) => {
            const catInfo = getCategoryLabel(notification.category);
            return (
              <div
                key={notification.id}
                onClick={() => !notification.read && handleMarkRead(notification.id)}
                className={`rounded-2xl border transition-all active:scale-[0.98] touch-manipulation ${
                  !notification.read
                    ? 'bg-white border-[#5D5FEF]/15 shadow-md shadow-[#5D5FEF]/5'
                    : 'bg-white border-gray-200/60 shadow-sm'
                }`}
              >
                <div className="px-4 py-4 flex items-start gap-3">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    !notification.read ? 'bg-[#5D5FEF]/5' : 'bg-gray-50'
                  }`}>
                    {getIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-[14px] font-bold truncate ${
                        !notification.read ? 'text-gray-900' : 'text-gray-600'
                      }`}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-[#5D5FEF] flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${catInfo.color}`}>
                        {catInfo.label}
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium">{notification.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200/60 px-6 py-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-[16px] font-bold text-gray-400 mb-1">
              {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
            </p>
            <p className="text-[13px] text-gray-400 max-w-[260px] mx-auto">
              {filter === 'all'
                ? 'Notifications will appear here when events occur on your server.'
                : 'Try switching to a different filter.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsView;
