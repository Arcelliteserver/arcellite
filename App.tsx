
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Sidebar from './components/sidebar/Sidebar';
import Header from './components/header/Header';
import FileDetails from './components/files/FileDetails';
// Features
import ChatView from './components/views/features/ChatView';
import HelpSupportView from './components/views/features/HelpSupportView';
import MyAppsView from './components/views/features/MyAppsView';

// PWA
import InstallPrompt from './components/pwa/InstallPrompt';

// Settings
import AccountSettingsView from './components/views/settings/AccountSettingsView';
import AppearanceView from './components/views/settings/AppearanceView';
import AIModelsView from './components/views/settings/AIModelsView';
import APIKeysView from './components/views/settings/APIKeysView';
import AISecurityView from './components/views/settings/AISecurityView';
import NotificationsView from './components/views/settings/NotificationsView';

// System
import ServerView from './components/views/system/ServerView';
import RemovableStorageView from './components/views/system/RemovableStorageView';
import MountedDeviceView from './components/views/system/MountedDeviceView';
import SecurityVaultView from './components/views/system/SecurityVaultView';
import ActivityLogView from './components/views/system/ActivityLogView';
import ExportDataView from './components/views/system/ExportDataView';
import StatsView from './components/views/system/StatsView';
import SystemLogsView from './components/views/system/SystemLogsView';
import TrashView from './components/views/system/TrashView';
import DatabaseView from './components/views/system/DatabaseView';
import FilesView from './components/views/files/FilesView';
import SharedView from './components/views/files/SharedView';
import { FileItem, FileType, FileCategory } from './types';
import type { RemovableDeviceInfo } from './types';
import { AI_MODELS } from './constants';
import AuthView from './components/auth/AuthView';
import ConfirmModal from './components/common/ConfirmModal';
import UploadProgress from './components/common/UploadProgress';
import type { UploadFileProgress } from './components/common/UploadProgress';
import SetupWizard from './components/onboarding/SetupWizard';
import { authApi, setSessionToken, getSessionToken } from './services/api.client';

const FILES_API = '/api/files';

function getCategoryFromTab(tab: string): FileCategory | null {
  if (tab === 'all') return 'general';
  if (tab === 'photos') return 'media';
  if (tab === 'videos') return 'video_vault';
  if (tab === 'music') return 'music';
  return null;
}

function getFolderPath(folderId: string | null, category: string): string {
  if (!folderId || !category) return '';
  const prefix = `server-${category}-`;
  return folderId.startsWith(prefix) ? folderId.slice(prefix.length) : '';
}

async function fetchFolderList(
  category: string,
  path: string
): Promise<{ folders: { name: string; mtimeMs: number; itemCount?: number }[]; files: { name: string; mtimeMs: number; sizeBytes?: number }[] }> {
  const params = new URLSearchParams({ category, path: path || '' });
  const res = await fetch(`${FILES_API}/list?${params}`);
  if (!res.ok) throw new Error('List failed');
  return res.json();
}

function folderEntriesToFileItems(
  category: string,
  path: string,
  folders: { name: string; mtimeMs: number; itemCount?: number }[]
): FileItem[] {
  const parentId = path ? `server-${category}-${path}` : null;
  return folders.map((f) => ({
    id: `server-${category}-${path ? path + '/' : ''}${f.name}`,
    name: f.name,
    type: 'folder' as FileType,
    isFolder: true,
    modified: new Date(f.mtimeMs).toLocaleDateString(),
    modifiedTimestamp: f.mtimeMs,
    parentId,
    category: category as FileCategory,
    itemCount: f.itemCount ?? 0,
  }));
}

