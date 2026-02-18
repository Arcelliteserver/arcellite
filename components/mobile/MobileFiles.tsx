import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  Folder,
  FileText,
  Music,
  Film,
  Plus,
  Image as ImageIcon,
  Code,
  File,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { FileItem } from '../../types';
import { usePdfThumbnail } from '../files/usePdfThumbnail';

const LOCK_ICON_SRC = '/assets/icons/password_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

interface MobileFilesProps {
  activeCategory: string;
  currentFolderId: string | null;
  filteredFolders: FileItem[];
  filteredFiles: FileItem[];
  files: FileItem[];
  onFileClick: (file: FileItem) => void;
  onFileAction: (action: string, file: FileItem, targetFolder?: FileItem) => void;
  selectedFile: FileItem | null;
  onGoBack: () => void;
  onCreateFolder: () => void;
  pdfThumbnails?: boolean;
  aiRenamedSet?: Set<string>;
  onTabChange?: (tab: string) => void;
  isFolderLocked?: (file: FileItem) => boolean;
}

const getFileIconComponent = (ext: string) => {
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'].includes(ext)) return ImageIcon;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return Film;
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return Music;
  if (['js', 'ts', 'py', 'html', 'css', 'json', 'xml', 'yaml', 'sh'].includes(ext)) return Code;
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'].includes(ext)) return FileText;
  return File;
};

const getFileColor = (ext: string) => {
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'].includes(ext)) return 'text-pink-500 bg-pink-50';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'text-purple-500 bg-purple-50';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return 'text-emerald-500 bg-emerald-50';
  if (['js', 'ts', 'py', 'html', 'css', 'json', 'xml', 'yaml', 'sh'].includes(ext)) return 'text-amber-500 bg-amber-50';
  if (['pdf'].includes(ext)) return 'text-red-500 bg-red-50';
  if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return 'text-blue-500 bg-blue-50';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'text-green-500 bg-green-50';
  return 'text-gray-500 bg-gray-100';
};

const PDF_BOOK_EXTS = ['pdf', 'epub', 'djvu', 'mobi', 'azw3', 'fb2', 'cbz', 'cbr'];

