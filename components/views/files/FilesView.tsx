import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
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
import { FileItem } from '../../../types';

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
  aiRenamedSet?: Set<string>;
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
  aiRenamedSet,
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
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Welcome Banner - Only show on Overview */}
      {activeTab === 'overview' && showBanner && !currentFolderId && (
        <div className="mb-6 sm:mb-7 md:mb-8 lg:mb-12 relative group animate-in slide-in-from-top-4 duration-500">
          <div className="w-full bg-[#F0F7FF] rounded-2xl md:rounded-3xl lg:rounded-[2.5rem] border border-[#E1F0FF] p-5 sm:p-6 md:p-7 lg:p-10 flex flex-col md:flex-row items-center justify-between overflow-hidden shadow-sm relative">
            {/* Rich Illustration Area */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-5 md:gap-6 lg:gap-10 mb-4 sm:mb-5 md:mb-0 relative z-10 w-full md:w-auto">
              {/* Icons Section */}
              <div className="relative flex-shrink-0">
                {/* Glow background */}
                <div className="absolute inset-0 bg-[#5D5FEF]/15 blur-3xl rounded-full scale-150" />

                <div className="relative flex items-center justify-center">
                  {/* Monitor Icon */}
                  <Monitor className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 text-[#5D5FEF] stroke-[1.2] relative" />
                  {/* Floating elements */}
                  <div className="absolute -top-4 sm:-top-4 md:-top-5 lg:-top-6 -right-3 sm:-right-3 md:-right-4 bg-white p-1.5 sm:p-1.5 md:p-2 lg:p-2.5 rounded-xl sm:rounded-xl md:rounded-2xl shadow-xl border border-blue-50 transition-all">
                    <Cloud className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 text-[#5D5FEF] fill-[#5D5FEF]/10" />
                  </div>
                  <div className="absolute -bottom-3 sm:-bottom-3 md:-bottom-4 -left-4 sm:-left-4 md:-left-5 lg:-left-6 bg-white p-1.5 sm:p-1.5 md:p-2 lg:p-2.5 rounded-xl sm:rounded-xl md:rounded-2xl shadow-xl border border-blue-50 transition-all">
                    <FileText className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-7 lg:h-7 text-[#5D5FEF]" />
                  </div>
                </div>
              </div>
              {/* Text Section */}
              <div className="flex-1 min-w-0 text-left md:max-w-sm lg:max-w-lg xl:max-w-xl">
                <h3 className="text-xl sm:text-xl md:text-2xl lg:text-3xl font-black text-gray-900 leading-tight mb-2 tracking-tight">
                  Arcellite Personal Cloud Active.
                </h3>
                <p className="text-xs sm:text-sm md:text-sm lg:text-base text-gray-500 font-medium leading-relaxed mb-4 sm:mb-5 md:mb-6">
                  Secure, high-speed file management running directly on your server cluster. Experience total control over your digital assets with distributed redundancy.
                </p>
                {/* Action Button */}
                <div className="relative z-10 w-fit">
                  <button
                    onClick={() => setActiveTab('server')}
                    className="flex items-center justify-center gap-2 sm:gap-2 md:gap-3 px-5 sm:px-6 md:px-7 lg:px-8 py-3 sm:py-3 md:py-3.5 lg:py-4 bg-[#5D5FEF] text-white rounded-xl md:rounded-xl lg:rounded-2xl font-black text-[10px] sm:text-[10px] md:text-xs lg:text-xs uppercase tracking-[0.2em] shadow-2xl shadow-[#5D5FEF]/30 hover:bg-[#4D4FCF] transition-all active:scale-95 group/btn"
                  >
                    <Sliders className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 group-hover/btn:rotate-45 transition-transform" />
                    <span className="hidden md:inline">Manage Infrastructure</span>
                    <span className="md:hidden">Manage</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Storage Icon - Right side */}
            <div className="hidden md:flex flex-shrink-0 items-center justify-center relative">
              <div className="absolute inset-0 bg-[#5D5FEF]/10 blur-3xl rounded-full scale-125" />
              <img
                src="/assets/icons/storage_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg"
                alt="Storage"
                className="w-32 h-32 lg:w-48 lg:h-48 opacity-70 relative"
              />
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowBanner(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 md:top-5 md:right-5 lg:top-6 lg:right-8 p-2 sm:p-2 md:p-2.5 text-gray-300 hover:text-gray-600 transition-colors bg-white/50 backdrop-blur-sm rounded-full border border-transparent hover:border-gray-100"
              aria-label="Close banner"
            >
              <X className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header with Controls */}
      <div className="flex flex-row items-center justify-between mb-4 sm:mb-6 md:mb-10 gap-3 sm:gap-4">
        <div className="relative flex-1 min-w-0">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 capitalize pl-3 sm:pl-4 md:pl-6 relative">
            {activeTab === 'overview' ? 'Overview' : activeTab.replace('-', ' ')}
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h2>
        </div>
        {showFileControls && (
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {currentFolderId && onGoBack && (
              <button
                onClick={onGoBack}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 bg-white text-gray-600 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-gray-100 hover:bg-gray-50 transition-all"
              >
                <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                <span>Back</span>
              </button>
            )}
            {showNewFolder && (
              <button
                onClick={createFolder}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 bg-white text-gray-600 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-gray-100 hover:bg-gray-50 transition-all"
              >
                <FolderPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                <span className="hidden sm:inline">New Folder</span>
                <span className="sm:hidden">New</span>
              </button>
            )}

            {/* Overview-only: Sort By dropdown */}
            {isOverview && (
              <div className="relative" ref={sortMenuRef}>
                <button
                  onClick={() => { setShowSortMenu(!showSortMenu); setShowTypeMenu(false); }}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 bg-white text-gray-600 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-gray-100 hover:bg-gray-50 transition-all"
                >
                  <ArrowUpDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">{sortBy === 'date' ? 'Date' : sortBy === 'name' ? 'Name' : 'Size'}</span>
                  <ChevronDown className={`w-2.5 h-2.5 text-gray-400 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-black/8 z-50 py-2 min-w-[140px] animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden">
                    {sortOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                        className={`w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 ${
                          sortBy === opt.value
                            ? 'text-[#5D5FEF] bg-[#5D5FEF]/5'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                        }`}
                      >
                        {sortBy === opt.value && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#5D5FEF]" />
                        )}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Overview-only: Type Filter dropdown (styled like profile/notification dropdown) */}
            {isOverview && (
              <div className="relative" ref={typeMenuRef}>
                <button
                  onClick={() => { setShowTypeMenu(!showTypeMenu); setShowSortMenu(false); }}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all ${
                    typeFilter !== 'all'
                      ? 'bg-[#5D5FEF]/5 text-[#5D5FEF] border-[#5D5FEF]/20'
                      : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">{currentTypeLabel}</span>
                  <ChevronDown className={`w-2.5 h-2.5 transition-transform ${typeFilter !== 'all' ? 'text-[#5D5FEF]/60' : 'text-gray-400'} ${showTypeMenu ? 'rotate-180' : ''}`} />
                </button>
                {showTypeMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-black/8 z-50 py-2 min-w-[170px] animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden">
                    {typeFilterOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setTypeFilter(opt.value); setShowTypeMenu(false); }}
                        className={`w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 ${
                          typeFilter === opt.value
                            ? 'text-[#5D5FEF] bg-[#5D5FEF]/5'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                        }`}
                      >
                        <span className={typeFilter === opt.value ? 'text-[#5D5FEF]' : 'text-gray-400'}>{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Grid/List toggle — all tabs */}
            <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-gray-50 rounded-lg sm:rounded-xl border border-gray-100">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-[#5D5FEF] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                aria-label="List view"
              >
                <List className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-[#5D5FEF] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                aria-label="Grid view"
              >
                <Grid className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Folders Section — always grid cards */}
      {filteredFolders.length > 0 && (
        <div className="mb-8 sm:mb-10 md:mb-14">
          <p className="text-[9px] sm:text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] mb-4 sm:mb-6 md:mb-8 ml-1">
            {isOverview ? 'Recent Collections' : 'Collections'}
          </p>
          <FileGrid
            files={filteredFolders}
            onFileClick={handleFileClick}
            selectedFileId={selectedFile?.id}
            allFiles={files}
            onAction={handleFileAction}
            availableFolders={filteredFolders}
            pdfThumbnails={pdfThumbnails}
            aiRenamedSet={aiRenamedSet}
          />
        </div>
      )}

      {/* Files Section — grid/list toggle only affects overview */}
      <div className="mb-6 sm:mb-8">
        <p className="text-[9px] sm:text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] mb-4 sm:mb-6 md:mb-8 ml-1">
          {isOverview ? 'Recent Assets' : 'Assets'}
        </p>
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
              aiRenamedSet={aiRenamedSet}
            />
          ) : (
            <FileListView
              files={displayFiles}
              onFileClick={handleFileClick}
              selectedFileId={selectedFile?.id}
              onAction={handleFileAction}
              availableFolders={filteredFolders}
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
