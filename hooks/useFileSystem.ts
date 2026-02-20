import { useState, useCallback, useEffect, useMemo } from 'react';
import type { FileItem, FileCategory } from '@/types';
import type { UserData } from '@/types';
import { authApi } from '@/services/api.client';
import { FILES_API, getCategoryFromTab, getFolderPath, getSecurityFolderPath, folderEntriesToFileItems, fileEntriesToFileItems, fetchFolderList } from '@/hooks/fileUtils';

interface FileSystemParams {
  activeTab: string;
  currentFolderId: string | null;
  ghostFolders: string[];
  currentUser: UserData | null;
}

export function useFileSystem({ activeTab, currentFolderId, ghostFolders, currentUser }: FileSystemParams) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folderListLoading, setFolderListLoading] = useState(false);
  const [recentItems, setRecentItems] = useState<FileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');

  const category = getCategoryFromTab(activeTab);
  const currentPath = category ? getFolderPath(currentFolderId, category) : '';

  const loadServerFolders = useCallback(async (cat: string, path: string) => {
    setFolderListLoading(true);
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { folders, files: filesList } = await fetchFolderList(cat, path);
        const parentId = path ? `server-${cat}-${path}` : null;
        const folderItems = folderEntriesToFileItems(cat, path, folders);
        const fileItems = fileEntriesToFileItems(cat, path, filesList);
        const newItems = [...folderItems, ...fileItems];
        setFiles((prev) => {
          const without = prev.filter(
            (f) => !(f.id.startsWith(`server-${cat}-`) && (path ? f.parentId === parentId : f.parentId === null))
          );
          return [...without, ...newItems];
        });
        break;
      } catch {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    setFolderListLoading(false);
  }, []);

  const loadAiRenamedFiles = useCallback(async (setAiRenamedSet: (s: Set<string>) => void) => {
    try {
      const res = await fetch('/api/ai/renamed-files');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.renamedFiles) {
          setAiRenamedSet(new Set(Object.keys(data.renamedFiles)));
        }
      }
    } catch {}
  }, []);

  const loadRecentFiles = useCallback(async () => {
    try {
      const { recentFiles } = await authApi.getRecentFiles(50);
      const items: FileItem[] = recentFiles.map((rf: any) => {
        const ext = rf.fileName.split('.').pop()?.toLowerCase() || '';
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif'];
        const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp'];
        const pdfExts = ['pdf'];
        const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff'];
        const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'dmg', 'iso'];
        const codeExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'hpp', 'html', 'css', 'scss', 'sass', 'less', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'lua', 'r', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'sql', 'graphql', 'vue', 'svelte', 'dart', 'zig', 'nim', 'ex', 'exs', 'erl', 'hs', 'ml', 'clj'];
        const dataExts = ['json', 'xml', 'csv', 'yaml', 'yml', 'toml', 'ini', 'env', 'log', 'ndjson', 'geojson', 'plist'];
        const spreadsheetExts = ['xls', 'xlsx', 'ods', 'numbers', 'tsv'];
        const bookExts = ['epub', 'mobi', 'azw', 'azw3', 'fb2', 'djvu'];
        const configExts = ['conf', 'cfg', 'rc', 'properties', 'lock', 'editorconfig', 'gitignore', 'dockerignore', 'makefile'];

        let fileType: import('@/types').FileType = 'document';
        if (rf.fileType === 'folder') fileType = 'folder';
        else if (imageExts.includes(ext)) fileType = 'image';
        else if (videoExts.includes(ext)) fileType = 'video';
        else if (pdfExts.includes(ext)) fileType = 'pdf';
        else if (audioExts.includes(ext)) fileType = 'audio';
        else if (archiveExts.includes(ext)) fileType = 'archive';
        else if (codeExts.includes(ext)) fileType = 'code';
        else if (dataExts.includes(ext)) fileType = 'data';
        else if (spreadsheetExts.includes(ext)) fileType = 'spreadsheet';
        else if (bookExts.includes(ext)) fileType = 'book';
        else if (configExts.includes(ext)) fileType = 'config';
        else if (rf.fileName.startsWith('.') || rf.fileName === 'Makefile' || rf.fileName === 'Dockerfile' || rf.fileName === 'Vagrantfile') fileType = 'config';

        const isFolder = rf.fileType === 'folder';
        const sizeHuman = rf.sizeBytes
          ? rf.sizeBytes < 1024 ? `${rf.sizeBytes}B`
          : rf.sizeBytes < 1024 * 1024 ? `${(rf.sizeBytes / 1024).toFixed(1)}KB`
          : rf.sizeBytes < 1024 * 1024 * 1024 ? `${(rf.sizeBytes / (1024 * 1024)).toFixed(1)}MB`
          : `${(rf.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)}GB`
          : undefined;

        const fileUrl = !isFolder && rf.category && rf.filePath
          ? rf.category === 'external'
            ? `/api/files/serve-external?path=${encodeURIComponent(rf.filePath)}`
            : `${FILES_API}/serve?category=${rf.category}&path=${encodeURIComponent(rf.filePath)}`
          : undefined;

        return {
          id: rf.category ? `server-${rf.category}-${rf.filePath}` : `recent-${rf.id}`,
          name: rf.fileName,
          type: fileType,
          isFolder,
          size: sizeHuman,
          sizeBytes: rf.sizeBytes || undefined,
          modified: new Date(rf.accessedAt).toLocaleDateString(),
          modifiedTimestamp: new Date(rf.accessedAt).getTime(),
          parentId: null,
          category: rf.category as FileCategory || undefined,
          url: fileUrl,
          ...(rf.itemCount !== undefined && { itemCount: rf.itemCount }),
          ...(rf.hasSubfolders !== undefined && { hasSubfolders: rf.hasSubfolders }),
        };
      });
      setRecentItems(items);
    } catch {}
  }, []);

  // Auto-load when tab/folder changes
  useEffect(() => {
    if (activeTab === 'overview') {
      loadRecentFiles();
      return;
    }
    if (!category) return;
    loadServerFolders(category, currentPath);
    if (category === 'media') {
      loadServerFolders('video_vault', '');
    }
  }, [activeTab, currentFolderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredFolders = useMemo(() => {
    if (activeTab === 'overview') {
      let list = recentItems.filter(f => f.isFolder).sort((a, b) => b.modifiedTimestamp - a.modifiedTimestamp).slice(0, 12);
      if (searchQuery) list = list.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return list.filter((f) => {
        const relativePath = f.id.replace(/^server-[^-]+-/, '');
        const fullPath = getSecurityFolderPath(f);
        if (!fullPath) return true;
        return !ghostFolders.some(gf => fullPath === gf || fullPath.startsWith(`${gf}/`) || relativePath === gf || relativePath.startsWith(`${gf}/`));
      });
    }
    let list = files.filter(f => f.isFolder);
    if (activeTab === 'photos') list = list.filter(f => f.category === 'media');
    else if (activeTab === 'videos') list = list.filter(f => f.category === 'video_vault');
    else if (activeTab === 'music') list = list.filter(f => f.category === 'music');
    else if (activeTab === 'all') list = list.filter(f => f.category === 'general');
    else if (activeTab === 'shared') list = list.filter(f => f.category === 'shared');
    else if (activeTab === 'trash') list = list.filter(f => f.category === 'trash');
    if (currentFolderId !== null) {
      list = list.filter(file => file.parentId === currentFolderId);
    } else if (!['trash', 'shared', 'overview'].includes(activeTab)) {
      list = list.filter(file => file.parentId === null);
    }
    if (searchQuery) list = list.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    list = list.filter((f) => {
      const relativePath = f.id.replace(/^server-[^-]+-/, '');
      const fullPath = getSecurityFolderPath(f);
      if (!fullPath) return true;
      return !ghostFolders.some(gf => fullPath === gf || fullPath.startsWith(`${gf}/`) || relativePath === gf || relativePath.startsWith(`${gf}/`));
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [files, activeTab, currentFolderId, recentItems, searchQuery, ghostFolders]);

  const filteredFilesOnly = useMemo(() => {
    if (activeTab === 'overview') {
      let list = recentItems.filter(f => !f.isFolder).sort((a, b) => b.modifiedTimestamp - a.modifiedTimestamp).slice(0, 18);
      if (searchQuery) list = list.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return list;
    }
    let list = files.filter(f => !f.isFolder);
    if (activeTab === 'photos') list = list.filter(f => f.category === 'media' || f.type === 'image');
    else if (activeTab === 'videos') list = list.filter(f => f.category === 'video_vault' || f.type === 'video');
    else if (activeTab === 'music') list = list.filter(f => f.category === 'music' || f.type === 'audio');
    else if (activeTab === 'all') list = list.filter(f => f.category === 'general' || (!f.category && f.type !== 'image' && f.type !== 'video' && f.type !== 'audio'));
    else if (activeTab === 'shared') list = list.filter(f => f.category === 'shared');
    else if (activeTab === 'trash') list = list.filter(f => f.category === 'trash');
    if (currentFolderId !== null) {
      list = list.filter(file => file.parentId === currentFolderId);
    } else if (!['trash', 'shared', 'overview'].includes(activeTab)) {
      list = list.filter(file => file.parentId === null);
    }
    if (searchQuery) list = list.filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()));
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'date') return b.modifiedTimestamp - a.modifiedTimestamp;
      if (sortBy === 'size') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      return 0;
    });
    return list;
  }, [files, activeTab, currentFolderId, searchQuery, sortBy, recentItems]);

  return {
    files,
    setFiles,
    folderListLoading,
    recentItems,
    setRecentItems,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    category,
    currentPath,
    filteredFolders,
    filteredFilesOnly,
    loadServerFolders,
    loadRecentFiles,
    loadAiRenamedFiles,
  };
}
