
import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Share2,
  Download,
  Trash2,
  Edit3,
  ExternalLink,
  FolderInput,
  ChevronRight,
  Pencil,
  Sparkles,
  X,
  Check,
} from 'lucide-react';
import { FileItem } from '../../types';
import FileIcon from './FileIcon';
import { usePdfThumbnail } from './usePdfThumbnail';

const LOCK_ICON_SRC = '/assets/icons/password_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
const STACKS_ICON_SRC = '/assets/icons/stacks_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

interface FileGridProps {
  files: FileItem[];
  onFileClick: (file: FileItem) => void;
  selectedFileId?: string;
  onAction?: (action: string, file: FileItem, targetFolder?: FileItem) => void;
  allFiles?: FileItem[]; // Pass all files to calculate folder counts
  availableFolders?: FileItem[]; // Pass available folders for Move option
  pdfThumbnails?: boolean; // Enable/disable PDF thumbnail rendering
  aiRenamedSet?: Set<string>; // Set of "category/relPath" keys for AI-renamed files
  mobileColumns?: 2 | 3; // Number of columns on mobile (default: 2)
  onFileDrop?: (file: FileItem, targetFolder: FileItem) => void; // Drag-and-drop into folder
  isFolderLocked?: (file: FileItem) => boolean; // True if folder requires PIN to open (Security Vault)
  onBulkAction?: (action: string, files: FileItem[]) => void; // Bulk actions on drag-selected files
}

const CustomFolderIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className} 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M2 7.2C2 6.0799 2 5.51984 2.21799 5.09202C2.40973 4.71569 2.71569 4.40973 3.09202 4.21799C3.51984 4 4.0799 4 5.2 4H9.14142C9.40664 4 9.53926 4 9.66442 4.03224C9.77531 4.06082 9.88147 4.1069 9.97943 4.169C10.09 4.23906 10.1839 4.33285 10.3716 4.52058L12.6284 6.77942C12.8161 6.96715 12.91 7.06102 13.0206 7.131C13.1185 7.1931 13.2247 7.23918 13.3356 7.26776C13.4607 7.3 13.5934 7.3 13.8586 7.3H18.8C19.9201 7.3 20.4802 7.3 20.908 7.51799C21.2843 7.70973 21.5903 8.01569 21.782 8.39202C22 8.81984 22 9.3799 22 10.5V16.8C22 17.9201 22 18.4802 21.782 18.908C21.5903 19.2843 21.2843 19.5903 20.908 19.782C20.4802 20 19.9201 20 18.8 20H5.2C4.0799 20 3.51984 20 3.09202 19.782C2.71569 19.5903 2.40973 19.2843 2.21799 18.908C2 18.4802 2 17.9201 2 16.8V7.2Z" 
      fill="currentColor" 
      fillOpacity="0.3"
    />
    <path 
      d="M2 10.5C2 9.3799 2 8.81984 2.21799 8.39202C2.40973 8.01569 2.71569 7.70973 3.09202 7.51799C3.51984 7.3 4.0799 7.3 5.2 7.3H18.8C19.9201 7.3 20.4802 7.3 20.908 7.51799C21.2843 7.70973 21.5903 8.01569 21.782 8.39202C22 8.81984 22 9.3799 22 10.5V16.8C22 17.9201 22 18.4802 21.782 18.908C21.5903 19.2843 21.2843 19.5903 20.908 19.782C20.4802 20 19.9201 20 18.8 20H5.2C4.0799 20 3.51984 20 3.09202 19.782C2.71569 19.5903 2.40973 19.2843 2.21799 18.908C2 18.4802 2 17.9201 2 16.8V10.5Z" 
      fill="currentColor"
    />
  </svg>
);

