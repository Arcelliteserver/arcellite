import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FolderPlus,
  FileText,
  Monitor,
  Sliders,
  Folder,
  List,
  Grid,
  Cloud,
  ArrowUpDown,
  Image as ImageIcon,
  FileCode,
  Music,
  Film,
  BookOpen,
  SortAsc,
  ChevronDown,
  Filter,
  ChevronLeft
} from 'lucide-react';
import FileGrid from '../../files/FileGrid';
import FileListView from '../../files/FileListView';
import { FileItem } from '@/types';

type TypeFilter = 'all' | 'images' | 'videos' | 'audio' | 'documents' | 'code' | 'books';

interface FilesViewProps {
  activeTab: string;
  showBanner: boolean;
  setShowBanner: (show: boolean) => void;
  setActiveTab: (tab: string) => void;
  currentFolderId: string | null;
  showFileControls: boolean;
  showNewFolder: boolean;
  createFolder: () => void;
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
  sortBy: 'name' | 'date' | 'size';
  setSortBy: (sort: 'name' | 'date' | 'size') => void;
  filteredFolders: FileItem[];
  filteredFilesOnly: FileItem[];
  files: FileItem[];
  handleFileClick: (file: FileItem) => void;
  handleFileAction: (action: string, file: FileItem, targetFolder?: FileItem) => void;
  selectedFile: FileItem | null;
  onGoBack?: () => void;
  pdfThumbnails?: boolean;
  videoThumbnails?: boolean;
  aiRenamedSet?: Set<string>;
  onFileDrop?: (file: FileItem, targetFolder: FileItem) => void;
  isFolderLocked?: (file: FileItem) => boolean;
  onBulkAction?: (action: string, files: FileItem[]) => void;
}

