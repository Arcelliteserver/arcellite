import React, { useState, useEffect } from 'react';
import { Users, ExternalLink, FileText, Image, File, Video, Music, RefreshCw, ChevronRight, Loader2, FolderDown, MessageSquare, Database as DatabaseIcon, LayoutGrid, List } from 'lucide-react';

interface GoogleFile {
  id: string;
  name: string;
  type?: string;
  mimeType?: string;
  webViewLink?: string;
  url?: string;
  size?: number | string;
  modifiedTime?: string;
  modified?: string;
  created?: string;
  thumbnailLink?: string;
  iconLink?: string;
  [key: string]: any;
}

interface DiscordChannel {
  id: string;
  name: string;
  type?: string;
}

interface ConnectedApp {
  id: string;
  name: string;
  icon: string;
  description?: string;
  category?: string;
  status: 'available' | 'connected' | 'disconnected' | 'error' | 'connecting';
  statusMessage?: string;
  webhookUrl?: string;
  files?: GoogleFile[];
  discordChannels?: DiscordChannel[];
  children?: ConnectedApp[];
}

interface SharedViewProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const SharedView: React.FC<SharedViewProps> = ({ showToast }) => {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [savingFile, setSavingFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Load connected apps from localStorage, with server fallback
  useEffect(() => {
    // Filter apps that are connected AND have content (files or channels)
    // Does NOT depend on connectedAppIds — just checks app.status directly
    const filterConnected = (allApps: any[]) => {
      return allApps.filter((app: ConnectedApp) =>
        app.status === 'connected' && (
          (app.files && app.files.length > 0) ||
          (app.discordChannels && app.discordChannels.length > 0)
        )
      );
    };

    const loadConnectedApps = () => {
      try {
        const savedApps = localStorage.getItem('connectedApps');

        if (savedApps) {
          const allApps = JSON.parse(savedApps);
          if (Array.isArray(allApps)) {
            const connectedApps = filterConnected(allApps);
            setApps(connectedApps);
            setExpandedApps(new Set(connectedApps.map((app: ConnectedApp) => app.id)));
          }
        }
      } catch (e) {
        // Silent — UI shows empty state
      } finally {
        setLoading(false);
      }
    };

    // Also try loading from server (cross-device sync)
    const loadFromServer = async () => {
      try {
        const token = localStorage.getItem('sessionToken');
        if (!token) return;
        const resp = await fetch('/api/apps/connections', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.apps && Array.isArray(data.apps) && data.apps.length > 0) {
          // Sync to localStorage
          localStorage.setItem('connectedApps', JSON.stringify(data.apps));
          const connectedApps = filterConnected(data.apps);
          if (connectedApps.length > 0) {
            setApps(connectedApps);
            setExpandedApps(new Set(connectedApps.map((app: ConnectedApp) => app.id)));
          }
        }
      } catch {
        // Silent — localStorage data is used as fallback
      }
    };

    loadConnectedApps();
    loadFromServer();

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

  const handleRefresh = async () => {
    setRefreshing(true);

    const filterConnected = (allApps: any[]) => {
      return allApps.filter((app: ConnectedApp) =>
        app.status === 'connected' && (
          (app.files && app.files.length > 0) ||
          (app.discordChannels && app.discordChannels.length > 0)
        )
      );
    };

    // Try loading fresh data from server first
    try {
      const token = localStorage.getItem('sessionToken');
      if (token) {
        const resp = await fetch('/api/apps/connections', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.apps && Array.isArray(data.apps)) {
            localStorage.setItem('connectedApps', JSON.stringify(data.apps));
            const connectedApps = filterConnected(data.apps);
            setApps(connectedApps);
            setExpandedApps(new Set(connectedApps.map((app: ConnectedApp) => app.id)));
            setRefreshing(false);
            return;
          }
        }
      }
    } catch {}

    // Fallback to localStorage
    const savedApps = localStorage.getItem('connectedApps');
    if (savedApps) {
      const allApps = JSON.parse(savedApps);
      const connectedApps = filterConnected(allApps);
      setApps(connectedApps);
    }

    setRefreshing(false);
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

  const handleFileClick = (file: GoogleFile) => {
    const link = file.webViewLink || file.url;
    if (link) {
      window.open(link, '_blank');
    }
  };

  const handleSaveToVault = async (file: GoogleFile, app: ConnectedApp) => {
    if (savingFile) return;
    setSavingFile(file.id);
    showToast?.(`Saving "${file.name}" to vault...`, 'info');

    try {
      const response = await fetch('/api/files/save-shared', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          fileName: file.name,
          mimeType: file.mimeType,
          appId: app.id,
          webhookUrl: app.webhookUrl,
        }),
      });

      const result = await response.json();
      if (result.ok) {
        showToast?.(`Saved "${result.savedFileName}" to ${result.category}`, 'success');
      } else {
        showToast?.(result.error || 'Failed to save file', 'error');
      }
    } catch (e) {
      showToast?.(`Save failed: ${(e as Error).message}`, 'error');
    } finally {
      setSavingFile(null);
    }
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

  const totalFiles = apps.reduce((sum, app) => sum + (app.files?.length || 0) + (app.discordChannels?.length || 0), 0);

  /** Resolve thumbnail URL from various API formats (Google Drive, OneDrive/Graph, etc.) */
  const getFileThumbnail = (file: GoogleFile): string | null => {
    // Google Drive direct thumbnailLink
    if (file.thumbnailLink) return file.thumbnailLink;
    // OneDrive / MS Graph: thumbnail object with url
    if (file.thumbnail) {
      if (typeof file.thumbnail === 'string') return file.thumbnail;
      if (file.thumbnail.large?.url) return file.thumbnail.large.url;
      if (file.thumbnail.medium?.url) return file.thumbnail.medium.url;
      if (file.thumbnail.small?.url) return file.thumbnail.small.url;
      if (file.thumbnail.url) return file.thumbnail.url;
    }
    // OneDrive thumbnails array
    if (file.thumbnails && Array.isArray(file.thumbnails) && file.thumbnails.length > 0) {
      const t = file.thumbnails[0];
      if (t.large?.url) return t.large.url;
      if (t.medium?.url) return t.medium.url;
      if (t.small?.url) return t.small.url;
    }
    // MS Graph download URL for images — can serve as thumbnail
    const isImageMime = file.mimeType?.startsWith('image/') || ['image'].includes(file.type || '');
    if (isImageMime && file['@microsoft.graph.downloadUrl']) return file['@microsoft.graph.downloadUrl'];
    if (isImageMime && file.downloadUrl) return file.downloadUrl;
    // Dropbox thumbnail_link
    if (file.thumbnail_link) return file.thumbnail_link;
    return null;
  };

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
            {loading ? 'Loading...' : `${totalFiles} ${totalFiles === 1 ? 'item' : 'items'} from ${apps.length} connected ${apps.length === 1 ? 'app' : 'apps'}`}
          </p>
          <div className="flex items-center gap-2">
            {/* Grid / List toggle */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#5D5FEF]' : 'text-gray-400 hover:text-gray-600'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#5D5FEF]' : 'text-gray-400 hover:text-gray-600'}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-[#5D5FEF] hover:bg-[#5D5FEF]/5 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
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

            const channels = app.discordChannels || [];
            const itemCount = files.length + channels.length;
            const isDiscord = app.id === 'discord';

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
                          {isDiscord
                            ? `${channels.length} ${channels.length === 1 ? 'channel' : 'channels'}`
                            : `${files.length} ${files.length === 1 ? 'file' : 'files'}`
                          }
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

                {/* Discord Channels List */}
                {isExpanded && isDiscord && channels.length > 0 && (
                  <div className="divide-y divide-gray-50">
                    {channels.map((channel, idx) => (
                      <div
                        key={channel.id || idx}
                        className="px-8 py-5 hover:bg-gray-50 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20 flex items-center justify-center shadow-sm flex-shrink-0">
                            <MessageSquare className="w-5 h-5 text-[#5865F2]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-bold text-gray-900 truncate group-hover:text-[#5865F2] transition-colors">
                              #{channel.name}
                            </p>
                            {channel.type && (
                              <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                                {channel.type} channel
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Files — List View */}
                {isExpanded && files.length > 0 && viewMode === 'list' && (
                  <div className="divide-y divide-gray-50">
                    {files.map((file, idx) => (
                      <div
                        key={file.id || idx}
                        onClick={() => handleFileClick(file)}
                        className="px-8 py-5 hover:bg-gray-50 transition-all group cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm flex-shrink-0">
                            {(() => {
                              const thumb = getFileThumbnail(file);
                              if (thumb) return <img src={thumb} alt={file.name} className="w-full h-full object-cover rounded-xl" />;
                              if (file.iconLink) return <img src={file.iconLink} alt={file.name} className="w-6 h-6" />;
                              return getFileIcon(file);
                            })()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-bold text-gray-900 truncate group-hover:text-[#5D5FEF] transition-colors">
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

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Save to Vault */}
                            {app.id !== 'n8n' && app.id !== 'mcp' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSaveToVault(file, app); }}
                                disabled={savingFile === file.id}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-50"
                                title="Save to Vault"
                              >
                                {savingFile === file.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <FolderDown className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            {/* Open in browser */}
                            {(file.webViewLink || file.url) && (
                              <a
                                href={file.webViewLink || file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-[#5D5FEF] hover:bg-[#5D5FEF]/10 transition-all"
                                title="Open in browser"
                              >
                                <ExternalLink className="w-4 h-4" />
                                <span className="hidden sm:inline">Open</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Files — Grid View */}
                {isExpanded && files.length > 0 && viewMode === 'grid' && (
                  <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                      {files.map((file, idx) => {
                        const isAudioFile = file.type === 'audio';
                        const thumbnail = getFileThumbnail(file);
                        return (
                          <div
                            key={file.id || idx}
                            onClick={() => handleFileClick(file)}
                            className="bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer group hover:shadow-lg hover:border-[#5D5FEF]/30 transition-all active:scale-[0.97]"
                          >
                            {/* Thumbnail area */}
                            <div className="w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden relative">
                              {thumbnail ? (
                                <img
                                  src={thumbnail}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : isAudioFile ? (
                                <img
                                  src="/images/music_placeholder.png"
                                  alt="Music"
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : file.iconLink ? (
                                <img
                                  src={file.iconLink}
                                  alt={file.name}
                                  className="w-10 h-10"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                                  {getFileIcon(file)}
                                </div>
                              )}
                              {/* Hover actions */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-end justify-end p-2 opacity-0 group-hover:opacity-100">
                                <div className="flex gap-1">
                                  {app.id !== 'n8n' && app.id !== 'mcp' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSaveToVault(file, app); }}
                                      disabled={savingFile === file.id}
                                      className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-white transition-all disabled:opacity-50"
                                      title="Save to Vault"
                                    >
                                      {savingFile === file.id ? (
                                        <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                                      ) : (
                                        <FolderDown className="w-3.5 h-3.5 text-emerald-600" />
                                      )}
                                    </button>
                                  )}
                                  {(file.webViewLink || file.url) && (
                                    <a
                                      href={file.webViewLink || file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-white transition-all"
                                      title="Open in browser"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-[#5D5FEF]" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* File info */}
                            <div className="px-3 py-2.5">
                              <p className="text-[12px] font-bold text-gray-900 truncate group-hover:text-[#5D5FEF] transition-colors">{file.name}</p>
                              <p className="text-[10px] text-gray-400 font-medium mt-0.5 truncate">
                                {formatFileSize(file.size)}
                                {file.modifiedTime ? ` · ${formatDate(file.modifiedTime)}` : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
            Click any file to open it in your browser, or use the save button to download it to your vault.
            To connect more apps or manage existing connections, visit the <strong>My Apps</strong> section.
          </p>
        </div>
      )}

    </div>
  );
};

export default SharedView;
