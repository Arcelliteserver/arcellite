import React, { useState, useMemo } from 'react';
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
    <div className="animate-in fade-in duration-300">
      {/* App-Style Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h1 className="text-[32px] font-black text-gray-900 tracking-tight leading-none">Gallery</h1>
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
      <div className="flex p-1 bg-gray-100 rounded-2xl mb-6">
        {([
          { id: 'all' as GalleryFilter, label: 'All', count: photoCount + videoCount },
          { id: 'photos' as GalleryFilter, label: 'Photos', count: photoCount },
          { id: 'videos' as GalleryFilter, label: 'Videos', count: videoCount },
        ]).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all touch-manipulation ${
              filter === f.id
                ? 'bg-white text-[#5D5FEF] shadow-sm'
                : 'text-gray-500'
            }`}
          >
            {f.label}
            <span className={`ml-1 text-[11px] ${filter === f.id ? 'text-[#5D5FEF]/60' : 'text-gray-400'}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Albums — indigo folder cards (same as homepage) */}
      {filteredFolders.length > 0 && !currentFolderId && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-bold text-gray-900 tracking-tight">Albums</h3>
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
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <h3 className="text-[14px] font-bold text-gray-600">{label}</h3>
                <span className="text-[12px] font-medium text-gray-400">{items.length}</span>
              </div>
              <div className="grid grid-cols-3 gap-[3px] rounded-2xl overflow-hidden">
                {items.map((file) => {
                  const url = getFileUrl(file);
                  return (
                    <button
                      key={file.id}
                      onClick={() => onFileClick(file)}
                      className="relative aspect-square bg-gray-100 overflow-hidden active:opacity-80 transition-all touch-manipulation"
                    >
                      {file.type === 'image' ? (
                        <img
                          src={url}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center relative">
                          <video
                            src={url}
                            preload="metadata"
                            className="w-full h-full object-cover absolute inset-0"
                            muted
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                              <Play className="w-5 h-5 text-gray-800 ml-0.5" fill="currentColor" />
                            </div>
                          </div>
                          {file.size && (
                            <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                              {file.size}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-[88px] h-[88px] rounded-full bg-gray-100 flex items-center justify-center mb-4 shadow-sm">
            <ImageIcon className="w-10 h-10 text-gray-300" />
          </div>
          <p className="text-[22px] font-extrabold text-gray-300 tracking-tight">No Media Yet</p>
          <p className="text-[15px] font-medium text-gray-400 mt-1">Upload photos & videos to see them here</p>
        </div>
      )}
    </div>
  );
};

export default MobileGallery;
