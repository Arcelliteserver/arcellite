import React, { useState, useEffect } from 'react';
import { Activity, Upload, Download, Share2, Trash2, Edit, FileText, LogIn, UserPlus, Settings, Loader2 } from 'lucide-react';
import { authApi } from '@/services/api.client';

interface ActivityItem {
  id: number;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const ActivityLogView: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const data = await authApi.getActivityLog(50);
        setActivities(data.activities || []);
      } catch (err) {
        // Silent — UI shows empty state
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, []);

  const getIcon = (action: string) => {
    const iconClass = 'w-4 h-4';
    switch (action) {
      case 'login':
        return <LogIn className={iconClass} />;
      case 'register':
        return <UserPlus className={iconClass} />;
      case 'upload':
        return <Upload className={iconClass} />;
      case 'download':
        return <Download className={iconClass} />;
      case 'share':
        return <Share2 className={iconClass} />;
      case 'delete':
        return <Trash2 className={iconClass} />;
      case 'edit':
      case 'profile_update':
        return <Edit className={iconClass} />;
      case 'create':
        return <FileText className={iconClass} />;
      case 'settings':
        return <Settings className={iconClass} />;
      default:
        return <Activity className={iconClass} />;
    }
  };

  const getColor = (action: string) => {
    switch (action) {
      case 'login':
        return 'bg-[#5D5FEF]/10 text-[#5D5FEF]';
      case 'register':
        return 'bg-green-50 text-green-600';
      case 'upload':
      case 'create':
        return 'bg-blue-50 text-blue-600';
      case 'download':
        return 'bg-green-50 text-green-600';
      case 'share':
        return 'bg-purple-50 text-purple-600';
      case 'delete':
        return 'bg-red-50 text-red-600';
      case 'edit':
      case 'profile_update':
        return 'bg-orange-50 text-orange-600';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  const getLabel = (action: string) => {
    switch (action) {
      case 'login': return 'Signed in';
      case 'register': return 'Account created';
      case 'upload': return 'Uploaded file';
      case 'download': return 'Downloaded file';
      case 'share': return 'Shared item';
      case 'delete': return 'Deleted item';
      case 'edit': return 'Edited file';
      case 'profile_update': return 'Updated profile';
      case 'create': return 'Created folder';
      case 'settings': return 'Changed settings';
      default: return action;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-full">
      {/* Top summary + context */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] font-medium text-gray-400">Recent account activity and events</p>
        {!loading && (
          <span className="text-[11px] font-bold text-gray-400">
            {activities.length} event{activities.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Summary cards (similar style to other System top cards) */}
      {!loading && activities.length > 0 && (() => {
        const now = new Date();
        const todayKey = now.toDateString();
        const todayCount = activities.filter(a => new Date(a.createdAt).toDateString() === todayKey).length;
        const loginCount = activities.filter(a => a.action === 'login').length;
        const fileActions = activities.filter(a =>
          ['upload', 'download', 'delete', 'create', 'edit', 'profile_update'].includes(a.action)
        ).length;
        const securityActions = activities.filter(a =>
          ['settings', 'profile_update'].includes(a.action)
        ).length;

        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {/* Events Today */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-indigo-600 flex items-center justify-center shadow-lg shadow-[#5D5FEF]/25">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Today</span>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">
                {todayCount}
              </p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">
                Events Today
              </p>
            </div>

            {/* Sign-ins */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <LogIn className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Accounts</span>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">
                {loginCount}
              </p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">
                Sign-ins
              </p>
            </div>

            {/* File activity */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-sky-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Vault</span>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">
                {fileActions}
              </p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">
                File Actions
              </p>
            </div>

            {/* Security & settings */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Security</span>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 leading-none">
                {securityActions}
              </p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">
                Security & Settings
              </p>
            </div>
          </div>
        );
      })()}

      {loading ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#5D5FEF] animate-spin" />
        </div>
      ) : activities.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-all group"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${getColor(activity.action)}`}>
                  {getIcon(activity.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-gray-900 truncate">
                    {getLabel(activity.action)}
                  </p>
                  {activity.details && (
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{activity.details}</p>
                  )}
                </div>
                <span className="text-[11px] font-medium text-gray-400 flex-shrink-0">{formatTime(activity.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Activity className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-[15px] font-black text-gray-900 mb-1">No Activity Yet</h3>
          <p className="text-[12px] text-gray-400">Your activity log will appear here as you use Arcellite</p>
        </div>
      )}
    </div>
  );
};

export default ActivityLogView;
