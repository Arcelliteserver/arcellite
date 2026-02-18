
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Sidebar from './components/sidebar/Sidebar';
import Header from './components/header/Header';
import FileDetails from './components/files/FileDetails';
import MobileApp from './components/mobile/MobileApp';
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
import DomainSetupView from './components/views/settings/DomainSetupView';
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
import AccessDeniedView from './components/views/AccessDeniedView';
import MobileAccessDeniedView from './components/mobile/MobileAccessDeniedView';
import ConfirmModal from './components/common/ConfirmModal';
import UploadProgress from './components/common/UploadProgress';
import { unlockUploadAudio } from './components/common/UploadProgress';
import Toast from './components/common/Toast';
import type { ToastData } from './components/common/Toast';
import type { UploadFileProgress } from './components/common/UploadProgress';
import LockScreen from './components/common/LockScreen';
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

const CATEGORY_DIR_MAP: Record<FileCategory, string> = {
  general: 'files',
  media: 'photos',
  video_vault: 'videos',
  music: 'music',
  shared: 'shared',
  trash: 'trash',
  external: 'external',
};

function getCategoryFromFileId(fileId: string): FileCategory | null {
  const match = fileId.match(/^server-([^-]+)-/);
  return match ? (match[1] as FileCategory) : null;
}

function getSecurityFolderPath(file: FileItem): string | null {
  if (!file.id.startsWith('server-')) return null;
  const relativePath = file.id.replace(/^server-[^-]+-/, '');
  const category = file.category ?? getCategoryFromFileId(file.id);
  if (!category) return null;
  const categoryDir = CATEGORY_DIR_MAP[category];
  return `${categoryDir}/${relativePath}`;
}

async function fetchFolderList(
  category: string,
  path: string
): Promise<{ folders: { name: string; mtimeMs: number; itemCount?: number; hasSubfolders?: boolean }[]; files: { name: string; mtimeMs: number; sizeBytes?: number }[] }> {
  const params = new URLSearchParams({ category, path: path || '' });
  const res = await fetch(`${FILES_API}/list?${params}`);
  if (!res.ok) throw new Error('List failed');
  return res.json();
}