/** Renders a PDF/book first-page thumbnail with graceful fallback */
const PdfBookThumbnail: React.FC<{ file: FileItem; isPdf?: boolean; enabled?: boolean }> = ({ file, isPdf, enabled = true }) => {
  const thumb = usePdfThumbnail(file.url, enabled);
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isPdfFile = isPdf || ext === 'pdf';
  
  if (thumb) {
    return (
      <div className="relative w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden">
        <img
          src={thumb}
          alt={file.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-1.5 right-2 text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-white/80 bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
          {ext.toUpperCase()}
        </div>
      </div>
    );
  }

  // Fallback while loading or if rendering fails
  if (isPdfFile) {
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-2 left-2 right-2 h-0.5 bg-red-200" />
          <div className="absolute top-4 left-2 right-2 h-0.5 bg-red-200" />
          <div className="absolute top-6 left-2 right-2 h-0.5 bg-red-200" />
          <div className="absolute top-8 left-2 right-4 h-0.5 bg-red-200" />
        </div>
        <div className="animate-pulse">
          <FileIcon type={file.type} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-red-400 transition-colors relative z-10" />
        </div>
      </div>
    );
  }

  // Book fallback
  return (
    <div className="relative w-full h-full bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center">
      <div className="absolute inset-0 opacity-[0.07]">
        <div className="absolute top-2 left-3 right-3">
          <div className="h-0.5 bg-indigo-300 mb-1.5 w-full" />
          <div className="h-0.5 bg-indigo-300 mb-1.5 w-4/5" />
          <div className="h-0.5 bg-indigo-300 mb-1.5 w-full" />
          <div className="h-0.5 bg-indigo-300 mb-1.5 w-3/4" />
          <div className="h-0.5 bg-indigo-300 mb-1.5 w-full" />
        </div>
      </div>
      <div className="animate-pulse">
        <FileIcon type={file.type} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-indigo-400 transition-colors relative z-10" />
      </div>
    </div>
  );
};

