import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Folder, FileText, ChevronRight, ChevronLeft, FolderPlus, Grid, List, Home } from 'lucide-react';
import FileGrid from '../../files/FileGrid';
import FileListView from '../../files/FileListView';
import type { RemovableDeviceInfo } from '@/types';
import type { FileItem } from '@/types';

const LIST_EXTERNAL_API = '/api/files/list-external';

interface ListEntry {
  name: string;
  isFolder: boolean;
  mtimeMs: number;
  sizeBytes?: number;
}

interface MountedDeviceViewProps {
  device: RemovableDeviceInfo;
  onFileSelect?: (file: any) => void;
  selectedFile?: any;
}

const MountedDeviceView: React.FC<MountedDeviceViewProps> = ({ device, onFileSelect, selectedFile: parentSelectedFile }) => {
  const [browseEntries, setBrowseEntries] = useState<ListEntry[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  // Current browsing path — starts at device root
  const [currentPath, setCurrentPath] = useState<string>(device.mountpoint || '');

  // Clear local selection when parent clears selectedFile (e.g. user clicked X on details panel)
  useEffect(() => {
    if (parentSelectedFile === null && selectedFileId !== null) {
      setSelectedFileId(null);
    }
  }, [parentSelectedFile]);

  const fetchBrowse = useCallback(async () => {
    const browsePath = currentPath || device.mountpoint;
    if (!browsePath) {
      console.error('[MountedDeviceView] No mountpoint on device:', device.name);
      setBrowseError(true);
      return;
    }

    setBrowseLoading(true);
    setBrowseError(false);

    try {
      const apiPath = `${LIST_EXTERNAL_API}?path=${encodeURIComponent(browsePath)}`;
      console.log('[MountedDeviceView] Fetching:', apiPath);

      const res = await fetch(apiPath);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[MountedDeviceView] API error:', res.status, errorText);
        throw new Error(`List failed: ${res.status}`);
      }

      const json = await res.json();
      console.log('[MountedDeviceView] API response:', { folders: json.folders?.length ?? 0, files: json.files?.length ?? 0 });

      const all: ListEntry[] = [...(json.folders || []), ...(json.files || [])];
      all.sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });

      setBrowseEntries(all);
    } catch (e) {
      console.error('[MountedDeviceView] fetchBrowse error:', e);
      setBrowseError(true);
      setBrowseEntries([]);
    } finally {
      setBrowseLoading(false);
    }
  }, [currentPath, device]);

  const handleDelete = useCallback(async (file: FileItem) => {
    try {
      // For mounted drives, we can delete the file directly
      await fetchBrowse();
    } catch (error) {
      // Delete best-effort
    }
  }, [fetchBrowse]);

  useEffect(() => {
    fetchBrowse();
    try {
      const raw = localStorage.getItem('removableLabels');
      if (raw) setLabels(JSON.parse(raw));
    } catch {}
  }, [fetchBrowse]);

  // Split entries into folders and files
  const folders = browseEntries.filter((e) => e.isFolder);
  const files = browseEntries.filter((e) => !e.isFolder);

  // Convert to FileItems for display
  const folderItems = folders.map((entry) => ({
    id: `folder-${entry.name}`,
    name: entry.name,
    type: 'folder',
    isFolder: true,
    modified: new Date(entry.mtimeMs).toLocaleDateString(),
    modifiedTimestamp: entry.mtimeMs,
  }));

  const fileItems = files.map((entry) => {
    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
    const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
    const pdfExts = ['pdf'];
    const docExts = ['doc', 'docx', 'txt', 'rtf', 'odt'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];
    const codeExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css'];

    let fileType: any = 'document';
    if (imageExts.includes(ext)) fileType = 'image';
    else if (videoExts.includes(ext)) fileType = 'video';
    else if (pdfExts.includes(ext)) fileType = 'pdf';
    else if (docExts.includes(ext)) fileType = 'document';
    else if (audioExts.includes(ext)) fileType = 'audio';
    else if (archiveExts.includes(ext)) fileType = 'archive';
    else if (codeExts.includes(ext)) fileType = 'code';

    const browsePath = currentPath || device.mountpoint;
    const fullPath = `${browsePath}/${entry.name}`;
    const fileUrl = `/api/files/serve-external?path=${encodeURIComponent(fullPath)}`;

    return {
      id: `file-${entry.name}`,
      name: entry.name,
      type: fileType,
      isFolder: false,
      modified: new Date(entry.mtimeMs).toLocaleDateString(),
      modifiedTimestamp: entry.mtimeMs,
      size: entry.sizeBytes ? (entry.sizeBytes < 1024 ? `${entry.sizeBytes}B` : entry.sizeBytes < 1024*1024 ? `${(entry.sizeBytes/1024).toFixed(1)}KB` : entry.sizeBytes < 1024*1024*1024 ? `${(entry.sizeBytes/(1024*1024)).toFixed(1)}MB` : `${(entry.sizeBytes/(1024*1024*1024)).toFixed(2)}GB`) : undefined,
      sizeBytes: entry.sizeBytes,
      url: fileUrl,
      parentId: null,
    };
  });

  // Get selected file details
  const selectedFile = selectedFileId ? fileItems.find(f => f.id === selectedFileId) : null;

  // Sync selected file with parent component
  useEffect(() => {
    if (onFileSelect) {
      onFileSelect(selectedFile || null);
    }
  }, [selectedFile]);

  // Resolve a display name for the device header
  const deviceDisplayName = labels[device.name] || device.label || device.model || device.mountpoint?.split('/').pop() || 'Drive';

  // Folder navigation helpers
  const isAtRoot = currentPath === device.mountpoint || currentPath === '';
  const navigateToFolder = (folderName: string) => {
    const browsePath = currentPath || device.mountpoint || '';
    setCurrentPath(`${browsePath}/${folderName}`);
    setSelectedFileId(null);
  };
  const navigateUp = () => {
    if (isAtRoot) return;
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
    // Don't navigate above the mountpoint
    if (device.mountpoint && parentPath.length >= device.mountpoint.length) {
      setCurrentPath(parentPath);
    } else {
      setCurrentPath(device.mountpoint || '');
    }
    setSelectedFileId(null);
  };
  const navigateToRoot = () => {
    setCurrentPath(device.mountpoint || '');
    setSelectedFileId(null);
  };
  // Build breadcrumb segments relative to mountpoint
  const breadcrumbSegments: { name: string; path: string }[] = [];
  if (device.mountpoint && currentPath.length > device.mountpoint.length) {
    const relativePath = currentPath.substring(device.mountpoint.length + 1);
    const parts = relativePath.split('/').filter(Boolean);
    let accumulated = device.mountpoint;
    for (const part of parts) {
      accumulated += '/' + part;
      breadcrumbSegments.push({ name: part, path: accumulated });
    }
  }

  return (
    <div className="flex w-full h-full">
      <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex items-start justify-between mb-6 md:mb-10">
          <div className="relative flex-1 min-w-0">
            <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 capitalize pl-3 sm:pl-4 md:pl-6 relative truncate">
              {deviceDisplayName}
              <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
            </h2>
            {/* Show usage info under the title */}
            {device.fsUsedHuman && device.fsAvailHuman && (
              <p className="text-xs text-gray-400 font-medium pl-3 sm:pl-4 md:pl-6 mt-1">
                {device.fsUsedHuman} used &middot; {device.fsAvailHuman} free of {device.fsSizeHuman || device.sizeHuman}
              </p>
            )}
            {/* Breadcrumb navigation */}
            {!isAtRoot && (
              <div className="flex items-center gap-1 pl-3 sm:pl-4 md:pl-6 mt-2 text-xs text-gray-400 font-medium flex-wrap">
                <button
                  onClick={navigateToRoot}
                  className="flex items-center gap-1 hover:text-[#5D5FEF] transition-colors"
                >
                  <Home className="w-3 h-3" />
                  <span>{deviceDisplayName}</span>
                </button>
                {breadcrumbSegments.map((seg, i) => (
                  <React.Fragment key={seg.path}>
                    <ChevronRight className="w-3 h-3 text-gray-300" />
                    {i === breadcrumbSegments.length - 1 ? (
                      <span className="text-gray-600 font-semibold">{seg.name}</span>
                    ) : (
                      <button
                        onClick={() => { setCurrentPath(seg.path); setSelectedFileId(null); }}
                        className="hover:text-[#5D5FEF] transition-colors"
                      >
                        {seg.name}
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {!isAtRoot && (
                <button
                  onClick={navigateUp}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 bg-white text-gray-600 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-gray-100 hover:bg-gray-50 transition-all"
                >
                  <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Back</span>
                </button>
              )}
              <button
                onClick={() => {}}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 bg-white text-gray-600 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-gray-100 hover:bg-gray-50 transition-all"
              >
                <FolderPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                <span className="hidden sm:inline">New Folder</span>
                <span className="sm:hidden">New</span>
              </button>
              <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-gray-50 rounded-lg sm:rounded-xl border border-gray-100">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-[#5D5FEF] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <List className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-[#5D5FEF] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Grid className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Collections section (folders only) */}
          {folders.length > 0 && (
            <div className="mb-8 sm:mb-10 md:mb-14">
              <p className="text-[9px] sm:text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] mb-4 sm:mb-6 md:mb-8 ml-1">
                Collections
              </p>
              <FileGrid
                files={folderItems}
                onFileClick={(folder: any) => navigateToFolder(folder.name)}
                allFiles={folderItems}
                availableFolders={folderItems}
              />
            </div>
          )}

          {/* Assets section (files only) */}
          <div className="mb-6 sm:mb-8">
            <p className="text-[9px] sm:text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] mb-4 sm:mb-6 md:mb-8 ml-1">
              Assets
            </p>
            {browseLoading && (
              <div className="flex items-center gap-2 py-8 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm font-bold">Loading…</span>
              </div>
            )}
            {browseError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm font-medium">
                Could not load this folder. It may be unmounted or inaccessible.
              </div>
            )}
            {!browseLoading && !browseError && files.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 opacity-30">
                <FileText className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                  No Assets
                </p>
              </div>
            )}
            {!browseLoading && !browseError && files.length > 0 && (
              <div>
                {viewMode === 'grid' ? (
                  <FileGrid
                    files={fileItems}
                    onFileClick={(file: any) => setSelectedFileId(file.id)}
                    selectedFileId={selectedFileId}
                    allFiles={[...folderItems, ...fileItems]}
                    onAction={(action: string, file: any) => {
                      if (action === 'Open') {
                        if (file.url) {
                          window.open(file.url, '_blank');
                        } else {
                          setSelectedFileId(file.id);
                        }
                      } else if (action === 'Delete') {
                        handleDelete(file);
                      }
                    }}
                    availableFolders={folderItems}
                  />
                ) : (
                  <FileListView files={fileItems} onFileClick={(file: any) => setSelectedFileId(file.id)} selectedFileId={selectedFileId} />
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default MountedDeviceView;
