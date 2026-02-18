
import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Download, Trash2, ExternalLink, Pencil, FolderInput, ChevronRight } from 'lucide-react';
import { FileItem } from '../../types';
import FileIcon from './FileIcon';

interface FileListViewProps {
  files: FileItem[];
  onFileClick: (file: FileItem) => void;
  selectedFileId?: string;
  onAction?: (action: string, file: FileItem, targetFolder?: FileItem) => void;
  availableFolders?: FileItem[];
  onFileDrop?: (file: FileItem, targetFolder: FileItem) => void;
}

const FileListView: React.FC<FileListViewProps> = ({ files, onFileClick, selectedFileId, onAction, availableFolders, onFileDrop }) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [hoveredSubmenu, setHoveredSubmenu] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent, file: FileItem) => {
    if (file.isFolder) return;
    e.dataTransfer.setData('application/json', JSON.stringify(file));
    e.dataTransfer.effectAllowed = 'move';
    const ghost = document.createElement('div');
    ghost.className = 'bg-white shadow-2xl rounded-xl px-4 py-2 text-sm font-bold text-gray-800 border border-[#5D5FEF]/30';
    ghost.textContent = file.name;
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleRowDragOver = (e: React.DragEvent, file: FileItem) => {
    if (!file.isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(file.id);
  };

  const handleRowDragLeave = () => {
    setDragOverId(null);
  };

  const handleRowDrop = (e: React.DragEvent, targetFolder: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    if (!targetFolder.isFolder) return;
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
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
        setHoveredSubmenu(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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
    setHoveredSubmenu(null);
  };

  const executeAction = (e: React.MouseEvent, label: string, file: FileItem, targetFolder?: FileItem) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setHoveredSubmenu(null);
    if (onAction) onAction(label, file, targetFolder);
  };

  return (
    <div className="w-full">
      {/* Table header */}
      <div className="hidden sm:flex items-center px-6 py-2 text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">
        <div className="flex-1 min-w-0">Name</div>
        <div className="w-32 ml-4">Modified</div>
        <div className="w-20 text-right ml-4">Size</div>
        <div className="w-16 ml-6"></div>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {files.map((file) => {
          const isMenuOpen = activeMenuId === file.id;
          return (
            <div
              key={file.id}
              draggable={!file.isFolder}
              onDragStart={(e) => handleDragStart(e, file)}
              onDragOver={(e) => handleRowDragOver(e, file)}
              onDragLeave={handleRowDragLeave}
              onDrop={(e) => handleRowDrop(e, file)}
              onClick={() => onFileClick(file)}
              className={`flex items-center justify-between px-6 py-3.5 rounded-2xl transition-all cursor-pointer group border relative touch-manipulation ${
                dragOverId === file.id
                  ? 'bg-[#5D5FEF]/10 border-[#5D5FEF] ring-2 ring-[#5D5FEF]/30 shadow-lg'
                  : selectedFileId === file.id
                  ? 'bg-[#5D5FEF]/5 border-[#5D5FEF]/10 shadow-sm'
                  : 'bg-white border-transparent hover:bg-gray-50/80 hover:border-gray-100'
              }`}
            >
              <div className="flex items-center gap-5 flex-1 min-w-0">
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all flex-shrink-0 ${
                  file.isFolder ? 'bg-[#5D5FEF] text-white shadow-md shadow-[#5D5FEF]/20'
                  : file.type === 'code' ? 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-100 group-hover:text-emerald-600'
                  : file.type === 'data' ? 'bg-amber-50 text-amber-500 group-hover:bg-amber-100 group-hover:text-amber-600'
                  : file.type === 'config' ? 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-600'
                  : file.type === 'pdf' ? 'bg-red-50 text-red-500 group-hover:bg-red-100 group-hover:text-red-600'
                  : file.type === 'audio' ? 'bg-violet-50 text-violet-500 group-hover:bg-violet-100 group-hover:text-violet-600'
                  : file.type === 'archive' ? 'bg-orange-50 text-orange-500 group-hover:bg-orange-100 group-hover:text-orange-600'
                  : file.type === 'spreadsheet' ? 'bg-green-50 text-green-500 group-hover:bg-green-100 group-hover:text-green-600'
                  : file.type === 'book' ? 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                  : file.type === 'image' ? 'bg-sky-50 text-sky-500 group-hover:bg-sky-100 group-hover:text-sky-600'
                  : file.type === 'video' ? 'bg-pink-50 text-pink-500 group-hover:bg-pink-100 group-hover:text-pink-600'
                  : 'bg-gray-50 text-gray-400 group-hover:bg-white group-hover:text-[#5D5FEF]'
                }`}>
                  <FileIcon type={file.type} fileName={file.name} className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-800 tracking-tight block truncate group-hover:text-[#5D5FEF] transition-colors">
                    {file.name}
                  </span>
                  {file.isFolder && file.hasSubfolders && (
                    <img
                      src="/assets/icons/stacks_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg"
                      alt=""
                      className="w-4 h-4 opacity-50 flex-shrink-0"
                      aria-hidden
                    />
                  )}
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider sm:hidden">{file.type} • {file.size || '--'}</span>
                </div>
              </div>
              
              <div className="hidden sm:flex items-center gap-4 text-sm text-gray-400 font-medium ml-4">
                <span className="w-32 truncate text-xs">{file.modified}</span>
                <span className="w-20 text-right text-xs">{file.isFolder ? '--' : file.size}</span>
              </div>

              <div className="flex items-center ml-6 relative" ref={isMenuOpen ? menuRef : undefined}>
                <button
                  onClick={(e) => toggleMenu(e, file.id)}
                  className={`p-2 rounded-xl transition-colors ${isMenuOpen ? 'bg-gray-100 text-gray-600' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'}`}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Context Menu */}
                {isMenuOpen && onAction && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 min-w-[160px] animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      onClick={(e) => executeAction(e, 'Open', file)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open
                    </button>
                    {!file.isFolder && (
                      <button
                        onClick={(e) => executeAction(e, 'Download', file)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-[#5D5FEF] hover:bg-gray-50 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    )}
                    <button
                      onClick={(e) => executeAction(e, 'Rename', file)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Rename
                    </button>
                    {!file.isFolder && availableFolders && availableFolders.length > 0 && (
                      <div
                        className="relative"
                        onMouseEnter={() => setHoveredSubmenu(file.id)}
                        onMouseLeave={() => setHoveredSubmenu(null)}
                      >
                        <button className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                          <span className="flex items-center gap-3">
                            <FolderInput className="w-3.5 h-3.5" />
                            Move
                          </span>
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                        </button>
                        {hoveredSubmenu === file.id && (
                          <div className="absolute left-full top-0 ml-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 min-w-[140px] max-h-48 overflow-y-auto z-50">
                            {availableFolders.filter(f => f.id !== file.id).map(folder => (
                              <button
                                key={folder.id}
                                onClick={(e) => executeAction(e, 'Move', file, folder)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors truncate"
                              >
                                <FolderInput className="w-3 h-3 text-[#5D5FEF] flex-shrink-0" />
                                <span className="truncate">{folder.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={(e) => executeAction(e, 'Delete', file)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FileListView;
