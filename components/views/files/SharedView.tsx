import React, { useState, useEffect } from 'react';
import { Users, ExternalLink, FileText, Image, File, Video, Music, Download, RefreshCw, ChevronRight } from 'lucide-react';

interface GoogleFile {
  id: string;
  name: string;
  type: 'doc' | 'sheet' | 'slide' | 'folder' | 'file' | 'image' | 'video' | 'audio';
  mimeType?: string;
  webViewLink?: string;
  size?: number;
  modifiedTime?: string;
  thumbnailLink?: string;
  iconLink?: string;
}

interface ConnectedApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  status: 'available' | 'connected' | 'error' | 'connecting';
  statusMessage?: string;
  webhookUrl?: string;
  files?: GoogleFile[];
  children?: ConnectedApp[];
}

const SharedView: React.FC = () => {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Load connected apps from localStorage
  useEffect(() => {
    const loadConnectedApps = () => {
      try {
        const savedApps = localStorage.getItem('connectedApps');
        const savedConnected = localStorage.getItem('connectedAppIds');

        if (savedApps && savedConnected) {
          const allApps = JSON.parse(savedApps);
          const connectedIds = JSON.parse(savedConnected);

          // Filter to only show connected apps with files
          const connectedApps = allApps.filter((app: ConnectedApp) =>
            connectedIds.includes(app.id) && app.status === 'connected' && app.files && app.files.length > 0
          );

          setApps(connectedApps);
          // Auto-expand all apps by default
          setExpandedApps(new Set(connectedApps.map((app: ConnectedApp) => app.id)));
        }
      } catch (e) {
        // Silent — UI shows empty state
      } finally {
        setLoading(false);
      }
    };

    loadConnectedApps();

    // Listen for localStorage changes (when apps are connected/disconnected)
    const handleStorageChange = () => {
      loadConnectedApps();
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event from MyAppsView
    window.addEventListener('apps-updated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('apps-updated', handleStorageChange);
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    const savedApps = localStorage.getItem('connectedApps');
    const savedConnected = localStorage.getItem('connectedAppIds');

    if (savedApps && savedConnected) {
      const allApps = JSON.parse(savedApps);
      const connectedIds = JSON.parse(savedConnected);
      const connectedApps = allApps.filter((app: ConnectedApp) =>
        connectedIds.includes(app.id) && app.status === 'connected' && app.files && app.files.length > 0
      );
      setApps(connectedApps);
    }

    setTimeout(() => setRefreshing(false), 500);
  };

  const toggleAppExpand = (appId: string) => {
    setExpandedApps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(appId)) {
        newSet.delete(appId);
      } else {
        newSet.add(appId);
      }
      return newSet;
    });
  };

  const getFileIcon = (file: GoogleFile) => {
    switch (file.type) {
      case 'image':
        return <Image className="w-5 h-5 text-blue-500" />;
      case 'video':
        return <Video className="w-5 h-5 text-purple-500" />;
      case 'audio':
        return <Music className="w-5 h-5 text-green-500" />;
      case 'doc':
      case 'sheet':
      case 'slide':
        return <FileText className="w-5 h-5 text-orange-500" />;
      default:
        return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totalFiles = apps.reduce((sum, app) => sum + (app.files?.length || 0), 0);

  return (
    <div className="w-full">
      {/* Header with Divider */}
      <div className="mb-10">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            Shared Files
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <div className="flex items-center justify-between pl-3 sm:pl-4 md:pl-6">
          <p className="text-gray-500 font-medium text-sm">
            {loading ? 'Loading...' : `${totalFiles} files from ${apps.length} connected ${apps.length === 1 ? 'app' : 'apps'}`}
          </p>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-[#5D5FEF] hover:bg-[#5D5FEF]/5 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Connected Apps with Files */}
      {loading ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 p-12 flex items-center justify-center">
          <Users className="w-12 h-12 text-gray-300 animate-pulse" />
        </div>
      ) : apps.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-gray-100 p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-black text-gray-900 mb-2">No Connected Apps</h3>
          <p className="text-gray-500 text-sm mb-4">
            Connect apps like Google Drive, OneDrive, or Slack to see shared files here
          </p>
          <button
            onClick={() => {
              // Navigate to My Apps
              const event = new CustomEvent('navigate-to-apps');
              window.dispatchEvent(event);
            }}
            className="px-6 py-3 bg-[#5D5FEF] text-white rounded-xl font-bold text-[13px] hover:bg-[#4D4FCF] transition-all"
          >
            Connect Apps
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {apps.map((app) => {
            const isExpanded = expandedApps.has(app.id);
            const files = app.files || [];

            return (
              <div key={app.id} className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
                {/* App Header */}
                <div
                  onClick={() => toggleAppExpand(app.id)}
                  className="px-8 py-6 bg-[#F5F5F7]/50 border-b border-gray-100 cursor-pointer hover:bg-[#F5F5F7] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                        <img src={app.icon} alt={app.name} className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-black text-gray-900">{app.name}</h3>
                        <p className="text-[11px] font-bold text-gray-400">
                          {files.length} {files.length === 1 ? 'file' : 'files'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Files List */}
                {isExpanded && (
                  <div className="divide-y divide-gray-50">
                    {files.map((file, idx) => (
                      <div
                        key={file.id || idx}
                        className="px-8 py-5 hover:bg-gray-50 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm flex-shrink-0">
                            {file.thumbnailLink ? (
                              <img
                                src={file.thumbnailLink}
                                alt={file.name}
                                className="w-full h-full object-cover rounded-xl"
                              />
                            ) : file.iconLink ? (
                              <img
                                src={file.iconLink}
                                alt={file.name}
                                className="w-6 h-6"
                              />
                            ) : (
                              getFileIcon(file)
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-bold text-gray-900 truncate">
                              {file.name}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-[11px] text-gray-400 font-medium">
                                {formatFileSize(file.size)}
                              </p>
                              {file.modifiedTime && (
                                <>
                                  <span className="text-gray-300">·</span>
                                  <p className="text-[11px] text-gray-400">
                                    {formatDate(file.modifiedTime)}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>

                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-[#5D5FEF] hover:bg-[#5D5FEF]/10 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Open
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      {apps.length > 0 && (
        <div className="mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
          <h3 className="text-[13px] font-black text-gray-900 mb-2">About Shared Files</h3>
          <p className="text-[12px] text-gray-600">
            This section displays files from all your connected apps in one place.
            To connect more apps or manage existing connections, visit the <strong>My Apps</strong> section.
          </p>
        </div>
      )}
    </div>
  );
};

export default SharedView;
