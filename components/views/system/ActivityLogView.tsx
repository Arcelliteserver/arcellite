import React, { useState, useEffect } from 'react';
import { Activity, Upload, Download, Share2, Trash2, Edit, FileText, LogIn, UserPlus, Settings, Loader2 } from 'lucide-react';
import { authApi } from '../../../services/api.client';

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
      <div className="mb-10">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            Activity Log
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <p className="text-gray-500 font-medium text-sm pl-3 sm:pl-4 md:pl-6">View all your recent activities</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#5D5FEF] animate-spin" />
        </div>
      ) : activities.length > 0 ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-4 p-5 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getColor(activity.action)}`}>
                  {getIcon(activity.action)}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-gray-900">
                    {getLabel(activity.action)}
                  </p>
                  {activity.details && (
                    <p className="text-[12px] text-gray-500 mt-0.5">{activity.details}</p>
                  )}
                </div>
                <span className="text-[11px] font-bold text-gray-400">{formatTime(activity.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-gray-100 p-12 text-center">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-black text-gray-900 mb-2">No Activity Yet</h3>
          <p className="text-gray-500 text-sm">Your activity log will appear here as you use Arcellite</p>
        </div>
      )}
    </div>
  );
};

export default ActivityLogView;
