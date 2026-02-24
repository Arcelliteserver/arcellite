import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, FileText, Image, File, Video, Music,
  RefreshCw, Loader2, Trash2, Eye, Clock,
  Search, FolderOpen, X, Share2, ChevronLeft, Check
} from 'lucide-react';

const SHARE_ICON_SRC = '/assets/icons/share_windows_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
const KEEP_ICON_SRC = '/assets/icons/keep_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

interface SharedFileItem {
  id: number;
  filePath: string;
  fileName: string;
  fileType: string | null;
  category: string | null;
  sizeBytes: number;
  message: string | null;
  sharedAt: string;
  keptAt?: string | null;
  sender?: { id: number; name: string; avatarUrl: string | null };
  recipient?: { id: number; name: string; avatarUrl: string | null };
}

interface SharedViewProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const SharedView: React.FC<SharedViewProps> = ({ showToast }) => {
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [received, setReceived] = useState<SharedFileItem[]>([]);
  const [sent, setSent] = useState<SharedFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [keepingId, setKeepingId] = useState<number | null>(null);
  const [keptIds, setKeptIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewerFile, setViewerFile] = useState<SharedFileItem | null>(null);

  const fetchShares = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await fetch('/api/share/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Failed to load shares');
      const data = await resp.json();
      setReceived(data.received || []);
      setSent(data.sent || []);
      // Initialise keptIds from server data
      const alreadyKept = new Set<number>();
      (data.received || []).forEach((f: SharedFileItem) => { if (f.keptAt) alreadyKept.add(f.id); });
      setKeptIds(alreadyKept);
    } catch (e) {
      if (!quiet) showToast?.((e as Error).message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => { fetchShares(); }, [fetchShares]);

  const handleRemove = async (shareId: number) => {
    setRemovingId(shareId);
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await fetch(`/api/share/${shareId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Failed to remove');
      setReceived(prev => prev.filter(s => s.id !== shareId));
      setSent(prev => prev.filter(s => s.id !== shareId));
      showToast?.('Share removed', 'success');
    } catch (e) {
      showToast?.((e as Error).message, 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const handleKeep = async (shareId: number, fileName: string) => {
    if (keptIds.has(shareId)) return; // Already kept
    setKeepingId(shareId);
    try {
      const token = localStorage.getItem('sessionToken');
      const resp = await fetch(`/api/share/keep/${shareId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: 'Failed to keep file' }));
        if (resp.status === 409) {
          // Already kept on server — just mark locally
          setKeptIds(prev => new Set(prev).add(shareId));
          showToast?.(`"${fileName}" already saved`, 'info');
          return;
        }
        throw new Error(data.error || 'Failed to keep file');
      }
      const data = await resp.json();
      setKeptIds(prev => new Set(prev).add(shareId));
      showToast?.(`"${fileName}" saved to ${data.destFolder}/`, 'success');
    } catch (e) {
      showToast?.((e as Error).message, 'error');
    } finally {
      setKeepingId(null);
    }
  };

  const handlePreview = (shareId: number) => {
    // On mobile, open the in-app viewer; on desktop, open in new tab
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      const file = [...received, ...sent].find(f => f.id === shareId);
      if (file) setViewerFile(file);
    } else {
      const token = localStorage.getItem('sessionToken');
      window.open(`/api/share/download/${shareId}?token=${encodeURIComponent(token || '')}`, '_blank');
    }
  };

  const isVideoFile = (fileType: string | null, fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return fileType === 'video' || ['mp4', 'mkv', 'avi', 'webm', 'mov'].includes(ext);
  };

  const isAudioFile = (fileType: string | null, fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return fileType === 'audio' || ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a'].includes(ext);
  };

  const getFileIcon = (fileType: string | null, fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'];
    const videoExts = ['mp4', 'mkv', 'avi', 'webm', 'mov'];
    const audioExts = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'];

    if (fileType === 'image' || imageExts.includes(ext)) return <Image className="w-5 h-5 text-blue-500" />;
    if (fileType === 'video' || videoExts.includes(ext)) return <Video className="w-5 h-5 text-purple-500" />;
    if (fileType === 'audio' || audioExts.includes(ext)) return <Music className="w-5 h-5 text-pink-500" />;
    if (docExts.includes(ext)) return <FileText className="w-5 h-5 text-amber-500" />;
    return <File className="w-5 h-5 text-gray-400" />;
  };

  const getFileIconBg = (fileType: string | null, fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'];
    const videoExts = ['mp4', 'mkv', 'avi', 'webm', 'mov'];
    const audioExts = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'];

    if (fileType === 'image' || imageExts.includes(ext)) return 'bg-blue-50 border-blue-100';
    if (fileType === 'video' || videoExts.includes(ext)) return 'bg-[#5D5FEF]/5 border-[#5D5FEF]/10';
    if (fileType === 'audio' || audioExts.includes(ext)) return 'bg-pink-50 border-pink-100';
    if (docExts.includes(ext)) return 'bg-amber-50 border-amber-100';
    return 'bg-gray-50 border-gray-100';
  };

  const getCategoryLabel = (cat: string | null) => {
    if (!cat) return null;
    const map: Record<string, string> = { general: 'General', media: 'Photos', video_vault: 'Videos', music: 'Music' };
    return map[cat] || cat;
  };

  const isImageFile = (fileType: string | null, fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'];
    return fileType === 'image' || imageExts.includes(ext);
  };

  const getShareThumbnailUrl = (shareId: number) => {
    const token = localStorage.getItem('sessionToken');
    return `/api/share/download/${shareId}?token=${encodeURIComponent(token || '')}`;
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const activeList = tab === 'received' ? received : sent;
  const filtered = searchQuery
    ? activeList.filter(f => f.fileName.toLowerCase().includes(searchQuery.toLowerCase()))
    : activeList;

  // Group by person
  const grouped = filtered.reduce<Record<string, { person: { id: number; name: string; avatarUrl: string | null }; files: SharedFileItem[] }>>((acc, item) => {
    const person = tab === 'received' ? item.sender! : item.recipient!;
    if (!person) return acc;
    const key = String(person.id);
    if (!acc[key]) acc[key] = { person, files: [] };
    acc[key].files.push(item);
    return acc;
  }, {});

  const personGroups = Object.values(grouped);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-4 sm:mb-8">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-[28px] sm:text-2xl md:text-3xl lg:text-4xl font-heading font-bold tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative">
            Shared Files
          </h1>
          <p className="text-gray-500 font-medium text-xs md:text-sm pl-3 sm:pl-4 md:pl-6 mt-1">Files shared between you and your family members</p>
        </div>
      </div>

      {/* Tabs + Refresh */}
      <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
        <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => setTab('received')}
            className={`flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-[12px] sm:text-[13px] font-bold transition-all ${
              tab === 'received'
                ? 'bg-[#5D5FEF] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="truncate">Received</span>
            {received.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black ${tab === 'received' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {received.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('sent')}
            className={`flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-[12px] sm:text-[13px] font-bold transition-all ${
              tab === 'sent'
                ? 'bg-[#5D5FEF] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <ArrowUpFromLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="truncate">Sent</span>
            {sent.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black ${tab === 'sent' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {sent.length}
              </span>
            )}
          </button>
        </div>
        <button
          onClick={() => fetchShares(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#5D5FEF] text-white hover:bg-[#4B4DD4] transition-all disabled:opacity-60 shadow-sm shadow-[#5D5FEF]/20 flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Search */}
      {activeList.length > 0 && (
        <div className="relative mb-4 sm:mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search shared files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#5D5FEF]/30 focus:ring-2 focus:ring-[#5D5FEF]/10 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm p-12 sm:p-16 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-[#5D5FEF] animate-spin mb-3" />
          <p className="text-sm text-gray-400 font-medium">Loading shared files...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-sm py-16 sm:py-24 px-8 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-[#5D5FEF]/5 flex items-center justify-center mx-auto mb-5 sm:mb-6">
            {tab === 'received' ? (
              <ArrowDownToLine className="w-7 h-7 sm:w-9 sm:h-9 text-[#5D5FEF]/40" />
            ) : (
              <ArrowUpFromLine className="w-7 h-7 sm:w-9 sm:h-9 text-[#5D5FEF]/40" />
            )}
          </div>
          <h3 className="text-lg sm:text-xl font-heading font-bold text-gray-900 mb-2">
            {searchQuery
              ? 'No matching files'
              : tab === 'received'
                ? 'No files shared with you yet'
                : "You haven't shared any files yet"
            }
          </h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            {searchQuery
              ? 'Try a different search term'
              : tab === 'received'
                ? 'When family members share files with you, they will appear here.'
                : 'Share files with family members by clicking the share button on any file.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {personGroups.map(({ person, files }) => (
            <div key={person.id} className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              {/* Person header */}
              <div className="px-4 sm:px-8 py-3.5 sm:py-5 bg-[#F5F5F7]/50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {person.avatarUrl ? (
                    <img src={person.avatarUrl} alt={person.name} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                  ) : (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#5D5FEF] to-[#8B5CF6] flex items-center justify-center shadow-sm">
                      <span className="text-white text-[13px] sm:text-sm font-black">{person.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] sm:text-[15px] font-black text-gray-900 truncate">{person.name}</h3>
                    <p className="text-[11px] font-bold text-gray-400">
                      {files.length} {files.length === 1 ? 'file' : 'files'} · {tab === 'received' ? 'Shared with you' : 'You shared'}
                    </p>
                  </div>
                </div>
              </div>

              {/* File list */}
              <div className="divide-y divide-gray-50">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="px-4 sm:px-8 py-4 sm:py-4 hover:bg-gray-50/50 transition-all group"
                  >
                    {/* Desktop layout */}
                    <div className="hidden sm:flex items-center gap-4">
                      <div className="relative flex-shrink-0">
                        {isImageFile(file.fileType, file.fileName) ? (
                          <div className="w-11 h-11 rounded-xl border border-blue-100 overflow-hidden bg-gray-50">
                            <img
                              src={getShareThumbnailUrl(file.id)}
                              alt={file.fileName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.currentTarget.parentElement!;
                                target.innerHTML = '';
                                target.className = `w-11 h-11 rounded-xl border flex items-center justify-center ${getFileIconBg(file.fileType, file.fileName)}`;
                              }}
                            />
                          </div>
                        ) : (
                          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${getFileIconBg(file.fileType, file.fileName)}`}>
                            {getFileIcon(file.fileType, file.fileName)}
                          </div>
                        )}
                        {/* Share badge */}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#5D5FEF] flex items-center justify-center shadow-sm pointer-events-none">
                          <img src={SHARE_ICON_SRC} alt="" className="w-2.5 h-2.5" style={{ filter: 'brightness(10)' }} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-gray-900 truncate">{file.fileName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {file.sizeBytes > 0 && (
                            <span className="text-[11px] text-gray-400 font-medium">{formatSize(file.sizeBytes)}</span>
                          )}
                          {file.sizeBytes > 0 && <span className="text-gray-300">·</span>}
                          <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(file.sharedAt)}
                          </span>
                          {file.category && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                                <FolderOpen className="w-3 h-3" />
                                {getCategoryLabel(file.category)}
                              </span>
                            </>
                          )}
                        </div>
                        {file.message && (
                          <p className="text-[12px] text-[#5D5FEF] font-medium mt-1 truncate">"{file.message}"</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => handlePreview(file.id)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-[#5D5FEF] hover:bg-[#4B4DD9] transition-all"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {tab === 'received' && (
                          keptIds.has(file.id) ? (
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-emerald-500 cursor-default"
                              title="Kept — already saved to your files"
                            >
                              <Check className="w-4 h-4" />
                            </div>
                          ) : (
                            <button
                              onClick={() => handleKeep(file.id, file.fileName)}
                              disabled={keepingId === file.id}
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-[#5D5FEF] hover:bg-[#4B4DD9] transition-all disabled:opacity-50"
                              title="Keep — save a copy to your files"
                            >
                              {keepingId === file.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <img src={KEEP_ICON_SRC} alt="" className="w-4 h-4" style={{ filter: 'brightness(10)' }} />
                              )}
                            </button>
                          )
                        )}
                        <button
                          onClick={() => handleRemove(file.id)}
                          disabled={removingId === file.id}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-50"
                          title="Remove share"
                        >
                          {removingId === file.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Mobile layout — card style with bottom action bar */}
                    <div className="sm:hidden">
                      <div className="flex items-start gap-3">
                        {/* File icon / thumbnail with share badge */}
                        <div className="relative flex-shrink-0 mt-0.5">
                          {isImageFile(file.fileType, file.fileName) ? (
                            <div className="w-11 h-11 rounded-xl border border-blue-100 overflow-hidden bg-gray-50">
                              <img
                                src={getShareThumbnailUrl(file.id)}
                                alt={file.fileName}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${getFileIconBg(file.fileType, file.fileName)}`}>
                              {getFileIcon(file.fileType, file.fileName)}
                            </div>
                          )}
                          {/* Share badge */}
                          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#5D5FEF] flex items-center justify-center shadow-sm pointer-events-none">
                            <img src={SHARE_ICON_SRC} alt="" className="w-2 h-2" style={{ filter: 'brightness(10)' }} />
                          </div>
                        </div>

                        {/* File details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-gray-900 truncate leading-tight">{file.fileName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {file.sizeBytes > 0 && (
                              <span className="text-[10px] font-medium text-gray-400">{formatSize(file.sizeBytes)}</span>
                            )}
                            {file.sizeBytes > 0 && <span className="text-gray-300 text-[10px]">·</span>}
                            <span className="text-[10px] font-medium text-gray-400">{formatDate(file.sharedAt)}</span>
                          </div>
                          {file.message && (
                            <p className="text-[11px] text-[#5D5FEF] font-medium mt-1 line-clamp-1">"{file.message}"</p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons — bottom row */}
                      <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-gray-100/80">
                        <button
                          onClick={() => handlePreview(file.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold text-white bg-[#5D5FEF] active:bg-[#4B4DD9] transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                        {tab === 'received' && (
                          keptIds.has(file.id) ? (
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-emerald-500 cursor-default"
                              title="Kept"
                            >
                              <Check className="w-4 h-4" />
                            </div>
                          ) : (
                            <button
                              onClick={() => handleKeep(file.id, file.fileName)}
                              disabled={keepingId === file.id}
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-[#5D5FEF] active:bg-[#4B4DD9] transition-all disabled:opacity-50"
                              title="Keep"
                            >
                              {keepingId === file.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <img src={KEEP_ICON_SRC} alt="" className="w-4 h-4" style={{ filter: 'brightness(10)' }} />
                              )}
                            </button>
                          )
                        )}
                        <button
                          onClick={() => handleRemove(file.id)}
                          disabled={removingId === file.id}
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-red-500 active:bg-red-600 transition-all disabled:opacity-50"
                          title="Remove"
                        >
                          {removingId === file.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Card */}
      {!loading && (received.length > 0 || sent.length > 0) && (
        <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gray-50 rounded-xl sm:rounded-2xl border border-gray-100">
          <h3 className="text-[12px] sm:text-[13px] font-black text-gray-900 mb-1.5">About Shared Files</h3>
          <p className="text-[11px] sm:text-[12px] text-gray-600 leading-relaxed">
            Share files with family members directly from your file browser. Files stay in the original location — only a secure link is shared.
            Both the sender and recipient can remove a share at any time.
          </p>
        </div>
      )}

      {/* ── Mobile in-app file viewer overlay ── */}
      {viewerFile && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col sm:hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-md">
            <button
              onClick={() => setViewerFile(null)}
              className="flex items-center gap-1.5 text-white/90 active:text-white/60"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-[14px] font-semibold">Back</span>
            </button>
            <p className="flex-1 text-center text-[13px] font-bold text-white/80 truncate px-4">{viewerFile.fileName}</p>
            <div className="w-16" />
          </div>

          {/* Content area */}
          <div className="flex-1 flex items-center justify-center overflow-auto bg-black">
            {isImageFile(viewerFile.fileType, viewerFile.fileName) ? (
              <img
                src={getShareThumbnailUrl(viewerFile.id)}
                alt={viewerFile.fileName}
                className="max-w-full max-h-full object-contain"
              />
            ) : isVideoFile(viewerFile.fileType, viewerFile.fileName) ? (
              <video
                src={getShareThumbnailUrl(viewerFile.id)}
                controls
                autoPlay
                className="max-w-full max-h-full"
              />
            ) : isAudioFile(viewerFile.fileType, viewerFile.fileName) ? (
              <div className="flex flex-col items-center gap-6 px-8">
                <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-2xl">
                  <Music className="w-16 h-16 text-white" />
                </div>
                <p className="text-white/80 text-[15px] font-bold text-center truncate max-w-[80vw]">{viewerFile.fileName}</p>
                <audio src={getShareThumbnailUrl(viewerFile.id)} controls autoPlay className="w-full max-w-sm" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 px-8">
                <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center">
                  {getFileIcon(viewerFile.fileType, viewerFile.fileName)}
                </div>
                <p className="text-white/80 text-[14px] font-bold text-center">{viewerFile.fileName}</p>
                <p className="text-white/40 text-[12px]">Preview not available for this file type</p>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-center gap-3 px-5 py-4 bg-black/80 backdrop-blur-md">
            {tab === 'received' && (
              keptIds.has(viewerFile.id) ? (
                <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-bold text-white bg-emerald-500 cursor-default">
                  <Check className="w-4 h-4" />
                  Kept
                </div>
              ) : (
                <button
                  onClick={() => { handleKeep(viewerFile.id, viewerFile.fileName); }}
                  disabled={keepingId === viewerFile.id}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-bold text-white bg-[#5D5FEF] active:bg-[#4B4DD9] transition-all disabled:opacity-50"
                >
                  {keepingId === viewerFile.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <img src={KEEP_ICON_SRC} alt="" className="w-4 h-4" style={{ filter: 'brightness(10)' }} />
                  )}
                  Keep
                </button>
              )
            )}
            <button
              onClick={() => { handleRemove(viewerFile.id); setViewerFile(null); }}
              disabled={removingId === viewerFile.id}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-bold text-white bg-red-500 active:bg-red-600 transition-all disabled:opacity-50"
            >
              {removingId === viewerFile.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedView;
