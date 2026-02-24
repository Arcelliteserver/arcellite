import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  Image as ImageIcon,
  Film,
  Play,
  Calendar,
  Folder,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { FileItem } from '../../types';
import { useVideoThumbnail } from '../files/useVideoThumbnail';

interface MobileGalleryProps {
  currentFolderId: string | null;
  filteredFolders: FileItem[];
  filteredFiles: FileItem[];
  files: FileItem[];
  onFileClick: (file: FileItem) => void;
  onFileAction: (action: string, file: FileItem, targetFolder?: FileItem) => void;
  selectedFile: FileItem | null;
  onGoBack: () => void;
  onCreateFolder: () => void;
}

type GalleryFilter = 'all' | 'photos' | 'videos';

/** Image tile with loading skeleton */
const ImageTile: React.FC<{ url: string; name: string; onClick: () => void }> = ({ url, name, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <button
      onClick={onClick}
      className="relative aspect-square bg-gray-200 overflow-hidden active:opacity-80 transition-all touch-manipulation"
    >
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gray-200">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        </div>
      )}
      {error ? (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center overflow-hidden">
          <img src="/images/photo_placeholder.png" alt="Photo" className="w-full h-full object-cover" />
        </div>
      ) : (
        <img
          src={url}
          alt={name}
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
    </button>
  );
};

/** Video thumbnail tile with canvas-generated preview */
const VideoTile: React.FC<{ url: string; size?: string; onClick: () => void }> = ({ url, size, onClick }) => {
  const thumbnail = useVideoThumbnail(url);

  return (
    <button
      onClick={onClick}
      className="relative aspect-square bg-gray-800 overflow-hidden active:opacity-80 transition-all touch-manipulation"
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt="Video thumbnail"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gray-200">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          <Play className="w-5 h-5 text-gray-800 ml-0.5" fill="currentColor" />
        </div>
      </div>
      {size && (
        <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
          {size}
        </span>
      )}
    </button>
  );
};