function fileEntriesToFileItems(
  category: string,
  path: string,
  files: { name: string; mtimeMs: number; sizeBytes?: number }[]
): FileItem[] {
  const parentId = path ? `server-${category}-${path}` : null;
  return files.map((f) => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif'];
    const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp'];
    const pdfExts = ['pdf'];
    const docExts = ['doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'tex', 'md', 'markdown'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'dmg', 'iso'];
    const codeExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'hpp', 'html', 'css', 'scss', 'sass', 'less', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'lua', 'r', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'sql', 'graphql', 'vue', 'svelte', 'dart', 'zig', 'nim', 'ex', 'exs', 'erl', 'hs', 'ml', 'clj'];
    const dataExts = ['json', 'xml', 'csv', 'yaml', 'yml', 'toml', 'ini', 'env', 'log', 'ndjson', 'geojson', 'plist'];
    const spreadsheetExts = ['xls', 'xlsx', 'ods', 'numbers', 'tsv'];
    const bookExts = ['epub', 'mobi', 'azw', 'azw3', 'fb2', 'djvu'];
    const configExts = ['conf', 'cfg', 'rc', 'properties', 'lock', 'editorconfig', 'gitignore', 'dockerignore', 'makefile'];

    let fileType: FileType = 'document';
    if (imageExts.includes(ext)) fileType = 'image';
    else if (videoExts.includes(ext)) fileType = 'video';
    else if (pdfExts.includes(ext)) fileType = 'pdf';
    else if (docExts.includes(ext)) fileType = 'document';
    else if (audioExts.includes(ext)) fileType = 'audio';
    else if (archiveExts.includes(ext)) fileType = 'archive';
    else if (codeExts.includes(ext)) fileType = 'code';
    else if (dataExts.includes(ext)) fileType = 'data';
    else if (spreadsheetExts.includes(ext)) fileType = 'spreadsheet';
    else if (bookExts.includes(ext)) fileType = 'book';
    else if (configExts.includes(ext)) fileType = 'config';
    else if (f.name.startsWith('.') || f.name === 'Makefile' || f.name === 'Dockerfile' || f.name === 'Vagrantfile') fileType = 'config';

    const sizeHuman = f.sizeBytes
      ? f.sizeBytes < 1024 ? `${f.sizeBytes}B`
      : f.sizeBytes < 1024 * 1024 ? `${(f.sizeBytes / 1024).toFixed(1)}KB`
      : f.sizeBytes < 1024 * 1024 * 1024 ? `${(f.sizeBytes / (1024 * 1024)).toFixed(1)}MB`
      : `${(f.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)}GB`
      : undefined;

    // Generate file URL for serving
    const relativePath = path ? `${path}/${f.name}` : f.name;
    const fileUrl = `${FILES_API}/serve?category=${category}&path=${encodeURIComponent(relativePath)}`;

    return {
      id: `server-${category}-${path ? path + '/' : ''}${f.name}`,
      name: f.name,
      type: fileType,
      isFolder: false,
      size: sizeHuman,
      sizeBytes: f.sizeBytes,
      modified: new Date(f.mtimeMs).toLocaleDateString(),
      modifiedTimestamp: f.mtimeMs,
      parentId,
      category: category as FileCategory,
      url: fileUrl,
    };
  });
}

export interface UserData {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  storagePath?: string;
  isSetupComplete?: boolean;
  emailVerified?: boolean;
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [folderListLoading, setFolderListLoading] = useState(false);
  const [recentItems, setRecentItems] = useState<FileItem[]>([]);
  const [selectedModel, setSelectedModel] = useState(() => {
    try {
      const saved = localStorage.getItem('arcellite_selected_model');
      if (saved) return saved;
    } catch {}
    return AI_MODELS[0].id;
  });