const FilesView: React.FC<FilesViewProps> = ({
  activeTab,
  showBanner,
  setShowBanner,
  setActiveTab,
  currentFolderId,
  showFileControls,
  showNewFolder,
  createFolder,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  filteredFolders,
  filteredFilesOnly,
  files,
  handleFileClick,
  handleFileAction,
  selectedFile,
  onGoBack,
  pdfThumbnails = true,
  videoThumbnails = true,
  aiRenamedSet,
  onFileDrop,
  isFolderLocked,
  onBulkAction,
}) => {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  const isOverview = activeTab === 'overview';

  // Close menus on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) {
        setShowTypeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Type priority order for sorting
  const getTypePriority = (type: string, filter: TypeFilter): number => {
    const priorities: Record<TypeFilter, Record<string, number>> = {
      all: {},
      images: { image: 0 },
      videos: { video: 0 },
      audio: { audio: 0 },
      documents: { document: 0, pdf: 0, spreadsheet: 0, data: 0 },
      code: { code: 0, config: 0 },
      books: { book: 0, pdf: 0 },
    };
    if (filter === 'all') return 0;
    const pMap = priorities[filter];
    return type in pMap ? -1 : 1;
  };

  // Apply type filter + sort to the files (only for overview)
  const displayFiles = useMemo(() => {
    let items = [...filteredFilesOnly];
    if (isOverview && typeFilter !== 'all') {
      items.sort((a, b) => {
        const pa = getTypePriority(a.type, typeFilter);
        const pb = getTypePriority(b.type, typeFilter);
        if (pa !== pb) return pa - pb;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'date') return b.modifiedTimestamp - a.modifiedTimestamp;
        if (sortBy === 'size') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
        return 0;
      });
    } else if (isOverview) {
      items.sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'size') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
        return b.modifiedTimestamp - a.modifiedTimestamp;
      });
    }
    return items;
  }, [filteredFilesOnly, typeFilter, sortBy, isOverview]);

  const typeFilterOptions: { value: TypeFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'All Types', icon: <SortAsc className="w-3.5 h-3.5" /> },
    { value: 'images', label: 'Images First', icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { value: 'videos', label: 'Videos First', icon: <Film className="w-3.5 h-3.5" /> },
    { value: 'audio', label: 'Audio First', icon: <Music className="w-3.5 h-3.5" /> },
    { value: 'documents', label: 'Docs First', icon: <FileText className="w-3.5 h-3.5" /> },
    { value: 'code', label: 'Code First', icon: <FileCode className="w-3.5 h-3.5" /> },
    { value: 'books', label: 'Books First', icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  const sortOptions: { value: 'name' | 'date' | 'size'; label: string }[] = [
    { value: 'date', label: 'Date' },
    { value: 'name', label: 'Name' },
    { value: 'size', label: 'Size' },
  ];

  const currentTypeLabel = typeFilterOptions.find(o => o.value === typeFilter)?.label || 'All Types';
  return (
    <div>
      {/* Welcome Banner - Only show on Overview */}
      {activeTab === 'overview' && showBanner && !currentFolderId && (
        <div className="mb-6 sm:mb-7 md:mb-8 lg:mb-12">
          <div className="w-full bg-[#1d1d1f] rounded-2xl md:rounded-3xl lg:rounded-[2.5rem] border-2 border-[#3a3a3d] shadow-xl shadow-black/20 p-6 sm:p-7 md:p-8 lg:p-10 flex flex-col md:flex-row items-center justify-between overflow-hidden relative">
            {/* Purple glow blob — top right */}
            <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#5D5FEF]/15 blur-3xl" />

            {/* Left: icon area + text */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-5 md:gap-6 lg:gap-10 mb-4 sm:mb-5 md:mb-0 relative z-10 w-full md:w-auto">
              {/* Monitor icon with floating badges — icons touch monitor edge, no containers */}
              <div className="relative flex-shrink-0">
                <div className="relative flex items-center justify-center">
                  <Monitor className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 text-white stroke-[1.2] relative" />
                  {/* Cloud — beside top-right of monitor, pushed up so it doesn’t touch */}
                  <div className="absolute -top-1 right-0 translate-x-1/2 -translate-y-1/2">
                    <Cloud className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 text-[#8B8DF8]" />
                  </div>
                  {/* FileText — touching bottom-left of monitor */}
                  <div className="absolute bottom-0 left-0 -translate-x-1/4 translate-y-1/4">
                    <FileText className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-7 lg:h-7 text-[#8B8DF8]" />
                  </div>
                </div>
              </div>

              {/* Text + button stacked */}
              <div className="flex-1 min-w-0 text-left md:max-w-sm lg:max-w-lg xl:max-w-xl">
                <h3 className="text-xl sm:text-xl md:text-2xl lg:text-3xl font-heading font-bold text-white leading-tight mb-2 tracking-tight">
                  Arcellite Personal Cloud Active.
                </h3>
                <p className="text-xs sm:text-sm md:text-sm lg:text-base text-white/50 font-medium leading-relaxed mb-4 sm:mb-5 md:mb-6">
                  Secure, high-speed file management running directly on your server cluster. Experience total control over your digital assets with distributed redundancy.
                </p>
                {/* Action Button */}
                <div className="relative z-10 w-fit">
                  <button
                    onClick={() => setActiveTab('system')}
                    className="flex items-center justify-center gap-2 sm:gap-2 md:gap-3 px-5 sm:px-6 md:px-7 lg:px-8 py-3 sm:py-3 md:py-3.5 lg:py-4 rounded-xl md:rounded-xl lg:rounded-2xl bg-[#5D5FEF]/15 border border-[#5D5FEF]/30 text-[#8B8DF8] font-semibold text-[10px] sm:text-[10px] md:text-xs lg:text-xs uppercase tracking-[0.15em] hover:bg-[#5D5FEF]/25 hover:border-[#5D5FEF]/50 hover:text-white transition-all active:scale-95 group/btn"
                  >
                    <Sliders className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 group-hover/btn:rotate-45 transition-transform" />
                    <span className="hidden md:inline">Manage Infrastructure</span>
                    <span className="md:hidden">Manage</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Storage icon — right side */}
            <div className="hidden md:flex flex-shrink-0 items-center justify-center relative">
              <div className="absolute inset-0 bg-[#5D5FEF]/10 blur-3xl rounded-full scale-125" />
              <img
                src="/assets/icons/storage_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg"
                alt="Storage"
                className="w-32 h-32 lg:w-48 lg:h-48 opacity-40 relative"
              />
            </div>
          </div>
        </div>
      )}

      {/* Header with Controls */}
      <div className="flex flex-row items-center justify-between mb-4 sm:mb-6 md:mb-10 gap-3 sm:gap-4">
        <div className="relative flex-1 min-w-0">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-heading font-bold tracking-tight text-gray-900 capitalize pl-3 sm:pl-4 md:pl-6 relative">
            {activeTab === 'overview' ? 'Overview' : activeTab.replace('-', ' ')}
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h2>
          <p className="text-gray-500 font-medium text-xs md:text-sm pl-3 sm:pl-4 md:pl-6 mt-1">
            {activeTab === 'overview' ? 'Browse and manage all your files in one place' :
             activeTab === 'all' ? 'Documents, PDFs, code files, and general files' :
             activeTab === 'photos' ? 'JPEG, PNG, and image collections stored on your server' :
             activeTab === 'videos' ? 'MP4, recordings, and video content from your vault' :
             activeTab === 'music' ? 'MP3, audio files, and music collections' :
             'Browse your files'}
          </p>
        </div>
        {showFileControls && (
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {currentFolderId && onGoBack && (
              <button
                onClick={onGoBack}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 bg-white text-gray-600 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-gray-200 hover:bg-gray-50 shadow-sm transition-all"
              >
                <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                <span>Back</span>
              </button>
            )}
            {showNewFolder && (
              <button
                onClick={createFolder}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 bg-[#5D5FEF] text-white rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-[#4D4FCF] shadow-sm shadow-[#5D5FEF]/25 transition-all active:scale-[0.97]"
              >
                <FolderPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                <span className="hidden sm:inline">New Folder</span>
                <span className="sm:hidden">New</span>
              </button>
            )}

            {/* Same-height toolbar: Sort, Filter, Grid/List — all h-10 */}
            {/* Overview-only: Sort toggle group */}
            {isOverview && (
              <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm h-10 box-border">
                {sortOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={`h-full min-w-0 px-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all flex items-center justify-center ${
                      sortBy === opt.value
                        ? 'bg-[#5D5FEF] text-white shadow-sm'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Overview-only: Type filter toggle group */}
            {isOverview && (
              <div className="relative h-10 flex items-stretch" ref={typeMenuRef}>
                <button
                  onClick={() => setShowTypeMenu(!showTypeMenu)}
                  className={`flex items-center gap-1.5 px-3 h-full rounded-xl text-[10px] font-bold uppercase tracking-wide border shadow-sm transition-all box-border ${
                    typeFilter !== 'all'
                      ? 'bg-[#5D5FEF] text-white border-[#5D5FEF] shadow-[#5D5FEF]/20'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline truncate">{currentTypeLabel}</span>
                  <ChevronDown className={`w-2.5 h-2.5 flex-shrink-0 transition-transform ${showTypeMenu ? 'rotate-180' : ''}`} />
                </button>
                {showTypeMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-black/8 z-50 py-2 min-w-[160px] overflow-hidden">
                    {typeFilterOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setTypeFilter(opt.value); setShowTypeMenu(false); }}
                        className={`w-full px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide transition-all flex items-center gap-2.5 ${
                          typeFilter === opt.value
                            ? 'text-[#5D5FEF] bg-[#5D5FEF]/5'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                        }`}
                      >
                        <span>{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Grid/List toggle — same h-10 as other controls */}
            <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm h-10 box-border">
              <button
                onClick={() => setViewMode('list')}
                className={`h-full aspect-square flex items-center justify-center rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#5D5FEF] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`h-full aspect-square flex items-center justify-center rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#5D5FEF] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Folders Section — always grid cards */}
      {filteredFolders.length > 0 && (
        <div className="mb-8 sm:mb-10 md:mb-14">
          <div className="mb-4 sm:mb-6 md:mb-8">
            <p className="text-[9px] sm:text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] ml-1 mb-3">
              {isOverview ? 'Recent Collections' : 'Collections'}
            </p>
            <div className="mx-1 h-px bg-gradient-to-r from-gray-200 via-gray-200 to-transparent" />
          </div>
          <FileGrid
            files={isOverview ? filteredFolders.slice(0, 6) : filteredFolders}
            onFileClick={handleFileClick}
            selectedFileId={selectedFile?.id}
            allFiles={files}
            onAction={handleFileAction}
            availableFolders={filteredFolders}
            pdfThumbnails={pdfThumbnails}
            videoThumbnails={videoThumbnails}
            aiRenamedSet={aiRenamedSet}
            onFileDrop={onFileDrop}
            isFolderLocked={isFolderLocked}
            onBulkAction={onBulkAction}
          />
        </div>
      )}

      {/* Files Section — grid/list toggle only affects overview */}
      <div className="mb-6 sm:mb-8">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <p className="text-[9px] sm:text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] ml-1 mb-3">
            {isOverview ? 'Recent Assets' : 'Assets'}
          </p>
          <div className="mx-1 h-px bg-gradient-to-r from-gray-200 via-gray-200 to-transparent" />
        </div>
        {displayFiles.length > 0 ? (
          viewMode === 'grid' ? (
            <FileGrid
              files={displayFiles}
              onFileClick={handleFileClick}
              selectedFileId={selectedFile?.id}
              allFiles={files}
              onAction={handleFileAction}
              availableFolders={filteredFolders}
              pdfThumbnails={pdfThumbnails}
              videoThumbnails={videoThumbnails}
              aiRenamedSet={aiRenamedSet}
              onFileDrop={onFileDrop}
              isFolderLocked={isFolderLocked}
              onBulkAction={onBulkAction}
            />
          ) : (
            <FileListView
              files={displayFiles}
              onFileClick={handleFileClick}
              selectedFileId={selectedFile?.id}
              onAction={handleFileAction}
              availableFolders={filteredFolders}
              onFileDrop={onFileDrop}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-32 opacity-30">
            <Folder className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              {isOverview ? 'No Recent Items' : 'Vault Section Empty'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilesView;
