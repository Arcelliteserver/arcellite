import React, { useState, useEffect, useCallback } from 'react';
import { Bell, AlertCircle, CheckCircle, Info, AlertTriangle, CheckCheck } from 'lucide-react';
import { authApi } from '../../../services/api.client';

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
      <div className="mb-8">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            Notifications
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <p className="text-gray-500 font-medium text-sm pl-3 sm:pl-4 md:pl-6">
          {loading ? 'Loading...' : `${notifications.length} notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        </p>
      </div>

      {/* Filter tabs + Mark all read */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
            { key: 'security', label: 'Security' },
            { key: 'system', label: 'System' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${
                filter === key
                  ? 'bg-[#5D5FEF] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-[#5D5FEF] hover:bg-[#5D5FEF]/5 transition-all"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-8 py-16 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4 animate-pulse" />
            <p className="text-[14px] font-bold text-gray-400">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {filteredNotifications.map((notification) => {
              const catInfo = getCategoryLabel(notification.category);
              return (
                <div
                  key={notification.id}
                  onClick={() => !notification.read && handleMarkRead(notification.id)}
                  className={`px-6 py-5 transition-all cursor-pointer flex items-start gap-4 ${getStatusColor(notification.type, notification.read)}`}
                >
                  <div className="flex-shrink-0 mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm border border-gray-100">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-[15px] font-black ${
                        !notification.read ? 'text-gray-900' : 'text-gray-600'
                      }`}>
                        {notification.title}
                      </p>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${catInfo.color}`}>
                        {catInfo.label}
                      </span>
                    </div>
                    <p className="text-[13px] text-gray-500 mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-3">
                      <p className="text-[11px] text-gray-400 font-medium">{notification.time}</p>
                      <span className="text-gray-300">·</span>
                      <p className="text-[11px] text-gray-400">{formatFullTime(notification.createdAt)}</p>
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="flex-shrink-0 mt-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#5D5FEF]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-8 py-16 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-[15px] font-black text-gray-400 mb-1">
              {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
            </p>
            <p className="text-[13px] text-gray-400">
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