  // Persist selected model to localStorage
  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    try { localStorage.setItem('arcellite_selected_model', model); } catch {}
  }, []);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [showBanner, setShowBanner] = useState(true);
  const [mountedDevice, setMountedDevice] = useState<RemovableDeviceInfo | null>(() => {
    try {
      const saved = localStorage.getItem('mountedDevice');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [detailsWidth, setDetailsWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; icon?: 'usb' } | null>(null);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<UploadFileProgress[]>([]);
  const [uploadProgressVisible, setUploadProgressVisible] = useState(false);

  // Smart features settings
  const [pdfThumbnails, setPdfThumbnails] = useState(true);
  const [aiAutoRename, setAiAutoRename] = useState(false);
  const [aiRenamedSet, setAiRenamedSet] = useState<Set<string>>(new Set());

  // New Folder modal state
  const [newFolderModal, setNewFolderModal] = useState<{ isOpen: boolean; folderName: string; error: string | null }>({
    isOpen: false,
    folderName: '',
    error: null,
  });

  // Rename modal state
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    file: FileItem | null;
    newName: string;
    error: string | null;
  }>({
    isOpen: false,
    file: null,
    newName: '',
    error: null,
  });

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 280 && newWidth <= 600) setDetailsWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  const category = getCategoryFromTab(activeTab);
  const currentPath = category ? getFolderPath(currentFolderId, category) : '';

  const loadServerFolders = useCallback(
    async (cat: string, path: string) => {
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
              (f) =>
                !(
                  f.id.startsWith(`server-${cat}-`) &&
                  (path ? f.parentId === parentId : f.parentId === null)
                )
            );
            return [...without, ...newItems];
          });
          break; // success — exit retry loop
        } catch {
          if (attempt < maxRetries) {
            // Wait briefly before retrying (server may be busy with batch operations)
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          }
          // On final failure, keep existing files in state (don't clear them)
        }
      }
      setFolderListLoading(false);
    },
    []
  );

  const loadAiRenamedFiles = useCallback(async () => {
    try {
      const res = await fetch(`${FILES_API.replace('/files', '/ai')}/renamed-files`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.renamedFiles) {
          setAiRenamedSet(new Set(Object.keys(data.renamedFiles)));
        }
      }
    } catch {
      // Non-critical — sparkle indicators just won't show
    }
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

        let fileType: FileType = 'document';
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
          ? `${FILES_API}/serve?category=${rf.category}&path=${encodeURIComponent(rf.filePath)}`
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
        };
      });
      setRecentItems(items);
    } catch (err) {
      // Silent fail — recent files are non-critical
    }
  }, []);

  useEffect(() => {
    if (!category) return;
    loadServerFolders(category, currentPath);
  }, [activeTab, category, currentPath, loadServerFolders]);

  // Persist mounted device to localStorage
  useEffect(() => {
    if (mountedDevice) {
      localStorage.setItem('mountedDevice', JSON.stringify(mountedDevice));
    } else {
      localStorage.removeItem('mountedDevice');
    }
  }, [mountedDevice]);

  // Check setup status and authenticate on mount
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const response = await fetch('/api/auth/setup-status');
        const data = await response.json();

        if (data.setupNeeded) {
          // No user has completed setup — show the wizard
          setSetupNeeded(true);
        } else if (getSessionToken()) {
          // Setup is done, check if user is logged in
          try {
            const { user } = await authApi.getCurrentUser();
            setCurrentUser(user);

            // Double-check: if this user hasn't completed setup, show wizard
            if (user.isSetupComplete === false) {
              setSetupNeeded(true);
            } else {
              setIsAuthenticated(true);
              loadRecentFiles();
              // Load smart feature settings
              authApi.getSettings().then(({ settings }) => {
                if (settings.pdfThumbnails !== undefined) setPdfThumbnails(settings.pdfThumbnails);
                if (settings.aiAutoRename !== undefined) setAiAutoRename(settings.aiAutoRename);
              }).catch(() => {});
            }
          } catch (err) {
            // Session invalid, clear token
            setSessionToken(null);
          }
        }
      } catch (err) {
        // Silent — setup check failure handled by UI state
      } finally {
        setCheckingSetup(false);
      }
    };

    checkSetup();
  }, []);

  // Listen for navigation events from SharedView
  useEffect(() => {
    const handleNavigateToApps = () => {
      setActiveTab('myapps');
    };

    window.addEventListener('navigate-to-apps', handleNavigateToApps);
    return () => {
      window.removeEventListener('navigate-to-apps', handleNavigateToApps);
    };
  }, []);

  const handleNavigate = useCallback((id: string | null) => {
    setCurrentFolderId(id);
    setSelectedFile(null);
  }, []);

  const handleGoBack = useCallback(() => {
    if (!currentFolderId) return;
    // currentFolderId format: server-{category}-{path}
    const match = currentFolderId.match(/^server-([^-]+)-(.+)$/);
    if (match) {
      const category = match[1];
      const path = match[2];
      const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
      if (parentPath) {
        const parentId = `server-${category}-${parentPath}`;
        setCurrentFolderId(parentId);
        loadServerFolders(category, parentPath);
      } else {
        setCurrentFolderId(null);
        loadServerFolders(category, '');
      }
    } else {
      setCurrentFolderId(null);
    }
    setSelectedFile(null);
  }, [currentFolderId, loadServerFolders]);

  const handleLogin = useCallback(async () => {
    try {
      const { user } = await authApi.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      // User data will be fetched on next load
    }
    setIsAuthenticated(true);
    loadRecentFiles();
    loadAiRenamedFiles();
    // Load smart feature settings
    authApi.getSettings().then(({ settings }) => {
      if (settings.pdfThumbnails !== undefined) setPdfThumbnails(settings.pdfThumbnails);
      if (settings.aiAutoRename !== undefined) setAiAutoRename(settings.aiAutoRename);
    }).catch(() => {});
  }, [loadRecentFiles]);

  const handleSignOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Silent — logout best-effort
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
    setRecentItems([]);
    setActiveTab('overview');
    setCurrentFolderId(null);
    setSelectedFile(null);
  }, []);

  const handleFileClick = useCallback((file: FileItem) => {
    if (file.isFolder) {
      // If in Overview, navigate to the correct tab and open the folder
      if (activeTab === 'overview') {
        const cat = file.category;
        if (cat === 'media') setActiveTab('photos');
        else if (cat === 'video_vault') setActiveTab('videos');
        else setActiveTab('all');
        setCurrentFolderId(file.id);
      } else {
        handleNavigate(file.id);
      }
    } else {
      setSelectedFile(file);
    }

    // Track in database
    const filePath = file.id.replace(/^server-[^-]+-/, '').replace(/^recent-\d+$/, file.name);
    authApi.trackRecentFile({
      filePath,
      fileName: file.name,
      fileType: file.isFolder ? 'folder' : file.type,
      category: file.category || undefined,
      sizeBytes: file.sizeBytes || undefined,
    }).then(() => loadRecentFiles()).catch(() => {});
  }, [activeTab, handleNavigate, loadRecentFiles]);

  const createFolder = async () => {
    setNewFolderModal({ isOpen: true, folderName: '', error: null });
  };

  const handleCreateFolderSubmit = async () => {
    const name = newFolderModal.folderName.trim();
    if (!name) {
      setNewFolderModal(prev => ({ ...prev, error: 'Please enter a folder name' }));
      return;
    }
    const cat = getCategoryFromTab(activeTab);
    if (!cat) return;
    const pathForNew = currentPath ? `${currentPath}/${name}` : name;
    try {
      const res = await fetch(FILES_API + '/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, path: pathForNew }),
      });
      if (!res.ok) throw new Error('Create failed');
      await loadServerFolders(cat, currentPath);
      setNewFolderModal({ isOpen: false, folderName: '', error: null });
      setToast({ message: `Folder "${name}" created successfully`, type: 'success' });
    } catch {
      setNewFolderModal(prev => ({ ...prev, error: 'Could not create folder. Please try again.' }));
    }
  };

  const handleRenameSubmit = async () => {
    const newName = renameModal.newName.trim();
    const file = renameModal.file;
    if (!newName || !file) {
      setRenameModal(prev => ({ ...prev, error: 'Please enter a name' }));
      return;
    }
    if (newName === file.name) {
      setRenameModal({ isOpen: false, file: null, newName: '', error: null });
      return;
    }
    const cat = file.category || getCategoryFromTab(activeTab);
    if (!cat) return;

    const prefix = `server-${cat}-`;
    const sourcePath = file.id.startsWith(prefix) ? file.id.slice(prefix.length) : file.name;
    // Build target path: same parent directory, new name
    const lastSlash = sourcePath.lastIndexOf('/');
    const parentDir = lastSlash >= 0 ? sourcePath.substring(0, lastSlash + 1) : '';
    const targetPath = parentDir + newName;

    try {
      const res = await fetch(FILES_API + '/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, sourcePath, targetPath }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Rename failed');
      }
      await loadServerFolders(cat, currentPath);
      loadRecentFiles();
      setRenameModal({ isOpen: false, file: null, newName: '', error: null });
      showToast(`Renamed to "${newName}"`, 'success');
    } catch (e) {
      setRenameModal(prev => ({ ...prev, error: (e as Error).message || 'Rename failed. Please try again.' }));
    }
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success', icon?: 'usb') => {
    setToast({ message, type, icon });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleUploadSingle = useCallback(async (file: File, uploadCategory: string, uploadPath: string, progressId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', uploadCategory);
    formData.append('path', uploadPath);

    // Use XMLHttpRequest for real upload progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(prev => prev.map(f =>
            f.id === progressId ? { ...f, progress: pct, status: 'uploading' as const } : f
          ));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(prev => prev.map(f =>
            f.id === progressId ? { ...f, progress: 100, status: 'done' as const } : f
          ));
          resolve();
        } else {
          let errMsg = 'Upload failed';
          try { errMsg = JSON.parse(xhr.responseText)?.error || errMsg; } catch {}
          setUploadProgress(prev => prev.map(f =>
            f.id === progressId ? { ...f, status: 'error' as const, error: errMsg } : f
          ));
          reject(new Error(errMsg));
        }
      });

      xhr.addEventListener('error', () => {
        setUploadProgress(prev => prev.map(f =>
          f.id === progressId ? { ...f, status: 'error' as const, error: 'Network error' } : f
        ));
        reject(new Error('Network error'));
      });

      xhr.open('POST', FILES_API + '/upload');
      xhr.send(formData);
    });

    // Track upload as recent file
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const relativePath = uploadPath ? `${uploadPath}/${file.name}` : file.name;
    authApi.trackRecentFile({
      filePath: relativePath,
      fileName: file.name,
      fileType: ext,
      category: uploadCategory,
      sizeBytes: file.size,
    }).then(() => loadRecentFiles()).catch(() => {});

    // AI Auto-Rename: if enabled and the file is an image, analyze and rename
    const imageExtsForRename = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'avif', 'heic', 'heif'];
    if (aiAutoRename && imageExtsForRename.includes(ext)) {
      showToast(`Analyzing "${file.name}" with AI...`, 'info');
      try {
        const response = await fetch('/api/ai/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: uploadCategory, filePath: relativePath }),
        });
        const result = await response.json();
        if (result.ok && result.renamed) {
          showToast(`AI renamed: "${file.name}" → "${result.newFileName}"`, 'success');
          // Refresh file list to show the new name
          const cat = uploadCategory;
          const currentPath = currentFolderId ? currentFolderId.replace(/^server-[^-]+-/, '') : '';
          await loadServerFolders(cat, currentPath);
          loadRecentFiles();
          loadAiRenamedFiles();
        } else if (result.ok && !result.renamed) {
          showToast(`AI suggested: "${result.title}" but rename failed`, 'error');
        } else {
          showToast(`AI analysis failed: ${result.error || 'Unknown error'}`, 'error');
        }
      } catch (e) {
        showToast(`AI rename failed: ${(e as Error).message}`, 'error');
      }
    }
  }, [loadRecentFiles, loadAiRenamedFiles, aiAutoRename, currentFolderId, loadServerFolders, showToast]);

  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
    const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'alac'];

    const getTargetCategory = (fileName: string): string => {
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      if (imageExts.includes(ext)) return 'media';
      if (videoExts.includes(ext)) return 'video_vault';
      if (audioExts.includes(ext)) return 'music';
      return 'general';
    };

    const currentCategory = getCategoryFromTab(activeTab);

    // Determine upload path once (ask if in a folder)
    let resolvedPath = '';
    const firstTargetCategory = getTargetCategory(files[0].name);
    const tabMatchesFirst = (
      (activeTab === 'photos' && firstTargetCategory === 'media') ||
      (activeTab === 'videos' && firstTargetCategory === 'video_vault') ||
      (activeTab === 'music' && firstTargetCategory === 'music') ||
      (activeTab === 'all' && firstTargetCategory === 'general')
    );

    if (tabMatchesFirst && currentCategory && currentFolderId && currentPath) {
      await new Promise<void>((resolve) => {
        setConfirmModal({
          isOpen: true,
          title: 'Choose Upload Location',
          message: `Upload ${files.length} file${files.length > 1 ? 's' : ''} to current folder "${currentPath.split('/').pop()}" or to root folder?`,
          confirmText: 'Current Folder',
          variant: 'info',
          onConfirm: () => {
            resolvedPath = currentPath;
            setConfirmModal({ ...confirmModal, isOpen: false });
            resolve();
          },
        });
        (window as any).__tempCancelHandler = () => {
          resolvedPath = '';
          setConfirmModal({ ...confirmModal, isOpen: false });
          resolve();
        };
      });
    }

    // Initialize upload progress tracking
    const progressFiles: UploadFileProgress[] = files.map((file, idx) => ({
      id: `upload-${Date.now()}-${idx}`,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'pending' as const,
    }));
    setUploadProgress(progressFiles);
    setUploadProgressVisible(true);

    // Upload all files
    let successCount = 0;
    let failCount = 0;
    const categoriesToRefresh = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progressId = progressFiles[i].id;
      try {
        // Mark as uploading
        setUploadProgress(prev => prev.map(f =>
          f.id === progressId ? { ...f, status: 'uploading' as const } : f
        ));

        const targetCat = getTargetCategory(file.name);
        const tabMatches = (
          (activeTab === 'photos' && targetCat === 'media') ||
          (activeTab === 'videos' && targetCat === 'video_vault') ||
          (activeTab === 'music' && targetCat === 'music') ||
          (activeTab === 'all' && targetCat === 'general')
        );
        const uploadCategory = (tabMatches && currentCategory) ? currentCategory : targetCat;
        const uploadPath = (tabMatches && currentCategory) ? resolvedPath : '';

        await handleUploadSingle(file, uploadCategory, uploadPath, progressId);
        categoriesToRefresh.add(`${uploadCategory}:${uploadPath}`);
        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    // Refresh all affected categories
    for (const key of categoriesToRefresh) {
      const [cat, path] = key.split(':');
      await loadServerFolders(cat, path);
    }

    // Auto-dismiss after 4 seconds if all succeeded
    if (failCount === 0) {
      setTimeout(() => setUploadProgressVisible(false), 4000);
    }

    // Switch tab if all files went to a different category
    if (categoriesToRefresh.size === 1) {
      const [uploadedCat] = [...categoriesToRefresh][0].split(':');
      if (uploadedCat !== currentCategory) {
        if (uploadedCat === 'media') setActiveTab('photos');
        else if (uploadedCat === 'video_vault') setActiveTab('videos');
        else if (uploadedCat === 'general') setActiveTab('all');
        setCurrentFolderId(null);
      }
    }
  }, [activeTab, currentFolderId, currentPath, loadServerFolders, handleUploadSingle]);

  // ── Real-time USB device detection via SSE ──
  useEffect(() => {
    if (!isAuthenticated) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      eventSource = new EventSource('/api/system/usb-events');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'change') {
            // Device connected
            for (const dev of data.added || []) {
              const name = dev.label || dev.model || dev.name;
              showToast(`${name} connected (${dev.sizeHuman})`, 'info', 'usb');
            }
            // Device disconnected
            for (const name of data.removed || []) {
              showToast(`Device ${name} disconnected`, 'info', 'usb');
            }
          }
        } catch {}
      };

      eventSource.onerror = () => {
        eventSource?.close();
        // Reconnect after 10s
        reconnectTimeout = setTimeout(connect, 10000);
      };
    };

    connect();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [isAuthenticated, showToast]);

  const handleDelete = useCallback(async (file: FileItem) => {
    try {
      const cat = file.category || getCategoryFromTab(activeTab);
      if (!cat) return;

      // Extract the relative path from the file ID
      const prefix = `server-${cat}-`;
      let relativePath = file.id.startsWith(prefix) ? file.id.slice(prefix.length) : file.name;

      // If we're in a folder, construct the full path
      if (currentPath && relativePath === file.name) {
        relativePath = `${currentPath}/${file.name}`;
      }

      // Move to trash instead of permanent delete
      const res = await fetch('/api/trash/move-to-trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, path: relativePath }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Move to trash failed');
      }

      // Immediately remove the file from local state for instant UI feedback
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setRecentItems(prev => prev.filter(f => f.id !== file.id));
      setSelectedFile(null);

      // Also refresh from server to ensure consistency
      await loadServerFolders(cat, currentPath);
      // Refresh recent files so Overview stays in sync
      loadRecentFiles();
      showToast(`${file.name} moved to trash`, 'success');
    } catch (error) {
      showToast(`Delete failed: ${(error as Error).message}`, 'error');
    }
  }, [activeTab, currentPath, loadServerFolders, loadRecentFiles, showToast]);

  const handleFileAction = useCallback(async (action: string, file: FileItem, targetFolder?: FileItem) => {
    const cat = file.category || getCategoryFromTab(activeTab);
    if (!cat) return;

    try {
      switch (action) {
        case 'Open':
          // Open the file in a new tab
          if (file.url) {
            window.open(file.url, '_blank');
          } else {
            // Fallback if no URL is available
            handleFileClick(file);
          }
          break;

        case 'Download':
          // Construct download URL
          const prefix = `server-${cat}-`;
          let relativePath = file.id.startsWith(prefix) ? file.id.slice(prefix.length) : file.name;
          const downloadUrl = `${FILES_API}/download?category=${cat}&path=${encodeURIComponent(relativePath)}`;
          window.open(downloadUrl, '_blank');
          break;

        case 'Rename':
          setRenameModal({ isOpen: true, file, newName: file.name, error: null });
          break;

        case 'Delete':
          setConfirmModal({
            isOpen: true,
            title: 'Move to Trash',
            message: `Are you sure you want to move "${file.name}" to trash? You can restore it later from the trash.`,
            confirmText: 'Move to Trash',
            variant: 'warning',
            onConfirm: async () => {
              setConfirmModal({ ...confirmModal, isOpen: false });
              await handleDelete(file);
            },
          });
          break;

        case 'MoveToRoot':
          {
            // Move file to root folder
            const sourcePrefix = `server-${cat}-`;
            let sourcePath = file.id.startsWith(sourcePrefix) ? file.id.slice(sourcePrefix.length) : file.name;

            // Target is just the filename (root folder)
            const targetPath = file.name;

            const res = await fetch(FILES_API + '/move', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                category: cat,
                sourcePath,
                targetPath,
              }),
            });

            if (!res.ok) {
              const error = await res.json();
              throw new Error(error.error || 'Move failed');
            }

            await loadServerFolders(cat, currentPath);
            loadRecentFiles();
            showToast(`${file.name} moved to root folder!`, 'success');
          }
          break;

        case 'Move':
          if (!targetFolder) return;

          // Extract source and target paths
          const sourcePrefix = `server-${cat}-`;
          let sourcePath = file.id.startsWith(sourcePrefix) ? file.id.slice(sourcePrefix.length) : file.name;

          const targetPrefix = `server-${cat}-`;
          let targetPath = targetFolder.id.startsWith(targetPrefix) ? targetFolder.id.slice(targetPrefix.length) : targetFolder.name;

          // Append filename to target folder path
          const targetFullPath = `${targetPath}/${file.name}`;

          const res = await fetch(FILES_API + '/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: cat,
              sourcePath,
              targetPath: targetFullPath,
            }),
          });

          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Move failed');
          }

          await loadServerFolders(cat, currentPath);
          loadRecentFiles();
          showToast(`${file.name} moved to ${targetFolder.name}!`, 'success');
          break;

        default:
          break;
      }
    } catch (error) {
      showToast(`${action} failed: ${(error as Error).message}`, 'error');
    }
  }, [activeTab, currentPath, handleDelete, handleFileClick, loadServerFolders, loadRecentFiles, showToast]);

  const filteredFolders = useMemo(() => {
    if (activeTab === 'overview') {
      // Show recent folders from recentItems
      return recentItems.filter(f => f.isFolder).sort((a, b) => b.modifiedTimestamp - a.modifiedTimestamp).slice(0, 12);
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
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [files, activeTab, currentFolderId, recentItems]);

  const filteredFilesOnly = useMemo(() => {
    if (activeTab === 'overview') {
      // Show latest 12 recent files from recentItems
      return recentItems.filter(f => !f.isFolder).sort((a, b) => b.modifiedTimestamp - a.modifiedTimestamp).slice(0, 18);
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

    if (searchQuery) {
      list = list.filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'date') return b.modifiedTimestamp - a.modifiedTimestamp;
      if (sortBy === 'size') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      return 0;
    });

    return list;
  }, [files, activeTab, currentFolderId, searchQuery, sortBy, recentItems]);


  const showFileControls = ['all', 'photos', 'videos', 'music', 'overview', 'shared', 'trash', 'drive'].includes(activeTab);
  const showNewFolder = ['all', 'photos', 'videos', 'music'].includes(activeTab);

  // Show loading while checking setup status
  if (checkingSetup) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#5D5FEF]/5 via-white to-[#5D5FEF]/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5D5FEF] mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Show setup wizard if needed
  if (setupNeeded) {
    return (
      <SetupWizard
        onComplete={async () => {
          try {
            const { user } = await authApi.getCurrentUser();
            setCurrentUser(user);
          } catch (err) {}
          setSetupNeeded(false);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  // Show auth view if not authenticated
  if (!isAuthenticated) {
    return <AuthView onLogin={handleLogin} />;
  }

  return (
    <div className={`flex h-screen bg-white text-[#1d1d1f] antialiased overflow-hidden max-w-full ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      
      {/* Mobile Menu Overlay - Semi-transparent blur (NOT white!) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-[499] md:hidden"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            WebkitBackdropFilter: 'blur(10px)',
            backdropFilter: 'blur(10px)',
            WebkitTapHighlightColor: 'transparent'
          }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile, shown on tablet+ */}
      <div className={`fixed md:relative top-0 left-0 bottom-0 md:inset-y-0 md:left-0 z-[600] md:z-10 transform transition-transform duration-300 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="h-full md:bg-white overflow-y-auto">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              handleNavigate(null);
              setCurrentFolderId(null);
              setIsMobileMenuOpen(false); // Close mobile menu on navigation
            }}
            onUpload={handleUpload}
          />
        </div>
      </div>

      <main className={`flex-1 flex flex-col h-full overflow-hidden bg-white w-full md:w-auto min-w-0 max-w-full relative ${isMobileMenuOpen ? 'z-[400]' : 'z-0'} md:z-auto`}>
        <Header
          activeTab={activeTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNavigate={handleNavigate}
          onAccountSettings={() => setActiveTab('settings')}
          onSecurityVault={() => setActiveTab('security')}
          onTabChange={setActiveTab}
          onSignOut={handleSignOut}
          onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          user={currentUser}
        />

        {/* UNIFIED SCROLLABLE AREA WITH CONSISTENT PADDING */}
        {activeTab === 'chat' ? (
          <ChatView selectedModel={selectedModel} user={currentUser} onRefreshFiles={() => {
            // Refresh all main categories so files/folders created by AI are visible when switching tabs
            loadServerFolders('general', '');
            loadServerFolders('media', '');
            loadServerFolders('video_vault', '');
            loadServerFolders('music', '');
            loadRecentFiles();
          }} onNavigateToDatabase={() => {
            setActiveTab('database');
          }} onNavigateToFile={(category, itemPath, isFolder) => {
            // Map category to tab
            const tabMap: Record<string, string> = { general: 'all', media: 'photos', video_vault: 'videos', music: 'music' };
            const tab = tabMap[category] || 'all';
            setActiveTab(tab);
            if (isFolder) {
              // Navigate into the folder
              const folderId = `server-${category}-${itemPath}`;
              setCurrentFolderId(folderId);
              loadServerFolders(category, itemPath);
            } else {
              // Navigate to the parent folder so the file is visible
              const parentPath = itemPath.includes('/') ? itemPath.substring(0, itemPath.lastIndexOf('/')) : '';
              if (parentPath) {
                const folderId = `server-${category}-${parentPath}`;
                setCurrentFolderId(folderId);
                loadServerFolders(category, parentPath);
              } else {
                setCurrentFolderId(null);
                loadServerFolders(category, '');
              }
            }
          }} />
        ) : (
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 md:px-6 lg:px-10 pb-6 sm:pb-8 md:pb-12 pt-20 sm:pt-24 md:pt-8 scroll-smooth custom-scrollbar">
            <div className="max-w-[1600px] mx-auto min-h-fit md:min-h-full pb-8 sm:pb-12 md:pb-20 w-full">
              {activeTab === 'stats' ? (
                <StatsView />
              ) : activeTab === 'server' ? (
                <ServerView onNavigateToLogs={() => setActiveTab('logs')} />
              ) : activeTab === 'logs' ? (
                <SystemLogsView />
              ) : activeTab === 'usb' ? (
                <RemovableStorageView
                  onMountedDeviceOpen={(dev) => {
                    setMountedDevice(dev);
                    setActiveTab('drive');
                  }}
                />
              ) : activeTab === 'drive' && mountedDevice ? (
                <MountedDeviceView device={mountedDevice} onFileSelect={(file: any) => setSelectedFile(file)} selectedFile={selectedFile} />
              ) : activeTab === 'drive' ? (
                <div className="flex items-center justify-center py-20 text-gray-400">
                  <p className="text-sm font-bold">No device mounted</p>
                </div>
              ) : activeTab === 'settings' ? (
                <AccountSettingsView
                  selectedModel={selectedModel}
                  onModelChange={handleModelChange}
                  onNavigate={setActiveTab}
                  user={currentUser}
                  onUserUpdate={setCurrentUser}
                  onDeleteAccount={() => {
                    setCurrentUser(null);
                    setIsAuthenticated(false);
                    setRecentItems([]);
                    setActiveTab('overview');
                    setCurrentFolderId(null);
                    setSelectedFile(null);
                    setSetupNeeded(true);
                  }}
                />
              ) : activeTab === 'security' ? (
                <SecurityVaultView />
              ) : activeTab === 'notifications' ? (
                <NotificationsView />
              ) : activeTab === 'appearance' ? (
                <AppearanceView
                  showToast={showToast}
                  onSettingsChange={(s) => {
                    setPdfThumbnails(s.pdfThumbnails);
                    setAiAutoRename(s.aiAutoRename);
                  }}
                />
              ) : activeTab === 'aimodels' ? (
                <AIModelsView />
              ) : activeTab === 'apikeys' ? (
                <APIKeysView showToast={showToast} />
              ) : activeTab === 'aisecurity' ? (
                <AISecurityView showToast={showToast} />
              ) : activeTab === 'myapps' ? (
                <MyAppsView />
              ) : activeTab === 'activity' ? (
                <ActivityLogView />
              ) : activeTab === 'export' ? (
                <ExportDataView />
              ) : activeTab === 'help' ? (
                <HelpSupportView user={currentUser} />
              ) : activeTab === 'trash' ? (
                <TrashView />
              ) : activeTab === 'database' ? (
                <DatabaseView />
              ) : activeTab === 'shared' ? (
                <SharedView showToast={showToast} />
              ) : (
                <FilesView
                  activeTab={activeTab}
                  showBanner={showBanner}
                  setShowBanner={setShowBanner}
                  setActiveTab={setActiveTab}
                  currentFolderId={currentFolderId}
                  showFileControls={showFileControls}
                  showNewFolder={showNewFolder}
                  createFolder={createFolder}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  filteredFolders={filteredFolders}
                  filteredFilesOnly={filteredFilesOnly}
                  files={files}
                  handleFileClick={handleFileClick}
                  handleFileAction={handleFileAction}
                  selectedFile={selectedFile}
                  onGoBack={handleGoBack}
                  pdfThumbnails={pdfThumbnails}
                  aiRenamedSet={aiRenamedSet}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {showFileControls && selectedFile && (
        <>
          <div onMouseDown={startResizing} className={`w-1 h-full cursor-col-resize hover:bg-[#5D5FEF]/20 transition-colors z-20 ${isResizing ? 'bg-[#5D5FEF]' : 'bg-gray-50'}`} />
          <div className="flex-shrink-0 h-full overflow-hidden" style={{ width: detailsWidth }}>
            <FileDetails file={selectedFile} onClose={() => setSelectedFile(null)} onDelete={handleDelete} onFileRenamed={() => { if (category) loadServerFolders(category, currentPath); loadRecentFiles(); loadAiRenamedFiles(); }} />
          </div>
        </>
      )}

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Upload Progress Popup */}
      <UploadProgress
        files={uploadProgress}
        visible={uploadProgressVisible}
        onDismiss={() => { setUploadProgressVisible(false); setUploadProgress([]); }}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[1000] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : toast.type === 'info'
              ? 'bg-[#5D5FEF] text-white'
              : 'bg-red-500 text-white'
          }`}>
            {toast.icon === 'usb' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10m0 0l3-3m-3 3l-3-3M7 21h10a2 2 0 002-2v-3a2 2 0 00-2-2H7a2 2 0 00-2 2v3a2 2 0 002 2z" />
              </svg>
            ) : toast.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : toast.type === 'info' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => {
          // Check if there's a temporary cancel handler
          if ((window as any).__tempCancelHandler) {
            (window as any).__tempCancelHandler();
            delete (window as any).__tempCancelHandler;
          } else {
            setConfirmModal({ ...confirmModal, isOpen: false });
          }
        }}
      />

      {/* New Folder Modal */}
      {newFolderModal.isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[600] animate-in fade-in duration-200"
            onClick={() => setNewFolderModal({ isOpen: false, folderName: '', error: null })}
          />
          <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-gradient-to-r from-[#5D5FEF]/10 to-[#5D5FEF]/5 px-6 py-5 border-b border-gray-100">
                <h3 className="text-lg font-black text-gray-900">Create New Folder</h3>
                <p className="text-xs text-gray-500 mt-1">Enter a name for your new folder</p>
              </div>
              <div className="p-6">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-2 block">
                  Folder Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newFolderModal.folderName}
                  onChange={(e) => setNewFolderModal(prev => ({ ...prev, folderName: e.target.value, error: null }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolderSubmit();
                    if (e.key === 'Escape') setNewFolderModal({ isOpen: false, folderName: '', error: null });
                  }}
                  placeholder="My Folder"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm font-medium"
                />
                {newFolderModal.error && (
                  <p className="text-xs text-red-500 mt-2 font-medium">{newFolderModal.error}</p>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
                <button
                  onClick={() => setNewFolderModal({ isOpen: false, folderName: '', error: null })}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolderSubmit}
                  disabled={!newFolderModal.folderName.trim()}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rename Modal */}
      {renameModal.isOpen && renameModal.file && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[600] animate-in fade-in duration-200"
            onClick={() => setRenameModal({ isOpen: false, file: null, newName: '', error: null })}
          />
          <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-gradient-to-r from-[#5D5FEF]/10 to-[#5D5FEF]/5 px-6 py-5 border-b border-gray-100">
                <h3 className="text-lg font-black text-gray-900">Rename</h3>
                <p className="text-xs text-gray-500 mt-1">Enter a new name for <span className="font-bold text-gray-700">{renameModal.file.name}</span></p>
              </div>
              <div className="p-6">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-2 block">
                  New Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={renameModal.newName}
                  onChange={(e) => setRenameModal(prev => ({ ...prev, newName: e.target.value, error: null }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit();
                    if (e.key === 'Escape') setRenameModal({ isOpen: false, file: null, newName: '', error: null });
                  }}
                  onFocus={(e) => {
                    // Select filename without extension
                    const val = e.target.value;
                    const dotIdx = val.lastIndexOf('.');
                    if (dotIdx > 0 && !renameModal.file?.isFolder) {
                      e.target.setSelectionRange(0, dotIdx);
                    } else {
                      e.target.select();
                    }
                  }}
                  placeholder="New name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm font-medium"
                />
                {renameModal.error && (
                  <p className="text-xs text-red-500 mt-2 font-medium">{renameModal.error}</p>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
                <button
                  onClick={() => setRenameModal({ isOpen: false, file: null, newName: '', error: null })}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenameSubmit}
                  disabled={!renameModal.newName.trim() || renameModal.newName.trim() === renameModal.file?.name}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