const PdfThumbnailCard: React.FC<{ file: FileItem; enabled: boolean }> = ({ file, enabled }) => {
  const thumb = usePdfThumbnail(file.url, enabled);
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (thumb) {
    return (
      <div className="w-full h-[100px] bg-gray-50 flex items-center justify-center overflow-hidden relative">
        <img src={thumb} alt={file.name} className="w-full h-full object-cover" />
        <span className="absolute bottom-1.5 right-1.5 text-[9px] font-black uppercase text-white/90 bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
          {ext}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-[100px] bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center overflow-hidden">
      <div className="animate-pulse"><FileText className="w-8 h-8 text-red-400" /></div>
    </div>
  );
};

const MobileFiles: React.FC<MobileFilesProps> = ({
  activeCategory,
  currentFolderId,
  filteredFolders,
  filteredFiles,
  files,
  onFileClick,
  onFileAction,
  selectedFile,
  onGoBack,
  onCreateFolder,
  pdfThumbnails = true,
  aiRenamedSet,
  onTabChange,
  isFolderLocked,
}) => {
  const [showAllFolders, setShowAllFolders] = useState(false);

  const sortedFiles = [...filteredFiles].sort((a, b) => b.modifiedTimestamp - a.modifiedTimestamp);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, FileItem[]> = {};
    sortedFiles.forEach((file) => {
      const date = new Date(file.modifiedTimestamp);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(file);
    });
    const sorted = Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
    return sorted.map(([key, items]) => {
      const d = new Date(items[0].modifiedTimestamp);
      return { key, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), items };
    });
  }, [sortedFiles]);

  const visibleFolders = showAllFolders ? filteredFolders : filteredFolders.slice(0, 4);
  const hasMoreFolders = filteredFolders.length > 4;

  return (
    <div className="animate-in fade-in duration-300">
      {/* App-Style Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[32px] font-black text-gray-900 tracking-tight leading-none">Files</h1>
          {currentFolderId ? (
            <button
              onClick={onGoBack}
              className="flex items-center gap-1 text-[13px] font-semibold text-[#5D5FEF] active:opacity-60 touch-manipulation"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Files
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

      {/* Folders */}
      {filteredFolders.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-bold text-gray-900 tracking-tight">Folders</h3>
            {hasMoreFolders && (
              <button
                onClick={() => setShowAllFolders(!showAllFolders)}
                className="flex items-center gap-1 text-[12px] font-semibold text-[#5D5FEF] active:opacity-60 touch-manipulation"
              >
                {showAllFolders ? 'Show Less' : `View All (${filteredFolders.length})`}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAllFolders ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {visibleFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onFileClick(folder)}
                className="relative active:scale-[0.97] transition-all text-left touch-manipulation"
              >
                <div className="absolute -top-[8px] left-5 w-14 h-5 bg-[#5D5FEF] rounded-t-2xl shadow-md z-0" />
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
                  {isFolderLocked?.(folder) && (
                    <img
                      src={LOCK_ICON_SRC}
                      alt=""
                      className="absolute bottom-3 right-3 z-10 w-5 h-5 opacity-90 pointer-events-none"
                      title="Locked — enter PIN to open"
                      aria-hidden
                    />
                  )}
                  {!isFolderLocked?.(folder) && folder.hasSubfolders && (
                    <img
                      src="/assets/icons/stacks_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg"
                      alt=""
                      className="absolute bottom-3 right-3 z-10 w-5 h-5 opacity-70 pointer-events-none"
                      title="Contains subfolders"
                      aria-hidden
                    />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {sortedFiles.length > 0 ? (
        <div className="space-y-6">
          {groupedByDate.map(({ key, label, items }) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <h3 className="text-[14px] font-bold text-gray-600">{label}</h3>
                <span className="text-[12px] font-medium text-gray-400">{items.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {items.map((file) => {
                  const ext = file.name.split('.').pop()?.toLowerCase() || '';
                  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'].includes(ext);
                  const isAudioFile = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus'].includes(ext);
                  const isPdfBook = PDF_BOOK_EXTS.includes(ext);
                  const IconComp = getFileIconComponent(ext);
                  const colorClass = getFileColor(ext);
                  const thumbnailUrl = isImage && file.url ? file.url : null;
                  return (
                    <button
                      key={file.id}
                      onClick={() => onFileClick(file)}
                      className="bg-white border border-gray-200/80 rounded-2xl shadow-sm active:scale-[0.97] transition-all overflow-hidden text-left touch-manipulation min-w-0"
                    >
                      {isPdfBook ? (
                        <PdfThumbnailCard file={file} enabled={pdfThumbnails} />
                      ) : (
                        <div className="w-full h-[100px] bg-gray-50 flex items-center justify-center overflow-hidden">
                          {thumbnailUrl ? (
                            <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/photo_placeholder.png'; }} />
                          ) : isAudioFile ? (
                            <img src="/images/music_placeholder.png" alt="Music" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass}`}>
                              <IconComp className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="px-3 py-2 overflow-hidden">
                        <p className="text-[12px] font-bold text-gray-900 truncate leading-tight">{file.name}</p>
                        <p className="text-[10px] font-medium text-gray-400 mt-0.5 truncate">
                          {new Date(file.modifiedTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {file.size ? ` \u00b7 ${file.size}` : ''}
                        </p>
                      </div>
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
            <FileText className="w-10 h-10 text-gray-300" />
          </div>
          <p className="text-[22px] font-extrabold text-gray-300 tracking-tight">No Files Yet</p>
          <p className="text-[15px] font-medium text-gray-400 mt-1">Upload files to get started</p>
        </div>
      )}
    </div>
  );
};

export default MobileFiles;
