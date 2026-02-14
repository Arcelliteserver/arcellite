import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  Image as ImageIcon,
  Film,
  Music,
  Cloud,
  Database,
  Share2,
  Clock,
  Folder,
  ArrowRight,
  Upload,
  Trash2,
} from 'lucide-react';
import FileGrid from '../files/FileGrid';
import { FileItem } from '../../types';

interface MobileOverviewProps {
  user: { firstName?: string | null; lastName?: string | null; avatarUrl?: string | null } | null;
  recentItems: FileItem[];
  files: FileItem[];
  onFileClick: (file: FileItem) => void;
  onFileAction: (action: string, file: FileItem, targetFolder?: FileItem) => void;
  onNavigateTab: (tab: string) => void;
  onUpload: () => void;
  pdfThumbnails?: boolean;
  aiRenamedSet?: Set<string>;
}

interface StorageData {
  totalHuman: string;
  usedHuman: string;
  availableHuman: string;
  usedPercent: number;
}

const MobileOverview: React.FC<MobileOverviewProps> = ({
  user,
  recentItems,
  files,
  onFileClick,
  onFileAction,
  onNavigateTab,
  onUpload,
  pdfThumbnails = true,
  aiRenamedSet,
}) => {
  const [storage, setStorage] = useState<StorageData | null>(null);

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const res = await fetch('/api/system/storage');
        if (res.ok) {
          const data = await res.json();
          if (data.rootStorage) {
            setStorage({
              totalHuman: data.rootStorage.totalHuman,
              usedHuman: data.rootStorage.usedHuman,
              availableHuman: data.rootStorage.availableHuman,
              usedPercent: data.rootStorage.usedPercent,
            });
          }
        }
      } catch {}
    };
    fetchStorage();
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  const firstName = user?.firstName || 'User';

  const quickActions = [
    { id: 'videos', label: 'Videos', icon: Film },
    { id: 'music', label: 'Music', icon: Music },
    { id: 'shared', label: 'Shared', icon: Share2 },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  // Use recent items for the overview, limited to first 12
  const displayItems = recentItems.slice(0, 12);
  const recentFolders = displayItems.filter(f => f.isFolder);
  const recentFiles = displayItems.filter(f => !f.isFolder);

  return (
    <div className="animate-in fade-in duration-300">
      {/* Welcome Section */}
      <div className="mb-6">
        <p className="text-sm font-bold text-gray-400 tracking-wide">{greeting}</p>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight mt-0.5">
          {firstName} <span className="text-[#5D5FEF]">✦</span>
        </h2>
      </div>

      {/* Storage Card */}
      {storage && (
        <div className="mb-6 bg-gradient-to-br from-[#5D5FEF] to-[#4D4FCF] rounded-2xl p-4 text-white shadow-lg shadow-[#5D5FEF]/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 opacity-80" />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Cloud Storage</span>
            </div>
            <span className="text-xs font-black">{storage.usedPercent}%</span>
          </div>
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-white rounded-full transition-all duration-700"
              style={{ width: `${Math.min(storage.usedPercent, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-90">
              {storage.usedHuman} of {storage.totalHuman}
            </span>
            <span className="text-xs font-bold opacity-70">
              {storage.availableHuman} free
            </span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-7">
        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] mb-3 ml-1">
          Quick Access
        </p>
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => action.id === 'upload' ? onUpload() : onNavigateTab(action.id)}
                className="flex flex-col items-center justify-center gap-2.5 py-5 rounded-2xl bg-[#5D5FEF] active:scale-95 transition-all shadow-md shadow-[#5D5FEF]/20"
              >
                <Icon className="w-[26px] h-[26px] text-white" strokeWidth={1.7} />
                <span className="text-[11px] font-semibold text-white/90">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Folders */}
      {recentFolders.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.25em]">
              Recent Collections
            </p>
            <button
              onClick={() => onNavigateTab('all')}
              className="flex items-center gap-1 text-[10px] font-black text-[#5D5FEF] uppercase tracking-wider active:opacity-60"
            >
              See All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <FileGrid
            files={recentFolders.slice(0, 6)}
            onFileClick={onFileClick}
            allFiles={files}
            onAction={onFileAction}
            availableFolders={[]}
            pdfThumbnails={pdfThumbnails}
            aiRenamedSet={aiRenamedSet}
          />
        </div>
      )}

      {/* Recent Files */}
      {recentFiles.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.25em]">
              Recent Assets
            </p>
            <button
              onClick={() => onNavigateTab('all')}
              className="flex items-center gap-1 text-[10px] font-black text-[#5D5FEF] uppercase tracking-wider active:opacity-60"
            >
              See All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <FileGrid
            files={recentFiles.slice(0, 12)}
            onFileClick={onFileClick}
            allFiles={files}
            onAction={onFileAction}
            availableFolders={[]}
            pdfThumbnails={pdfThumbnails}
            aiRenamedSet={aiRenamedSet}
            mobileColumns={3}
          />
        </div>
      )}

      {/* Empty State */}
      {displayItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 opacity-40">
          <Clock className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">
            No Recent Items
          </p>
          <p className="text-gray-300 text-xs font-medium mt-1">
            Files you open will appear here
          </p>
        </div>
      )}
    </div>
  );
};

export default MobileOverview;
