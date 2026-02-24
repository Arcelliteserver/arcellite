import { useState, useCallback, useEffect } from 'react';
import type { FileItem } from '@/types';

const TAB_TO_PATH: Record<string, string> = {
  overview: '/',
  all: '/files',
  photos: '/photos',
  videos: '/videos',
  music: '/music',
  shared: '/shared',
  trash: '/trash',
  chat: '/chat',
  database: '/database',
  system: '/system',
  myapps: '/integrations',
  family: '/family',
  settings: '/settings',
  sessions: '/sessions',
  security: '/security',
  notifications: '/notifications',
  appearance: '/smart-features',
  aimodels: '/ai-models',
  apikeys: '/api-keys',
  aisecurity: '/ai-security',
  'manage-storage': '/storage',
  domain: '/domain',
  export: '/export',
  activity: '/activity',
  usb: '/external-storage',
  drive: '/drive',
  help: '/help',
  documentation: '/docs',
  updates: '/updates',
};

const PATH_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tab, path]) => [path, tab])
);

function getTabFromPath(): string {
  return PATH_TO_TAB[window.location.pathname] || 'overview';
}

export function useNavigation() {
  const [activeTab, setActiveTabState] = useState(getTabFromPath);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    const path = TAB_TO_PATH[tab] || '/';
    if (window.location.pathname !== path) {
      window.history.pushState({ tab }, '', path);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setActiveTabState(getTabFromPath());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleNavigate = useCallback((id: string | null) => {
    setCurrentFolderId(id);
    setSelectedFile(null);
  }, []);

  const handleGoBack = useCallback(
    (loadServerFolders: (cat: string, path: string) => void) => {
      if (!currentFolderId) return;
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
    },
    [currentFolderId]
  );

  return {
    activeTab,
    currentFolderId,
    selectedFile,
    setActiveTab,
    setCurrentFolderId,
    setSelectedFile,
    handleNavigate,
    handleGoBack,
  };
}
