import { useState, useCallback } from 'react';
import type { FileItem } from '@/types';

export function useNavigation() {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

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