const MobileGallery: React.FC<MobileGalleryProps> = ({
  currentFolderId,
  filteredFolders,
  filteredFiles,
  files,
  onFileClick,
  onFileAction,
  selectedFile,
  onGoBack,
  onCreateFolder,
}) => {
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [showAllAlbums, setShowAllAlbums] = useState(false);

  const handleFilterChange = useCallback((f: GalleryFilter) => {
    setFilter(f);
  }, []);

  // Compute media from ALL files (not the pre-filtered list which only has images)
  // This fixes videos not appearing in gallery
  const allMedia = useMemo(() => {
    let media = files.filter(f => !f.isFolder && (f.type === 'image' || f.type === 'video'));
    if (currentFolderId !== null) {
      media = media.filter(f => f.parentId === currentFolderId);
    } else {
      // Root level: show files from media/video categories or image/video types
      media = media.filter(f =>
        f.category === 'media' || f.category === 'video_vault' ||
        f.type === 'image' || f.type === 'video'
      );
    }
    return media;
  }, [files, currentFolderId]);

  const mediaFiles = useMemo(() => {
    if (filter === 'photos') return allMedia.filter(f => f.type === 'image');
    if (filter === 'videos') return allMedia.filter(f => f.type === 'video');
    return allMedia;
  }, [allMedia, filter]);

  // Group by month
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, FileItem[]> = {};
    mediaFiles.forEach((file) => {
      const date = new Date(file.modifiedTimestamp);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(file);
    });
    const sorted = Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
    return sorted.map(([key, items]) => {
      const d = new Date(items[0].modifiedTimestamp);
      return {
        key,
        label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        items,
      };
    });
  }, [mediaFiles]);

  const photoCount = allMedia.filter(f => f.type === 'image').length;
  const videoCount = allMedia.filter(f => f.type === 'video').length;

  const getFileUrl = (file: FileItem) => {
    if (file.url) return file.url;
    const cat = file.category || 'media';
    const path = file.id.replace(/^server-[^-]+-/, '');
    return `/api/files/serve?category=${cat}&path=${encodeURIComponent(path)}`;
  };

  const visibleAlbums = showAllAlbums ? filteredFolders : filteredFolders.slice(0, 4);
  const hasMoreAlbums = filteredFolders.length > 4;

  return (
    <div className="font-heading animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="relative min-w-0">
            <div className="absolute -left-3 top-0 w-[3px] h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full" />
            <h1 className="text-2xl sm:text-[28px] font-bold text-gray-900 tracking-tight leading-none pl-1">Gallery</h1>
            <p className="text-xs font-medium text-gray-500 mt-0.5 pl-1">Photos and videos from your vault</p>
          </div>
          {currentFolderId ? (
            <button
              onClick={onGoBack}
              className="flex items-center gap-1 text-[13px] font-semibold text-[#5D5FEF] active:opacity-60 touch-manipulation"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Gallery
            </button>
          ) : (
            <button
              onClick={onCreateFolder}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#5D5FEF] rounded-2xl shadow-lg shadow-[#5D5FEF]/30 active:scale-[0.95] transition-all touch-manipulation"
            >
              <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
              <span className="text-[13px] font-semibold text-white">New Folder</span>
            </button>
          )}
        </div>
      </div>

      {/* Segmented Filter */}
      <div className="flex p-1 bg-white border border-gray-200 rounded-2xl mb-6 shadow-sm">
        {([
          { id: 'all' as GalleryFilter, label: 'All', count: photoCount + videoCount },
          { id: 'photos' as GalleryFilter, label: 'Photos', count: photoCount },
          { id: 'videos' as GalleryFilter, label: 'Videos', count: videoCount },
        ]).map((f) => (
          <button
            key={f.id}
            onClick={() => handleFilterChange(f.id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all touch-manipulation ${
              filter === f.id
                ? 'bg-[#5D5FEF] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {f.label}
            <span className={`ml-1 text-[11px] ${filter === f.id ? 'text-white/80' : 'text-gray-400'}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Albums — indigo folder cards (same as homepage) */}
      {filteredFolders.length > 0 && !currentFolderId && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-500 tracking-tight uppercase tracking-wider">Albums</h3>
            {hasMoreAlbums && (
              <button
                onClick={() => setShowAllAlbums(!showAllAlbums)}
                className="flex items-center gap-1 text-[12px] font-semibold text-[#5D5FEF] active:opacity-60 touch-manipulation"
              >
                {showAllAlbums ? 'Show Less' : `View All (${filteredFolders.length})`}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAllAlbums ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
          <div className="mb-3 h-px bg-gradient-to-r from-gray-200 via-gray-200 to-transparent" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            {visibleAlbums.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onFileClick(folder)}
                className="relative active:scale-[0.97] transition-all text-left touch-manipulation"
              >
                {/* Folder tab */}
                <div className="absolute -top-[8px] left-5 w-14 h-5 bg-[#5D5FEF] rounded-t-2xl shadow-md z-0" />
                {/* Folder body */}
                <div className="relative w-full aspect-[1.6/1] bg-[#5D5FEF] rounded-2xl shadow-xl shadow-[#5D5FEF]/15 z-[1] overflow-hidden">
                  <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-white/10 rounded-full blur-[60px]" />
                  <div className="absolute inset-0 p-4 flex flex-col">
                    <div className="flex justify-between items-start">
                      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/20">
                        <Folder className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-2xl font-black text-white/15 leading-none mt-1">{folder.itemCount ?? 0}</span>
                    </div>
                    <div className="mt-auto">
                      <p className="text-[14px] font-bold text-white truncate pr-2">{folder.name}</p>
                      <p className="text-[9px] font-bold text-white/60 uppercase tracking-[0.2em] mt-0.5">
                        {folder.itemCount ?? 0} {(folder.itemCount ?? 0) === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Media Grid */}
      {groupedByMonth.length > 0 ? (
        <div className="space-y-6">
          {groupedByMonth.map(({ key, label, items }) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <h3 className="text-sm font-bold text-gray-600">{label}</h3>
                <span className="text-xs font-medium text-gray-400">{items.length}</span>
              </div>
              <div className="mb-2 h-px bg-gradient-to-r from-gray-200 to-transparent" />
              <div className="grid grid-cols-3 gap-[3px] rounded-2xl overflow-hidden">
                {items.map((file) => {
                  const url = getFileUrl(file);
                  if (file.type === 'video') {
                    return (
                      <VideoTile
                        key={file.id}
                        url={url}
                        size={file.size}
                        onClick={() => onFileClick(file)}
                      />
                    );
                  }
                  return (
                    <ImageTile
                      key={file.id}
                      url={url}
                      name={file.name}
                      onClick={() => onFileClick(file)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 sm:py-24">
          <div className="w-20 h-20 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
            <ImageIcon className="w-10 h-10 text-gray-300" />
          </div>
          <p className="font-heading text-xl font-bold text-gray-400 tracking-tight">No Media Yet</p>
          <p className="text-sm font-medium text-gray-500 mt-1 px-2">Upload photos & videos to see them here</p>
        </div>
      )}
    </div>
  );
};

export default MobileGallery;
