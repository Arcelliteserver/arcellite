import React, { useState } from 'react';
import {
  ChevronLeft,
  FolderPlus,
  Folder,
  List,
  Grid,
  ArrowUpDown,
} from 'lucide-react';
import FileGrid from '../files/FileGrid';
import FileListView from '../files/FileListView';
import { FileItem } from '../../types';

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
}

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
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'date') return b.modifiedTimestamp - a.modifiedTimestamp;
    if (sortBy === 'size') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
    return 0;
  });

  const currentCategoryLabel = activeCategory === 'photos' ? 'Photos' : activeCategory === 'videos' ? 'Videos' : activeCategory === 'music' ? 'Music' : 'Files';

  return (
    <div className="animate-in fade-in duration-300">
      {/* Folder Navigation Bar */}
      {currentFolderId && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={onGoBack}
            className="flex items-center gap-1 px-3 py-2 bg-white text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-100 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>
      )}

      {/* Controls Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateFolder}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-100 active:scale-95 transition-all"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New
          </button>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1 px-3 py-2 bg-white text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-100 active:scale-95 transition-all"
            >
              <ArrowUpDown className="w-3 h-3" />
              {sortBy === 'date' ? 'Date' : sortBy === 'name' ? 'Name' : 'Size'}
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute left-0 top-full mt-1 bg-white rounded-xl border border-gray-100 shadow-xl z-20 py-1 min-w-[120px] animate-in fade-in slide-in-from-top-1 duration-150">
                  {(['date', 'name', 'size'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSortBy(s); setShowSortMenu(false); }}
                      className={`w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest transition-all ${
                        sortBy === s ? 'text-[#5D5FEF] bg-[#5D5FEF]/5' : 'text-gray-500'
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-0.5 p-0.5 bg-gray-50 rounded-xl border border-gray-100">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-[#5D5FEF] shadow-sm' : 'text-gray-400'}`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-[#5D5FEF] shadow-sm' : 'text-gray-400'}`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Folders */}
      {filteredFolders.length > 0 && (
        <div className="mb-6">
          <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.25em] mb-3 ml-1">
            Collections
          </p>
          <FileGrid
            files={filteredFolders}
            onFileClick={onFileClick}
            selectedFileId={selectedFile?.id}
            allFiles={files}
            onAction={onFileAction}
            availableFolders={filteredFolders}
            pdfThumbnails={pdfThumbnails}
            aiRenamedSet={aiRenamedSet}
          />
        </div>
      )}

      {/* Files */}
      <div className="mb-6">
        <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.25em] mb-3 ml-1">
          Assets
        </p>
        {sortedFiles.length > 0 ? (
          viewMode === 'grid' ? (
            <FileGrid
              files={sortedFiles}
              onFileClick={onFileClick}
              selectedFileId={selectedFile?.id}
              allFiles={files}
              onAction={onFileAction}
              availableFolders={filteredFolders}
              pdfThumbnails={pdfThumbnails}
              aiRenamedSet={aiRenamedSet}
            />
          ) : (
            <FileListView
              files={sortedFiles}
              onFileClick={onFileClick}
              selectedFileId={selectedFile?.id}
              onAction={onFileAction}
              availableFolders={filteredFolders}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 opacity-40">
            <Folder className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">
              No {currentCategoryLabel} Yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileFiles;
