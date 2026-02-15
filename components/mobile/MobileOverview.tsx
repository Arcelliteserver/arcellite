import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Upload,
  Film,
  Music,
  ArrowRight,
  Clock,
  Folder,
  FileText,
  Image as ImageIcon,
  Code,
  File,
} from 'lucide-react';
import DrawIcon from '../DrawIcon';
import { FileItem } from '../../types';

/* Custom SVG icons from assets/icons */
const CableIcon: React.FC<{ className?: string; color?: string }> = ({ className, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className={className} fill={color}>
    <path d="M200-120q-17 0-28.5-11.5T160-160v-40h-40v-160q0-17 11.5-28.5T160-400h40v-280q0-66 47-113t113-47q66 0 113 47t47 113v400q0 33 23.5 56.5T600-200q33 0 56.5-23.5T680-280v-280h-40q-17 0-28.5-11.5T600-600v-160h40v-40q0-17 11.5-28.5T680-840h80q17 0 28.5 11.5T800-800v40h40v160q0 17-11.5 28.5T800-560h-40v280q0 66-47 113t-113 47q-66 0-113-47t-47-113v-400q0-33-23.5-56.5T360-760q-33 0-56.5 23.5T280-680v280h40q17 0 28.5 11.5T360-360v160h-40v40q0 17-11.5 28.5T280-120h-80Z"/>
  </svg>
);

const CadenceIcon: React.FC<{ className?: string; color?: string }> = ({ className, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className={className} fill={color}>
    <path d="M440-120v-560h80v560h-80ZM280-240v-320h80v320h-80Zm320 0v-320h80v320h-80ZM120-360v-80h80v80h-80Zm640 0v-80h80v80h-80ZM80-560v-80h47q42 0 78.5-21t58.5-57q34-57 91.5-89.5T480-840q67 0 124.5 32.5T696-718q22 36 58.5 57t78.5 21h47v80h-46q-63 0-118.5-31T628-676q-23-39-62.5-61.5T480-760q-45 0-84.5 22.5T333-676q-32 54-87.5 85T127-560H80Z"/>
  </svg>
);

const DatabaseIcon: React.FC<{ className?: string; color?: string }> = ({ className, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className={className} fill={color}>
    <path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z"/>
  </svg>
);

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

const getFileIconComponent = (ext: string) => {
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'].includes(ext)) return ImageIcon;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return Film;
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return Music;
  if (['js', 'ts', 'py', 'html', 'css', 'json', 'xml', 'yaml', 'sh'].includes(ext)) return Code;
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'].includes(ext)) return FileText;
  return File;
};

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
  const [myFolders, setMyFolders] = useState<FileItem[]>([]);

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

  // Always fetch root-level folders directly so they never disappear on refresh
  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const res = await fetch('/api/files/list?category=general&path=');
        if (res.ok) {
          const data = await res.json();
          const folders = (data.folders || []).map((f: any) => ({
            id: `server-general-${f.name}`,
            name: f.name,
            type: 'folder' as const,
            isFolder: true,
            modified: new Date(f.mtimeMs).toLocaleDateString(),
            modifiedTimestamp: f.mtimeMs,
            parentId: null,
            category: 'general',
            itemCount: f.itemCount ?? 0,
          }));
          setMyFolders(folders);
        }
      } catch {}
    };
    fetchFolders();
  }, [files]); // Re-fetch when files change (new folder created, etc.)

  const firstName = user?.firstName || 'User';

  const displayItems = recentItems.slice(0, 16);
  const recentFiles = displayItems.filter((f) => !f.isFolder);

  // Show the 2 most recently opened folders (persisted across refresh via server DB).
  // Fall back to API-fetched folders if no recent folder history yet.
  const recentFolders = recentItems.filter((f) => f.isFolder);
  const displayFolders = (() => {
    if (recentFolders.length >= 2) return recentFolders.slice(0, 2);
    // Fill remaining slots from myFolders, avoiding duplicates
    const result = [...recentFolders];
    for (const f of myFolders) {
      if (result.length >= 2) break;
      if (!result.some((r) => r.name === f.name)) result.push(f);
    }
    return result.slice(0, 2);
  })();

  const quickActions = [
    { id: 'upload', label: 'Upload', icon: Upload, isSvg: false },
    { id: 'database', label: 'Database', icon: DatabaseIcon, isSvg: true },
    { id: 'music', label: 'Music', icon: CadenceIcon, isSvg: true },
    { id: 'usb', label: 'USB', icon: CableIcon, isSvg: true },
  ];

  return (
    <div className="animate-in fade-in duration-300 pb-4">
      {/* ===== Greeting ===== */}
      <div className="mb-7">
        <p className="text-[12px] font-semibold text-gray-400 leading-none mb-1">Welcome back</p>
        <h1 className="text-[28px] font-extrabold text-gray-900 tracking-tight leading-tight flex items-center gap-2">
          {firstName}
          <DrawIcon color="#5D5FEF" size={24} />
        </h1>
      </div>

      {/* ===== Quick Actions ===== */}
      <div className="mb-7">
        <div className="bg-white border border-gray-200/60 rounded-[20px] px-3 py-3 shadow-sm">
          <div className="flex items-center justify-around">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() =>
                    action.id === 'upload' ? onUpload() : onNavigateTab(action.id)
                  }
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition-all touch-manipulation"
                >
                  <div className="w-[60px] h-[60px] rounded-[16px] bg-gradient-to-br from-[#5D5FEF] to-[#4D4FCF] flex items-center justify-center shadow-lg shadow-[#5D5FEF]/25">
                    {action.isSvg ? (
                      <Icon className="w-6 h-6" color="white" />
                    ) : (
                      <Icon className="w-6 h-6 text-white" strokeWidth={1.8} />
                    )}
                  </div>
                  <span className="text-[12px] font-bold text-gray-700">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== Storage Hero Card ===== */}
      {storage && (
        <div className="mb-7 relative">
          <div className="bg-gradient-to-br from-[#5D5FEF] to-[#4D4FCF] rounded-[20px] p-5 shadow-xl shadow-[#5D5FEF]/15 overflow-hidden min-h-[140px]">
            {/* Decorative dots */}
            <div className="absolute top-5 right-5 w-20 h-20 rounded-full bg-white/5" />
            <div className="absolute bottom-5 right-14 w-10 h-10 rounded-full bg-white/5" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="w-5 h-5 text-white/80" />
                <span className="text-white/80 text-xs font-bold uppercase tracking-wider">
                  Cloud Storage
                </span>
              </div>
              <p className="text-white text-[26px] font-extrabold tracking-tight leading-none mb-1">
                {storage.usedHuman}
              </p>
              <p className="text-white/70 text-[14px] font-medium mb-4">
                of {storage.totalHuman} used
              </p>
              <div className="w-full h-[6px] bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(storage.usedPercent, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-white/60 text-xs font-semibold">
                  {storage.availableHuman} available
                </span>
                <span className="text-white text-xs font-bold">{storage.usedPercent}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== My Folders ===== */}
      {displayFolders.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[17px] font-bold text-gray-500 tracking-tight">My Folders</h2>
            <button
              onClick={() => onNavigateTab('all')}
              className="text-[13px] font-semibold text-[#5D5FEF] active:opacity-60 flex items-center gap-1"
            >
              See All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {displayFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onFileClick(folder)}
                className="relative active:scale-[0.97] transition-all text-left touch-manipulation"
              >
                {/* Folder tab */}
                <div className="absolute -top-[8px] left-5 w-14 h-5 bg-[#5D5FEF] rounded-t-2xl shadow-md z-0" />
                {/* Folder body */}
                <div className="relative w-full aspect-[1.6/1] bg-[#5D5FEF] rounded-2xl shadow-xl shadow-[#5D5FEF]/15 z-[1] overflow-hidden">
                  {/* Glow effect */}
                  <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-white/10 rounded-full blur-[60px]" />
                  <div className="absolute inset-0 p-4 flex flex-col">
                    <div className="flex justify-between items-start">
                      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/20">
                        <Folder className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-2xl font-black text-white/15 leading-none mt-1">
                        {folder.itemCount ?? 0}
                      </span>
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

      {/* ===== Recent Files — clean grid view ===== */}
      {recentFiles.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[17px] font-bold text-gray-500 tracking-tight">Recent Files</h2>
            <button
              onClick={() => onNavigateTab('all')}
              className="text-[13px] font-semibold text-[#5D5FEF] active:opacity-60 flex items-center gap-1"
            >
              See All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {recentFiles.slice(0, 12).map((file) => {
              const ext = file.name.split('.').pop()?.toLowerCase() || '';
              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'].includes(ext);
              const IconComp = getFileIconComponent(ext);
              // Use the url property set by App.tsx (correct query-param format)
              const thumbnailUrl = isImage && file.url ? file.url : null;
              return (
                <button
                  key={file.id}
                  onClick={() => onFileClick(file)}
                  className="bg-white border border-gray-200/80 rounded-2xl shadow-sm active:scale-[0.97] transition-all overflow-hidden text-left touch-manipulation"
                >
                  {/* Thumbnail or icon area */}
                  <div className="w-full h-[100px] bg-gray-50 flex items-center justify-center overflow-hidden">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                        <IconComp className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  {/* File info */}
                  <div className="px-3 py-2.5">
                    <p className="text-[13px] font-bold text-gray-900 truncate">{file.name}</p>
                    <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                      {new Date(file.modifiedTimestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                      {file.size ? ` · ${file.size}` : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Empty State ===== */}
      {displayItems.length === 0 && myFolders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-[88px] h-[88px] rounded-full bg-gray-100 flex items-center justify-center mb-4 shadow-sm">
            <Clock className="w-10 h-10 text-gray-300" />
          </div>
          <p className="text-[22px] font-extrabold text-gray-300 tracking-tight">No Recent Items</p>
          <p className="text-[15px] font-medium text-gray-400 mt-1 max-w-[280px] text-center">
            Files you open will appear here
          </p>
        </div>
      )}
    </div>
  );
};

export default MobileOverview;