const FileGrid: React.FC<FileGridProps> = ({ files, onFileClick, selectedFileId, onAction, allFiles = [], availableFolders = [], pdfThumbnails = true, aiRenamedSet, mobileColumns = 2, onFileDrop, isFolderLocked, onBulkAction }) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [hoveredSubmenu, setHoveredSubmenu] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  // --- Drag-to-select (rubber band) ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragSelectRect, setDragSelectRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragSelectRef = useRef<{ startX: number; startY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse listeners for rubber band drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragSelectRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const { startX, startY } = dragSelectRef.current;
      const selW = Math.abs(x - startX);
      const selH = Math.abs(y - startY);
      if (selW > 5 || selH > 5) {
        const selX = Math.min(startX, x);
        const selY = Math.min(startY, y);
        setDragSelectRect({ x: selX, y: selY, w: selW, h: selH });
        const selLeft = selX + rect.left;
        const selTop = selY + rect.top;
        const selRight = selLeft + selW;
        const selBottom = selTop + selH;
        const fileElements = containerRef.current.querySelectorAll('[data-file-id]');
        const newSelected = new Set<string>();
        fileElements.forEach(el => {
          const fileRect = el.getBoundingClientRect();
          if (fileRect.left < selRight && fileRect.right > selLeft && fileRect.top < selBottom && fileRect.bottom > selTop) {
            const fileId = el.getAttribute('data-file-id');
            if (fileId) newSelected.add(fileId);
          }
        });
        setSelectedIds(newSelected);
      }
    };
    const handleMouseUp = () => {
      dragSelectRef.current = null;
      setDragSelectRect(null);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Escape to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) setSelectedIds(new Set());
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size]);

  const handleGridMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-file-id]') || target.closest('button')) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (!e.ctrlKey && !e.metaKey) setSelectedIds(new Set());
    dragSelectRef.current = { startX: e.clientX - rect.left, startY: e.clientY - rect.top };
    e.preventDefault();
  };

  const handleCardClick = (e: React.MouseEvent, file: FileItem) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(file.id)) next.delete(file.id);
        else next.add(file.id);
        return next;
      });
      return;
    }
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
      return;
    }
    onFileClick(file);
  };

  const handleBulkDelete = () => {
    const sel = files.filter(f => selectedIds.has(f.id));
    if (onBulkAction) onBulkAction('Delete', sel);
    setSelectedIds(new Set());
  };

  const handleBulkDownload = () => {
    const sel = files.filter(f => selectedIds.has(f.id));
    if (onBulkAction) onBulkAction('Download', sel);
    setSelectedIds(new Set());
  };

  const handleDragStart = (e: React.DragEvent, file: FileItem) => {
    if (file.isFolder) return; // Don't drag folders
    e.dataTransfer.setData('application/json', JSON.stringify(file));
    e.dataTransfer.effectAllowed = 'move';
    // Set a ghost image
    const ghost = document.createElement('div');
    ghost.className = 'bg-white shadow-2xl rounded-xl px-4 py-2 text-sm font-bold text-gray-800 border border-[#5D5FEF]/30';
    ghost.textContent = file.name;
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
  };

  const handleFolderDrop = (e: React.DragEvent, targetFolder: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const file: FileItem = JSON.parse(data);
      if (file.id === targetFolder.id) return;
      if (onFileDrop) {
        onFileDrop(file, targetFolder);
      } else if (onAction) {
        onAction('Move', file, targetFolder);
      }
    } catch {}
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          (!submenuRef.current || !submenuRef.current.contains(event.target as Node))) {
        setActiveMenuId(null);
        setHoveredSubmenu(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeMenuId) {
        setActiveMenuId(null);
        setHoveredSubmenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeMenuId]);

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const getMenuActions = (isFolder: boolean) => {
    const actions: { label: string; icon: React.ForwardRefExoticComponent<any>; color: string; divider?: boolean; hasSubmenu?: boolean }[] = [
      { label: 'Open', icon: ExternalLink, color: 'text-gray-700' },
      { label: 'Download', icon: Download, color: 'text-[#5D5FEF]' },
    ];

    // Add Rename option for both files and folders
    actions.push({ label: 'Rename', icon: Pencil, color: 'text-gray-700' });

    // Add Move option for files (always, even if no folders available - can move to root)
    if (!isFolder) {
      actions.push({ label: 'Move', icon: FolderInput, color: 'text-gray-700', hasSubmenu: true });
    }

    // Add Share option for files
    if (!isFolder) {
      actions.push({ label: 'Share', icon: Share2, color: 'text-[#5D5FEF]' });
    }

    actions.push({ label: 'Delete', icon: Trash2, color: 'text-red-500', divider: true });

    return actions;
  };

  const executeAction = (e: React.MouseEvent, label: string, file: FileItem, targetFolder?: FileItem) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setHoveredSubmenu(null);
    if (onAction) onAction(label, file, targetFolder);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseDown={handleGridMouseDown}
    >
    <div className={`grid ${mobileColumns === 3 ? 'grid-cols-3 gap-2' : 'grid-cols-2 gap-3'} sm:grid-cols-2 sm:gap-3 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-6 lg:gap-8`}>
      {files.map((file) => {
        const isSelected = selectedFileId === file.id;
        const isDragSelected = selectedIds.has(file.id);
        const isMenuOpen = activeMenuId === file.id;
        const isImage = file.type === 'image';
        const isVideo = file.type === 'video';
        const isPdf = file.type === 'pdf';

        if (file.isFolder) {
          return (
            <div 
              key={file.id}
              data-file-id={file.id}
              onClick={(e) => handleCardClick(e, file)}
              onDragOver={(e) => handleFolderDragOver(e, file.id)}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, file)}
              className={`group relative flex flex-col cursor-pointer select-none transition-all duration-300 touch-manipulation active:scale-[0.97] md:hover:-translate-y-1 ${isMenuOpen ? 'z-50' : 'z-0'} ${dragOverFolderId === file.id ? 'ring-4 ring-[#5D5FEF] ring-offset-2 scale-[1.03]' : ''}`}
            >
              {/* Drag-select checkbox */}
              {(isDragSelected || selectedIds.size > 0) && (
                <div
                  className={`absolute -top-2 -left-2 z-[70] w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isDragSelected ? 'bg-[#5D5FEF] border-[#5D5FEF] text-white shadow-lg' : 'bg-white/90 border-gray-300 backdrop-blur-sm opacity-0 md:group-hover:opacity-100'
                  }`}
                  role="checkbox"
                  aria-checked={isDragSelected}
                  aria-label={`Select ${file.name}`}
                  onClick={(e) => { e.stopPropagation(); handleCardClick({ ...e, ctrlKey: true } as any, file); }}
                >
                  {isDragSelected && <Check className="w-3.5 h-3.5" />}
                </div>
              )}
              <div className="absolute -top-1.5 left-5 w-14 h-5 bg-[#5D5FEF] rounded-t-2xl transition-opacity md:group-hover:opacity-100 opacity-100 shadow-md" />
              
              <div className={`relative w-full aspect-[1.6/1] rounded-2xl sm:rounded-3xl bg-[#5D5FEF] transition-all duration-300 border border-[#5D5FEF] ${
                isDragSelected
                  ? 'ring-4 ring-[#5D5FEF]/40 shadow-2xl'
                  : isSelected 
                  ? 'ring-4 ring-[#5D5FEF]/30 shadow-2xl' 
                  : 'shadow-xl shadow-[#5D5FEF]/15 md:hover:shadow-2xl md:hover:shadow-[#5D5FEF]/40'
              }`}>
                <div className="absolute inset-0 rounded-2xl sm:rounded-3xl overflow-hidden pointer-events-none">
                   <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-white/10 rounded-full blur-[60px]" />
                </div>

                <button 
                  onClick={(e) => toggleMenu(e, file.id)}
                  className={`absolute top-2 right-2 z-[60] p-1.5 rounded-xl transition-all ${
                    isMenuOpen ? 'opacity-100 bg-white/20 text-white' : 'text-white/60 md:hover:text-white md:hover:bg-white/10 opacity-0 md:group-hover:opacity-100'
                  }`}
                >
                  <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <div className="absolute inset-0 p-3 sm:p-4 md:p-5 flex flex-col pointer-events-none">
                  <div className="flex justify-between items-start">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 flex-shrink-0">
                      <CustomFolderIcon className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
                    </div>
                    
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-white/15 select-none leading-none mt-1 mr-2 sm:mr-4">
                      {file.itemCount ?? 0}
                    </span>
                  </div>

                  <div className="mt-auto">
                    <h3 className="text-sm sm:text-base md:text-[17px] font-bold text-white tracking-tight truncate pr-4 sm:pr-6">
                      {file.name}
                    </h3>
                    <p className="text-[7px] sm:text-[8px] font-bold text-white/60 uppercase tracking-[0.2em] mt-0.5">
                      {file.itemCount ?? 0} {(file.itemCount ?? 0) === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </div>

                {isFolderLocked?.(file) && (
                  <img
                    src={LOCK_ICON_SRC}
                    alt=""
                    className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-10 w-5 h-5 sm:w-6 sm:h-6 opacity-90 pointer-events-none"
                    title="Locked — enter PIN to open"
                    aria-hidden
                  />
                )}

                {!isFolderLocked?.(file) && file.hasSubfolders && (
                  <img
                    src={STACKS_ICON_SRC}
                    alt=""
                    className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-10 w-5 h-5 sm:w-6 sm:h-6 opacity-70 pointer-events-none"
                    title="Contains subfolders"
                    aria-hidden
                  />
                )}

                {isMenuOpen && (
                  <div
                    ref={menuRef}
                    className="absolute right-0 top-12 z-[100] w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 animate-in fade-in zoom-in duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {getMenuActions(true).map((action, idx) => (
                      <React.Fragment key={idx}>
                        {action.divider && <div className="my-1 border-t border-gray-50" />}
                        <button
                          onClick={(e) => executeAction(e, action.label, file)}
                          className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-bold hover:bg-gray-50 transition-colors ${action.color}`}
                        >
                          <action.icon className="w-4 h-4" />
                          {action.label}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }

        return (
          <div 
            key={file.id}
            data-file-id={file.id}
            draggable={!file.isFolder && selectedIds.size === 0}
            onDragStart={(e) => handleDragStart(e, file)}
            onClick={(e) => handleCardClick(e, file)}
            className={`group relative flex flex-col p-3 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all duration-300 cursor-pointer select-none bg-white aspect-[3/4] touch-manipulation active:scale-[0.97] ${
              isDragSelected
                ? 'border-[#5D5FEF] shadow-xl ring-4 ring-[#5D5FEF]/20'
                : isSelected 
                ? 'border-[#5D5FEF] shadow-xl ring-4 ring-[#5D5FEF]/5' 
                : 'border-gray-200 shadow-md shadow-gray-200/20 md:hover:border-gray-300 md:hover:shadow-2xl md:hover:shadow-gray-200/40 md:hover:-translate-y-1'
            } ${isMenuOpen ? 'z-50' : 'z-0'}`}
          >
            {/* Drag-select checkbox */}
            {(isDragSelected || selectedIds.size > 0) && (
              <div
                className={`absolute top-1.5 left-1.5 z-[70] w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  isDragSelected ? 'bg-[#5D5FEF] border-[#5D5FEF] text-white shadow-lg' : 'bg-white/80 border-gray-300 backdrop-blur-sm opacity-0 md:group-hover:opacity-100'
                }`}
                role="checkbox"
                aria-checked={isDragSelected}
                aria-label={`Select ${file.name}`}
                onClick={(e) => { e.stopPropagation(); handleCardClick({ ...e, ctrlKey: true } as any, file); }}
              >
                {isDragSelected && <Check className="w-3.5 h-3.5" />}
              </div>
            )}
            <button 
              onClick={(e) => toggleMenu(e, file.id)}
              aria-label={`More actions for ${file.name}`}
              className={`absolute top-2 right-2 z-[60] p-1.5 rounded-xl transition-all ${
                isMenuOpen ? 'opacity-100 text-[#5D5FEF] bg-[#5D5FEF]/5' : 'text-gray-300 md:hover:text-[#5D5FEF] md:hover:bg-[#5D5FEF]/5 opacity-0 md:group-hover:opacity-100'
              }`}
            >
              <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <div className="w-full flex-1 flex items-center justify-center rounded-xl sm:rounded-2xl transition-all duration-500 relative overflow-hidden bg-gray-50/80 md:group-hover:bg-[#5D5FEF]/5 mb-2 sm:mb-3">
              <div className="relative w-full h-full transform transition-transform duration-500 md:group-hover:scale-105 flex items-center justify-center">
                {isImage ? (
                  <img
                    src={file.url || `/images/photo_placeholder.png`}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/images/photo_placeholder.png';
                    }}
                  />
                ) : isVideo ? (
                  <div className="relative w-full h-full bg-gray-900 flex items-center justify-center">
                    {file.url ? (
                      <video
                        src={file.url}
                        className="w-full h-full object-cover opacity-60"
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src="/images/video_placeholder.png"
                        className="w-full h-full object-cover opacity-40"
                        alt="video preview"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                        <div className="w-0 h-0 border-t-[5px] sm:border-t-[6px] border-t-transparent border-l-[8px] sm:border-l-[10px] border-l-white border-b-[5px] sm:border-b-[6px] border-b-transparent ml-0.5 sm:ml-1" />
                      </div>
                    </div>
                  </div>
                ) : isPdf ? (
                  <PdfBookThumbnail file={file} isPdf enabled={pdfThumbnails} />
                ) : file.type === 'code' ? (
                  <div className="relative w-full h-full bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
                    <div className="absolute inset-0 opacity-[0.07]">
                      <div className="absolute top-2 left-3 text-[6px] font-mono text-emerald-900 leading-relaxed">
                        <div>{'const fn = () => {'}</div>
                        <div>&nbsp;&nbsp;{'return data;'}</div>
                        <div>{'};'}</div>
                        <div>{'export default fn;'}</div>
                      </div>
                    </div>
                    <FileIcon type={file.type} fileName={file.name} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-emerald-500 group-hover:text-emerald-600 transition-colors relative z-10" />
                    <div className="absolute bottom-1.5 right-2 text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-emerald-400/60 font-mono">
                      {file.name.split('.').pop()?.toUpperCase()}
                    </div>
                  </div>
                ) : file.type === 'data' ? (
                  <div className="relative w-full h-full bg-gradient-to-br from-amber-50 to-yellow-50 flex items-center justify-center">
                    <div className="absolute inset-0 opacity-[0.07]">
                      <div className="absolute top-2 left-3 text-[6px] font-mono text-amber-900 leading-relaxed">
                        <div>{'{'}</div>
                        <div>&nbsp;&nbsp;{'"key": "value",'}</div>
                        <div>&nbsp;&nbsp;{'"items": [...]'}</div>
                        <div>{'}'}</div>
                      </div>
                    </div>
                    <FileIcon type={file.type} fileName={file.name} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-amber-500 group-hover:text-amber-600 transition-colors relative z-10" />
                    <div className="absolute bottom-1.5 right-2 text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-amber-400/60 font-mono">
                      {file.name.split('.').pop()?.toUpperCase()}
                    </div>
                  </div>
                ) : file.type === 'config' ? (
                  <div className="relative w-full h-full bg-gradient-to-br from-slate-50 to-zinc-100 flex items-center justify-center">
                    <div className="absolute inset-0 opacity-[0.06]">
                      <div className="absolute top-2 left-3 text-[6px] font-mono text-slate-900 leading-relaxed">
                        <div>{'# config'}</div>
                        <div>{'key = value'}</div>
                        <div>{'enabled = true'}</div>
                      </div>
                    </div>
                    <FileIcon type={file.type} fileName={file.name} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-slate-500 group-hover:text-slate-600 transition-colors relative z-10" />
                    <div className="absolute bottom-1.5 right-2 text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-slate-400/60 font-mono">
                      {file.name.split('.').pop()?.toUpperCase()}
                    </div>
                  </div>
                ) : file.type === 'audio' ? (
                  <div className="relative w-full h-full overflow-hidden">
                    <img
                      src="/images/music_placeholder.png"
                      alt="Music"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : file.type === 'archive' ? (
                  <div className="relative w-full h-full bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
                    <div className="absolute inset-0 opacity-[0.08]">
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-8 h-12 border-2 border-orange-300 rounded-sm">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-full border-x border-orange-300" />
                      </div>
                    </div>
                    <FileIcon type={file.type} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-orange-500 group-hover:text-orange-600 transition-colors relative z-10" />
                    <div className="absolute bottom-1.5 right-2 text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-orange-400/60 font-mono">
                      {file.name.split('.').pop()?.toUpperCase()}
                    </div>
                  </div>
                ) : file.type === 'spreadsheet' ? (
                  <div className="relative w-full h-full bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
                    <div className="absolute inset-0 opacity-[0.08]">
                      <div className="absolute top-3 left-3 right-3 bottom-3 grid grid-cols-3 grid-rows-3 gap-[1px]">
                        {[...Array(9)].map((_, i) => (
                          <div key={i} className="bg-green-300 rounded-[1px]" />
                        ))}
                      </div>
                    </div>
                    <FileIcon type={file.type} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-green-500 group-hover:text-green-600 transition-colors relative z-10" />
                  </div>
                ) : file.type === 'book' ? (
                  <PdfBookThumbnail file={file} enabled={pdfThumbnails} />
                ) : (
                  <FileIcon type={file.type} fileName={file.name} className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-gray-400 group-hover:text-[#5D5FEF] transition-colors" />
                )}
              </div>
            </div>

            <div className="overflow-hidden">
              <div className="flex items-center gap-1 mb-0.5 pr-4 sm:pr-6">
                <h3 className="text-xs sm:text-sm md:text-[14px] font-bold text-gray-800 truncate min-w-0 group-hover:text-[#5D5FEF] transition-colors">
                  {file.name}
                </h3>
                {aiRenamedSet && file.category && (() => {
                  const relPath = file.id.replace(`server-${file.category}-`, '');
                  return aiRenamedSet.has(`${file.category}/${relPath}`);
                })() && (
                  <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#5D5FEF] flex-shrink-0" title="Renamed by AI" />
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[6px] sm:text-[7px] font-black uppercase tracking-[0.1em] px-1 sm:px-1.5 py-0.5 rounded-md sm:rounded-lg bg-gray-100 text-gray-500 group-hover:bg-[#5D5FEF]/10 group-hover:text-[#5D5FEF] transition-colors">
                  {file.type}
                </span>
                <span className="text-[8px] sm:text-[9px] font-bold text-gray-400">
                  {file.size}
                </span>
              </div>
            </div>

            {isMenuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 top-12 z-[100] w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {getMenuActions(false).map((action, idx) => (
                  <React.Fragment key={idx}>
                    {action.divider && <div className="my-1 border-t border-gray-50" />}
                    <div
                      className="relative"
                      onMouseEnter={() => action.hasSubmenu && setHoveredSubmenu(action.label)}
                      onMouseLeave={() => action.hasSubmenu && setHoveredSubmenu(null)}
                    >
                      <button
                        onClick={(e) => !action.hasSubmenu && executeAction(e, action.label, file)}
                        className={`flex items-center justify-between w-full px-4 py-2.5 text-sm font-bold hover:bg-gray-50 transition-colors ${action.color}`}
                      >
                        <div className="flex items-center gap-3">
                          <action.icon className="w-4 h-4" />
                          {action.label}
                        </div>
                        {action.hasSubmenu && <ChevronRight className="w-4 h-4" />}
                      </button>

                      {action.hasSubmenu && hoveredSubmenu === action.label && (
                        <div
                          ref={submenuRef}
                          className="absolute left-full top-0 ml-1 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 animate-in fade-in zoom-in duration-200 max-h-[240px] overflow-y-auto custom-scrollbar"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Option to move to root folder */}
                          {file.parentId && (
                            <>
                              <button
                                onClick={(e) => executeAction(e, 'MoveToRoot', file)}
                                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-bold hover:bg-gray-50 transition-colors text-gray-700"
                              >
                                <CustomFolderIcon className="w-4 h-4 text-[#5D5FEF]" />
                                <span className="truncate">Root Folder</span>
                              </button>
                              {availableFolders.length > 0 && <div className="my-1 border-t border-gray-50" />}
                            </>
                          )}

                          {/* List of available folders */}
                          {availableFolders.length === 0 && !file.parentId ? (
                            <div className="px-4 py-2.5 text-sm text-gray-400">No folders available</div>
                          ) : (
                            availableFolders.map((folder) => (
                              <button
                                key={folder.id}
                                onClick={(e) => executeAction(e, 'Move', file, folder)}
                                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-bold hover:bg-gray-50 transition-colors text-gray-700"
                              >
                                <CustomFolderIcon className="w-4 h-4 text-[#5D5FEF]" />
                                <span className="truncate">{folder.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>

      {/* Rubber band selection rectangle */}
      {dragSelectRect && (
        <div
          className="absolute border-2 border-[#5D5FEF]/60 bg-[#5D5FEF]/[0.08] rounded-sm pointer-events-none z-[200]"
          style={{
            left: dragSelectRect.x,
            top: dragSelectRect.y,
            width: dragSelectRect.w,
            height: dragSelectRect.h,
          }}
        />
      )}

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900 text-white rounded-2xl shadow-2xl shadow-black/30 px-6 py-3 flex items-center gap-4">
          <span className="text-sm font-black">{selectedIds.size} selected</span>
          <div className="w-px h-5 bg-gray-700" />
          <button onClick={handleBulkDownload} className="flex items-center gap-2 text-sm font-bold hover:text-[#5D5FEF] transition-colors">
            <Download className="w-4 h-4" />
            Download
          </button>
          <button onClick={handleBulkDelete} className="flex items-center gap-2 text-sm font-bold hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="p-1 rounded-lg hover:bg-gray-800 transition-colors ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default FileGrid;