function folderEntriesToFileItems(
  category: string,
  path: string,
  folders: { name: string; mtimeMs: number; itemCount?: number; hasSubfolders?: boolean }[]
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
    hasSubfolders: f.hasSubfolders ?? false,
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

  // Auto-select a model that has an API key if the current selection doesn't
  useEffect(() => {
    fetch('/api/ai/configured-providers')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.providers && data.providers.length > 0) {
          const currentModel = AI_MODELS.find(m => m.id === selectedModel);
          if (!currentModel || !data.providers.includes(currentModel.provider)) {
            // Current model's provider has no API key — switch to one that does
            const firstConfigured = AI_MODELS.find(m => data.providers.includes(m.provider));
            if (firstConfigured) {
              handleModelChange(firstConfigured.id);
            }
          }
        }
      })
      .catch(() => {});
  }, []);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1280);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  // Detect actual mobile phones via userAgent (not tablets/desktops) — used for lock screen
  const [isMobileDevice] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android.*Mobile|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  });
  const [showAccessDenied, setShowAccessDenied] = useState(() => {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('accessDenied') === 'ip') {
        sessionStorage.removeItem('accessDenied');
        return true;
      }
    } catch {}
    return false;
  });
  const [accessStatus, setAccessStatus] = useState<'pending' | 'login' | 'denied'>('pending');
  const [toast, setToast] = useState<ToastData | null>(null);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<UploadFileProgress[]>([]);
  const [uploadProgressVisible, setUploadProgressVisible] = useState(false);

  // Smart features settings
  const [pdfThumbnails, setPdfThumbnails] = useState(true);
  const [aiAutoRename, setAiAutoRename] = useState(false);
  const [aiRenamedSet, setAiRenamedSet] = useState<Set<string>>(new Set());

  // Auto-lock state — restore lock from localStorage on mount (shared across ALL tabs)
  const [isScreenLocked, setIsScreenLocked] = useState(() => localStorage.getItem('arcellite_screen_locked') === 'true');
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState(5);
  const [autoLockPin, setAutoLockPin] = useState('');
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist lock state changes to localStorage (cross-tab)
  useEffect(() => {
    if (isScreenLocked) {
      localStorage.setItem('arcellite_screen_locked', 'true');
    } else {
      localStorage.removeItem('arcellite_screen_locked');
    }
  }, [isScreenLocked]);

  // Sync lock state across ALL browser tabs via storage event
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'arcellite_screen_locked') {
        setIsScreenLocked(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Folder lock & ghost folders
  const [lockedFolders, setLockedFolders] = useState<string[]>([]);
  const [folderLockPin, setFolderLockPin] = useState('');
  const [ghostFolders, setGhostFolders] = useState<string[]>([]);
  const [folderLockPrompt, setFolderLockPrompt] = useState<{ show: boolean; folderPath: string; folderId: string }>({ show: false, folderPath: '', folderId: '' });
  const [folderLockInput, setFolderLockInput] = useState('');
  const [folderLockError, setFolderLockError] = useState('');
  // Folder lock attempt tracking & lockout (refs = source of truth, state = for rendering)
  const [folderLockAttempts, setFolderLockAttempts] = useState(0);
  const [folderLockoutUntil, setFolderLockoutUntil] = useState<number | null>(null);
  const [folderLockoutLevel, setFolderLockoutLevel] = useState(0);
  const [folderLockCountdown, setFolderLockCountdown] = useState('');
  const folderLockAttemptsRef = useRef(0);
  const folderLockoutUntilRef = useRef<number | null>(null);
  const folderLockoutLevelRef = useRef(0);
  const folderLockCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Mobile viewport detection
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mql);
    mql.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
    return () => mql.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
  }, []);

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
    } catch (err) {
      // Silent fail — recent files are non-critical
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') {
      loadRecentFiles();
      return;
    }
    if (!category) return;
    loadServerFolders(category, currentPath);
    // Gallery needs both photos (media) and videos (video_vault)
    if (category === 'media') {
      loadServerFolders('video_vault', '');
    }
  }, [activeTab, category, currentPath, loadServerFolders, loadRecentFiles]);

  // Persist mounted device to localStorage
  useEffect(() => {
    if (mountedDevice) {
      localStorage.setItem('mountedDevice', JSON.stringify(mountedDevice));
    } else {
      localStorage.removeItem('mountedDevice');
    }
  }, [mountedDevice]);

  // Pre-auth: check if this IP is allowed to see login (strict isolation)
  useEffect(() => {
    if (checkingSetup || isAuthenticated || setupNeeded || showAccessDenied || accessStatus !== 'pending') return;
    let cancelled = false;
    fetch('/api/auth/access-status')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setAccessStatus(data.access === 'denied' ? 'denied' : 'login');
      })
      .catch(() => {
        if (!cancelled) setAccessStatus('login');
      });
    return () => { cancelled = true; };
  }, [checkingSetup, isAuthenticated, setupNeeded, showAccessDenied, accessStatus]);

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
              // Load smart feature settings and security data
              Promise.all([
                authApi.getSettings().catch(() => ({ settings: {} })),
                authApi.getSecurityStatus().catch(() => ({ ghostFolders: [] })),
              ]).then(([settingsRes, secStatus]: [any, any]) => {
                const settings = settingsRes.settings || {};
                if (settings.pdfThumbnails !== undefined) setPdfThumbnails(settings.pdfThumbnails);
                if (settings.aiAutoRename !== undefined) setAiAutoRename(settings.aiAutoRename);
                if (settings.secAutoLock) {
                  setAutoLockEnabled(true);
                  setAutoLockTimeout(settings.secAutoLockTimeout ?? 5);
                  setAutoLockPin(settings.secAutoLockPin ?? '');
                }
                if (settings.secLockedFolders) setLockedFolders(settings.secLockedFolders);
                if (settings.secFolderLockPin) setFolderLockPin(settings.secFolderLockPin);
                setGhostFolders(secStatus.ghostFolders || []);
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
    // Load smart feature settings and security data
    Promise.all([
      authApi.getSettings().catch(() => ({ settings: {} })),
      authApi.getSecurityStatus().catch(() => ({ ghostFolders: [] })),
    ]).then(([settingsRes, secStatus]: [any, any]) => {
      const settings = settingsRes.settings || {};
      if (settings.pdfThumbnails !== undefined) setPdfThumbnails(settings.pdfThumbnails);
      if (settings.aiAutoRename !== undefined) setAiAutoRename(settings.aiAutoRename);
      if (settings.secAutoLock) {
        setAutoLockEnabled(true);
        setAutoLockTimeout(settings.secAutoLockTimeout ?? 5);
        setAutoLockPin(settings.secAutoLockPin ?? '');
      }
      if (settings.secLockedFolders) setLockedFolders(settings.secLockedFolders);
      if (settings.secFolderLockPin) setFolderLockPin(settings.secFolderLockPin);
      setGhostFolders(secStatus.ghostFolders || []);
    }).catch(() => {});
  }, [loadRecentFiles]);

  const handleSignOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Silent — logout best-effort
    }
    // Clear all user-specific localStorage data
    localStorage.removeItem('connectedApps');
    localStorage.removeItem('connectedAppIds');
    localStorage.removeItem('mountedDevice');
    localStorage.removeItem('myapps_state');
    localStorage.removeItem('activeTab');
    localStorage.removeItem('theme');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setRecentItems([]);
    setActiveTab('overview');
    setCurrentFolderId(null);
    setSelectedFile(null);
    // Clear auto-lock state
    setAutoLockEnabled(false);
    setAutoLockPin('');
    setIsScreenLocked(false);
    localStorage.removeItem('arcellite_screen_locked');
  }, []);

  // Auto-lock idle timer (desktop only)
  useEffect(() => {
    if (!isAuthenticated || !autoLockEnabled || !autoLockPin || isMobileDevice) return;
    const timeoutMs = autoLockTimeout * 60 * 1000;
    const resetTimer = () => {
      if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = setTimeout(() => {
        setIsScreenLocked(true);
      }, timeoutMs);
    };
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    };
  }, [isAuthenticated, autoLockEnabled, autoLockPin, autoLockTimeout]);

  // Restore lockout state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('arcellite_folder_lockout');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.until && data.until > Date.now()) {
          folderLockoutUntilRef.current = data.until;
          folderLockoutLevelRef.current = data.level || 0;
          folderLockAttemptsRef.current = 4;
          setFolderLockoutUntil(data.until);
          setFolderLockoutLevel(data.level || 0);
          setFolderLockAttempts(4);
        } else {
          localStorage.removeItem('arcellite_folder_lockout');
          if (data.level) {
            folderLockoutLevelRef.current = data.level;
            setFolderLockoutLevel(data.level);
          }
        }
      }
    } catch {}
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (folderLockCountdownRef.current) {
      clearInterval(folderLockCountdownRef.current);
      folderLockCountdownRef.current = null;
    }
    if (!folderLockoutUntil) {
      setFolderLockCountdown('');
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, folderLockoutUntil - Date.now());
      if (remaining <= 0) {
        folderLockoutUntilRef.current = null;
        folderLockAttemptsRef.current = 0;
        setFolderLockoutUntil(null);
        setFolderLockAttempts(0);
        setFolderLockCountdown('');
        setFolderLockError('');
        localStorage.removeItem('arcellite_folder_lockout');
        if (folderLockCountdownRef.current) clearInterval(folderLockCountdownRef.current);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setFolderLockCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    tick();
    folderLockCountdownRef.current = setInterval(tick, 1000);
    return () => { if (folderLockCountdownRef.current) clearInterval(folderLockCountdownRef.current); };
  }, [folderLockoutUntil]);

  const handleFolderLockPinSubmit = useCallback(() => {
    // Block if currently locked out (read from ref — always current)
    if (folderLockoutUntilRef.current && folderLockoutUntilRef.current > Date.now()) return;

    if (folderLockInput !== folderLockPin) {
      const newAttempts = folderLockAttemptsRef.current + 1;
      folderLockAttemptsRef.current = newAttempts;
      setFolderLockAttempts(newAttempts);

      if (newAttempts >= 4) {
        // Lockout — double duration each time: 1min, 2min, 4min, 8min...
        const newLevel = folderLockoutLevelRef.current + 1;
        const lockoutMs = Math.pow(2, newLevel - 1) * 60 * 1000; // 1, 2, 4, 8 min...
        const until = Date.now() + lockoutMs;
        folderLockoutLevelRef.current = newLevel;
        folderLockoutUntilRef.current = until;
        setFolderLockoutLevel(newLevel);
        setFolderLockoutUntil(until);
        const mins = Math.pow(2, newLevel - 1);
        setFolderLockError(`Too many failed attempts. Locked for ${mins} minute${mins > 1 ? 's' : ''}.`);
        setFolderLockInput('');
        localStorage.setItem('arcellite_folder_lockout', JSON.stringify({ until, level: newLevel }));
      } else if (newAttempts === 3) {
        setFolderLockError('Incorrect PIN — 1 attempt remaining');
      } else {
        setFolderLockError(`Incorrect PIN — ${4 - newAttempts} attempts remaining`);
      }
      return;
    }
    // PIN is correct, reset attempts & open the folder
    folderLockAttemptsRef.current = 0;
    setFolderLockAttempts(0);
    // Keep lockout level so next lockout still escalates
    const folderId = folderLockPrompt.folderId;
    if (activeTab === 'overview') {
      const cat = folderId.split('-')[1];
      if (cat === 'media') setActiveTab('photos');
      else if (cat === 'video_vault') setActiveTab('videos');
      else setActiveTab('all');
      setCurrentFolderId(folderId);
    } else {
      handleNavigate(folderId);
    }
    // Close PIN prompt
    setFolderLockPrompt({ show: false, folderPath: '', folderId: '' });
    setFolderLockInput('');
    setFolderLockError('');
  }, [folderLockInput, folderLockPin, folderLockPrompt.folderId, activeTab, handleNavigate]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success', icon?: ToastData['icon']) => {
    setToast({ message, type, icon });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleFileClick = useCallback((file: FileItem) => {
    if (file.isFolder) {
      // Check if folder is locked
      const folderPath = file.id.replace(/^server-[^-]+-/, '');
      const fullPath = getSecurityFolderPath(file);
      if (lockedFolders.includes(fullPath ?? '') || lockedFolders.includes(folderPath)) {
        // Show toast and PIN prompt for locked folder
        showToast('This folder is locked', 'warning', 'lock');
        setFolderLockPrompt({ show: true, folderPath: fullPath ?? folderPath, folderId: file.id });
        setFolderLockInput('');
        setFolderLockError('');
        return;
      }

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
  }, [activeTab, handleNavigate, loadRecentFiles, lockedFolders, showToast]);

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
      setToast({ message: `Folder "${name}" created successfully`, type: 'success', icon: 'folder' });
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
      showToast(`Renamed to "${newName}"`, 'success', 'rename');
    } catch (e) {
      setRenameModal(prev => ({ ...prev, error: (e as Error).message || 'Rename failed. Please try again.' }));
    }
  };

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
      showToast(`Analyzing "${file.name}" with AI...`, 'info', 'ai');
      try {
        const response = await fetch('/api/ai/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: uploadCategory, filePath: relativePath }),
        });
        const result = await response.json();
        if (result.ok && result.renamed) {
          showToast(`AI renamed: "${file.name}" → "${result.newFileName}"`, 'success', 'ai');
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

    // Unlock audio for mobile browsers (must happen during user gesture)
    unlockUploadAudio();

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
      showToast(`${file.name} moved to trash`, 'success', 'trash');
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
            showToast(`${file.name} moved to root folder!`, 'success', 'move');
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
          showToast(`${file.name} moved to ${targetFolder.name}!`, 'success', 'move');
          break;

        default:
          break;
      }
    } catch (error) {
      showToast(`${action} failed: ${(error as Error).message}`, 'error');
    }
  }, [activeTab, currentPath, handleDelete, handleFileClick, loadServerFolders, loadRecentFiles, showToast]);

  // --- Bulk file actions (drag-to-select) ---
  const handleBulkFileAction = useCallback(async (action: string, selectedFiles: FileItem[]) => {
    if (!selectedFiles.length) return;
    try {
      switch (action) {
        case 'Delete':
          setConfirmModal({
            isOpen: true,
            title: 'Move to Trash',
            message: `Are you sure you want to move ${selectedFiles.length} item${selectedFiles.length > 1 ? 's' : ''} to trash? You can restore them later.`,
            confirmText: 'Move to Trash',
            variant: 'warning',
            onConfirm: async () => {
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
              let count = 0;
              for (const file of selectedFiles) {
                try {
                  await handleDelete(file);
                  count++;
                } catch {}
              }
              showToast(`${count} item${count > 1 ? 's' : ''} moved to trash`, 'success', 'trash');
            },
          });
          break;
        case 'Download':
          for (const file of selectedFiles) {
            if (file.isFolder) continue;
            const cat = file.category || getCategoryFromTab(activeTab);
            if (!cat) continue;
            const prefix = `server-${cat}-`;
            const relativePath = file.id.startsWith(prefix) ? file.id.slice(prefix.length) : file.name;
            const downloadUrl = `${FILES_API}/download?category=${cat}&path=${encodeURIComponent(relativePath)}`;
            window.open(downloadUrl, '_blank');
          }
          break;
      }
    } catch (error) {
      showToast(`Bulk ${action.toLowerCase()} failed: ${(error as Error).message}`, 'error');
    }
  }, [activeTab, handleDelete, showToast]);

  // --- Drag-and-drop handlers ---
  const tabToCategoryLabel: Record<string, string> = {
    all: 'Files',
    photos: 'Photos',
    videos: 'Videos',
    music: 'Music',
  };

  const handleFileDrop = useCallback((droppedFile: FileItem, targetFolder: FileItem) => {
    // File dropped onto a folder in the same view
    const fileCategory = droppedFile.category || getCategoryFromTab(activeTab);
    const folderCategory = targetFolder.category || getCategoryFromTab(activeTab);

    if (!fileCategory || !folderCategory) return;

    if (fileCategory !== folderCategory) {
      // Cross-category drop: show confirmation
      const sourceName = tabToCategoryLabel[Object.entries({ all: 'general', photos: 'media', videos: 'video_vault', music: 'music' }).find(([, v]) => v === fileCategory)?.[0] || ''] || fileCategory;
      const targetName = tabToCategoryLabel[Object.entries({ all: 'general', photos: 'media', videos: 'video_vault', music: 'music' }).find(([, v]) => v === folderCategory)?.[0] || ''] || folderCategory;

      setConfirmModal({
        isOpen: true,
        title: 'Move to Different Section',
        message: `"${droppedFile.name}" is from ${sourceName}. Do you want to move it into "${targetFolder.name}" in ${targetName}?`,
        confirmText: 'Move File',
        variant: 'info',
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          try {
            const sourcePrefix = `server-${fileCategory}-`;
            const sourcePath = droppedFile.id.startsWith(sourcePrefix) ? droppedFile.id.slice(sourcePrefix.length) : droppedFile.name;
            const targetPrefix = `server-${folderCategory}-`;
            const folderPath = targetFolder.id.startsWith(targetPrefix) ? targetFolder.id.slice(targetPrefix.length) : targetFolder.name;
            const targetPath = `${folderPath}/${droppedFile.name}`;

            const res = await fetch(FILES_API + '/move-cross', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sourceCategory: fileCategory,
                sourcePath,
                targetCategory: folderCategory,
                targetPath,
              }),
            });
            if (!res.ok) {
              const error = await res.json();
              throw new Error(error.error || 'Move failed');
            }
            // Reload both categories
            await loadServerFolders(fileCategory, '');
            await loadServerFolders(folderCategory, '');
            loadRecentFiles();
            showToast(`${droppedFile.name} moved to ${targetFolder.name}!`, 'success', 'move');
          } catch (error) {
            showToast(`Move failed: ${(error as Error).message}`, 'error');
          }
        },
      });
    } else {
      // Same category: just use the regular Move action
      handleFileAction('Move', droppedFile, targetFolder);
    }
  }, [activeTab, handleFileAction, loadServerFolders, loadRecentFiles, showToast]);

  const handleSidebarDrop = useCallback((tabId: string, droppedFile: FileItem) => {
    const targetCategory = getCategoryFromTab(tabId);
    const sourceCategory = droppedFile.category || getCategoryFromTab(activeTab);

    if (!targetCategory || !sourceCategory) return;

    if (sourceCategory === targetCategory) {
      showToast(`${droppedFile.name} is already in ${tabToCategoryLabel[tabId] || tabId}`, 'info');
      return;
    }

    const targetLabel = tabToCategoryLabel[tabId] || tabId;
    const sourceLabel = tabToCategoryLabel[
      Object.entries({ all: 'general', photos: 'media', videos: 'video_vault', music: 'music' })
        .find(([, v]) => v === sourceCategory)?.[0] || ''
    ] || String(sourceCategory);

    setConfirmModal({
      isOpen: true,
      title: 'Move to Different Section',
      message: `Do you want to move "${droppedFile.name}" from ${sourceLabel} to ${targetLabel}? The file will be placed in the root of ${targetLabel}.`,
      confirmText: `Move to ${targetLabel}`,
      variant: 'info',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const sourcePrefix = `server-${sourceCategory}-`;
          const sourcePath = droppedFile.id.startsWith(sourcePrefix) ? droppedFile.id.slice(sourcePrefix.length) : droppedFile.name;

          const res = await fetch(FILES_API + '/move-cross', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceCategory,
              sourcePath,
              targetCategory,
              targetPath: droppedFile.name, // root of target
            }),
          });
          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Move failed');
          }
          // Reload both categories
          await loadServerFolders(sourceCategory, '');
          await loadServerFolders(targetCategory, '');
          loadRecentFiles();
          showToast(`${droppedFile.name} moved to ${targetLabel}!`, 'success', 'move');
        } catch (error) {
          showToast(`Move failed: ${(error as Error).message}`, 'error');
        }
      },
    });
  }, [activeTab, loadServerFolders, loadRecentFiles, showToast]);

  const filteredFolders = useMemo(() => {
    if (activeTab === 'overview') {
      // Show recent folders from recentItems
      let list = recentItems.filter(f => f.isFolder).sort((a, b) => b.modifiedTimestamp - a.modifiedTimestamp).slice(0, 12);
      if (searchQuery) {
        list = list.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      // Filter out ghost folders
      return list.filter((f) => {
        const relativePath = f.id.replace(/^server-[^-]+-/, '');
        const fullPath = getSecurityFolderPath(f);
        if (!fullPath) return true;
        return !ghostFolders.some(gf => (
          fullPath === gf ||
          fullPath.startsWith(`${gf}/`) ||
          relativePath === gf ||
          relativePath.startsWith(`${gf}/`)
        ));
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

    if (searchQuery) {
      list = list.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Filter out ghost folders
    list = list.filter((f) => {
      const relativePath = f.id.replace(/^server-[^-]+-/, '');
      const fullPath = getSecurityFolderPath(f);
      if (!fullPath) return true;
      return !ghostFolders.some(gf => (
        fullPath === gf ||
        fullPath.startsWith(`${gf}/`) ||
        relativePath === gf ||
        relativePath.startsWith(`${gf}/`)
      ));
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [files, activeTab, currentFolderId, recentItems, searchQuery, ghostFolders]);

  const filteredFilesOnly = useMemo(() => {
    if (activeTab === 'overview') {
      // Show latest 12 recent files from recentItems
      let list = recentItems.filter(f => !f.isFolder).sort((a, b) => b.modifiedTimestamp - a.modifiedTimestamp).slice(0, 18);
      if (searchQuery) {
        list = list.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
      }
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
          loadRecentFiles();
          loadAiRenamedFiles();
          // Load smart feature settings and security data
          Promise.all([
            authApi.getSettings().catch(() => ({ settings: {} })),
            authApi.getSecurityStatus().catch(() => ({ ghostFolders: [] })),
          ]).then(([settingsRes, secStatus]: [any, any]) => {
            const settings = settingsRes.settings || {};
            if (settings.pdfThumbnails !== undefined) setPdfThumbnails(settings.pdfThumbnails);
            if (settings.aiAutoRename !== undefined) setAiAutoRename(settings.aiAutoRename);
            if (settings.secAutoLock) {
              setAutoLockEnabled(true);
              setAutoLockTimeout(settings.secAutoLockTimeout ?? 5);
              setAutoLockPin(settings.secAutoLockPin ?? '');
            }
            if (settings.secLockedFolders) setLockedFolders(settings.secLockedFolders);
            if (settings.secFolderLockPin) setFolderLockPin(settings.secFolderLockPin);
            setGhostFolders(secStatus.ghostFolders || []);
          }).catch(() => {});
        }}
      />
    );
  }

  // Show auth view if not authenticated
  if (!isAuthenticated) {
    const showDenied = showAccessDenied || accessStatus === 'denied';
    if (showDenied) {
      return isMobile ? <MobileAccessDeniedView /> : <AccessDeniedView />;
    }
    if (accessStatus === 'pending') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#5D5FEF]/8 via-white to-[#5D5FEF]/5 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#5D5FEF]/30 border-t-[#5D5FEF] animate-spin" />
        </div>
      );
    }
    return <AuthView onLogin={handleLogin} onAccessDenied={() => setShowAccessDenied(true)} />;
  }

  // Auto-lock screen overlay (desktop & tablet — not mobile phones)
  if (!isMobileDevice && isScreenLocked && autoLockPin) {
    return <LockScreen correctPin={autoLockPin} onUnlock={() => setIsScreenLocked(false)} />;
  }
  // If lock is active but PIN hasn't loaded from settings yet, show blank screen (don't expose the app)
  if (!isMobileDevice && isScreenLocked && !autoLockPin) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[9999]"
        style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #111128 25%, #0d0d24 50%, #0a0a1a 100%)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#5D5FEF] animate-spin" />
      </div>
    );
  }

  // ── Mobile Application ──
  if (isMobile) {
    return (
      <>
        <MobileApp
          user={currentUser}
          onUserUpdate={setCurrentUser}
          onSignOut={handleSignOut}
          files={files}
          recentItems={recentItems}
          currentFolderId={currentFolderId}
          selectedFile={selectedFile}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeTab={activeTab}
          onTabChange={(tab) => { setActiveTab(tab); handleNavigate(null); setCurrentFolderId(null); }}
          onFileClick={handleFileClick}
          onFileAction={handleFileAction}
          onGoBack={handleGoBack}
          onNavigate={handleNavigate}
          onCreateFolder={createFolder}
          onUpload={handleUpload}
          filteredFolders={filteredFolders}
          filteredFilesOnly={filteredFilesOnly}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          pdfThumbnails={pdfThumbnails}
          aiRenamedSet={aiRenamedSet}
          showToast={showToast}
          onRefreshFiles={() => {
            loadServerFolders('general', '');
            loadServerFolders('media', '');
            loadServerFolders('video_vault', '');
            loadServerFolders('music', '');
            loadRecentFiles();
          }}
          onNavigateToFile={(category, itemPath, isFolder) => {
            const tabMap: Record<string, string> = { general: 'all', media: 'photos', video_vault: 'videos', music: 'music' };
            const tab = tabMap[category] || 'all';
            setActiveTab(tab);
            if (isFolder) {
              const folderId = `server-${category}-${itemPath}`;
              setCurrentFolderId(folderId);
              loadServerFolders(category, itemPath);
            } else {
              const parentPath = itemPath.includes('/') ? itemPath.substring(0, itemPath.lastIndexOf('/')) : '';
              if (parentPath) {
                setCurrentFolderId(`server-${category}-${parentPath}`);
                loadServerFolders(category, parentPath);
              } else {
                setCurrentFolderId(null);
                loadServerFolders(category, '');
              }
            }
          }}
          onSettingsChange={(s) => {
            setPdfThumbnails(s.pdfThumbnails);
            setAiAutoRename(s.aiAutoRename);
          }}
          onDeleteAccount={() => {
            setCurrentUser(null);
            setIsAuthenticated(false);
            setRecentItems([]);
            setActiveTab('overview');
            setCurrentFolderId(null);
            setSelectedFile(null);
            setSetupNeeded(true);
          }}
          onAutoLockChange={(enabled, timeout, pin) => {
            setAutoLockEnabled(enabled);
            setAutoLockTimeout(timeout);
            setAutoLockPin(pin);
          }}
          onFolderLockChange={(enabled, lockedFolders, pin) => {
            setLockedFolders(lockedFolders);
            setFolderLockPin(pin);
          }}
          isFolderLocked={(file) => {
            const fullPath = getSecurityFolderPath(file);
            if (!fullPath) return false;
            const relativePath = file.id.replace(/^server-[^-]+-/, '');
            return lockedFolders.includes(fullPath) || lockedFolders.includes(relativePath);
          }}
          mountedDevice={mountedDevice}
          onMountedDeviceOpen={(dev) => {
            setMountedDevice(dev);
          }}
          onDeselectFile={() => setSelectedFile(null)}
          onDelete={handleDelete}
        />

        {/* Upload Progress Popup */}
        <UploadProgress
          files={uploadProgress}
          visible={uploadProgressVisible}
          onDismiss={() => { setUploadProgressVisible(false); setUploadProgress([]); }}
        />

        {/* Toast Notification */}
        {toast && (
          <Toast toast={toast} onDismiss={() => setToast(null)} position="bottom-center" />
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
            if ((window as any).__tempCancelHandler) {
              (window as any).__tempCancelHandler();
              delete (window as any).__tempCancelHandler;
            } else {
              setConfirmModal({ ...confirmModal, isOpen: false });
            }
          }}
        />

        {/* Folder Lock PIN Prompt */}
        {folderLockPrompt.show && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-[600] animate-in fade-in duration-200"
              onClick={() => setFolderLockPrompt({ show: false, folderPath: '', folderId: '' })}
            />
            <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-8">
                <div className="text-center mb-6">
                  {/* Lock icon */}
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-2">Folder Locked</h3>
                  <p className="text-xs text-gray-400">Enter your 6-digit PIN to access <strong>{folderLockPrompt.folderPath}</strong></p>
                </div>

                {/* Lockout countdown */}
                {folderLockoutUntil && folderLockoutUntil > Date.now() ? (
                  <div className="mb-4">
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
                      <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <p className="text-red-700 text-xs font-bold mb-1">Security Lockout</p>
                      <p className="text-red-500 text-[11px]">Too many failed attempts</p>
                      <div className="mt-3 bg-red-100 rounded-xl py-2 px-4">
                        <p className="text-red-800 text-lg font-black font-mono tracking-wider">{folderLockCountdown}</p>
                        <p className="text-red-500 text-[10px] font-semibold mt-0.5">Try again after countdown</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setFolderLockPrompt({ show: false, folderPath: '', folderId: '' })}
                      className="w-full mt-3 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={folderLockInput}
                      onChange={(e) => {
                        setFolderLockInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                        if (folderLockError && !folderLockError.startsWith('Incorrect PIN')) setFolderLockError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && folderLockInput.length === 6 && handleFolderLockPinSubmit()}
                      placeholder="••••••"
                      className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none mb-4 placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-sm"
                      autoFocus
                    />

                    {/* Attempt indicator dots */}
                    {folderLockAttempts > 0 && folderLockAttempts < 4 && (
                      <div className="flex items-center justify-center gap-1.5 mb-3">
                        {[0, 1, 2, 3].map(i => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-all ${
                              i < folderLockAttempts
                                ? 'bg-red-400 scale-110'
                                : 'bg-gray-200'
                            }`}
                          />
                        ))}
                        <span className="ml-2 text-[10px] font-bold text-gray-400">
                          {folderLockAttempts}/4
                        </span>
                      </div>
                    )}

                    {folderLockError && (
                      <div className={`rounded-xl p-3 mb-4 flex items-center gap-2 ${
                        folderLockAttempts >= 3
                          ? 'bg-orange-50 border border-orange-200'
                          : 'bg-red-50 border border-red-100'
                      }`}>
                        <p className={`text-xs font-bold ${
                          folderLockAttempts >= 3 ? 'text-orange-600' : 'text-red-600'
                        }`}>{folderLockError}</p>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setFolderLockPrompt({ show: false, folderPath: '', folderId: '' })}
                        className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleFolderLockPinSubmit}
                        disabled={folderLockInput.length !== 6}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Unlock
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* New Folder Modal */}
        {newFolderModal.isOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-[600] animate-in fade-in duration-200"
              onClick={() => setNewFolderModal({ isOpen: false, folderName: '', error: null })}
            />
            <div className="fixed inset-0 z-[700] flex items-end justify-center p-0 animate-in fade-in slide-in-from-bottom-4 duration-200">
              <div className="bg-white rounded-t-3xl shadow-2xl w-full max-w-md overflow-hidden safe-area-bottom">
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3" />
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-black text-gray-900">Create New Folder</h3>
                </div>
                <div className="p-6">
                  <input
                    type="text"
                    autoFocus
                    value={newFolderModal.folderName}
                    onChange={(e) => setNewFolderModal(prev => ({ ...prev, folderName: e.target.value, error: null }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolderSubmit();
                      if (e.key === 'Escape') setNewFolderModal({ isOpen: false, folderName: '', error: null });
                    }}
                    placeholder="Folder name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm font-medium"
                  />
                  {newFolderModal.error && (
                    <p className="text-xs text-red-500 mt-2 font-medium">{newFolderModal.error}</p>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
                  <button
                    onClick={() => setNewFolderModal({ isOpen: false, folderName: '', error: null })}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateFolderSubmit}
                    disabled={!newFolderModal.folderName.trim()}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
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
            <div className="fixed inset-0 z-[700] flex items-end justify-center p-0 animate-in fade-in slide-in-from-bottom-4 duration-200">
              <div className="bg-white rounded-t-3xl shadow-2xl w-full max-w-md overflow-hidden safe-area-bottom">
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3" />
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-black text-gray-900">Rename</h3>
                  <p className="text-xs text-gray-500 mt-1">Rename <span className="font-bold text-gray-700">{renameModal.file.name}</span></p>
                </div>
                <div className="p-6">
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
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRenameSubmit}
                    disabled={!renameModal.newName.trim() || renameModal.newName.trim() === renameModal.file?.name}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    Rename
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* PWA Install Prompt */}
        <InstallPrompt />
      </>
    );
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
      <div className={`fixed md:relative top-0 left-0 bottom-0 md:inset-y-0 md:left-0 z-[600] md:z-10 transform transition-all duration-300 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } ${sidebarCollapsed ? 'md:-translate-x-full md:w-0 md:min-w-0 md:overflow-hidden' : 'md:translate-x-0'}`}>
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
            onSidebarDrop={handleSidebarDrop}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
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
          sidebarCollapsed={sidebarCollapsed}
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
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
                <SecurityVaultView
                  onAutoLockChange={(enabled, timeout, pin) => {
                    setAutoLockEnabled(enabled);
                    setAutoLockTimeout(timeout);
                    setAutoLockPin(pin);
                  }}
                  onFolderLockChange={(enabled, lockedFolders, pin) => {
                    setLockedFolders(lockedFolders);
                    setFolderLockPin(pin);
                  }}
                />
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
              ) : activeTab === 'domain' ? (
                <DomainSetupView showToast={showToast} />
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
                  onFileDrop={handleFileDrop}
                  isFolderLocked={(file) => {
                    const fullPath = getSecurityFolderPath(file);
                    if (!fullPath) return false;
                    const relativePath = file.id.replace(/^server-[^-]+-/, '');
                    return lockedFolders.includes(fullPath) || lockedFolders.includes(relativePath);
                  }}
                  onBulkAction={handleBulkFileAction}
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
        <Toast toast={toast} onDismiss={() => setToast(null)} position="bottom-right" />
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
