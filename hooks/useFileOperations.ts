import { useState, useCallback } from 'react';
import type { FileItem } from '@/types';
import type { UserData } from '@/types';
import type { ToastData } from '@/components/common/Toast';
import { authApi } from '@/services/api.client';
import { FILES_API, getCategoryFromTab, getSecurityFolderPath } from '@/hooks/fileUtils';

interface FileOperationsParams {
  files: FileItem[];
  currentUser: UserData | null;
  currentFolderId: string | null;
  currentPath: string;
  activeTab: string;
  lockedFolders: string[];
  ghostFolders: string[];
  loadServerFolders: (cat: string, path: string) => Promise<void>;
  loadRecentFiles: () => Promise<void>;
  setCurrentFolderId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
  setSelectedFile: (f: FileItem | null) => void;
  setRecentItems: React.Dispatch<React.SetStateAction<FileItem[]>>;
  setFiles: React.Dispatch<React.SetStateAction<FileItem[]>>;
  showToast: (message: string, type?: ToastData['type'], icon?: ToastData['icon']) => void;
  promptFolderUnlock: (path: string, id: string) => void;
  handleNavigate: (id: string | null) => void;
}

const tabToCategoryLabel: Record<string, string> = {
  all: 'Files', photos: 'Photos', videos: 'Videos', music: 'Music',
};

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function useFileOperations({
  files, currentUser, currentFolderId, currentPath, activeTab, lockedFolders, ghostFolders,
  loadServerFolders, loadRecentFiles,
  setCurrentFolderId, setActiveTab, setSelectedFile, setRecentItems, setFiles,
  showToast, promptFolderUnlock, handleNavigate,
}: FileOperationsParams) {
  const [newFolderModal, setNewFolderModal] = useState<{ isOpen: boolean; folderName: string; error: string | null }>({
    isOpen: false, folderName: '', error: null,
  });
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; file: FileItem | null; newName: string; error: string | null }>({
    isOpen: false, file: null, newName: '', error: null,
  });
  const [shareModal, setShareModal] = useState<{ isOpen: boolean; file: FileItem | null }>({
    isOpen: false, file: null,
  });
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info' | 'success'; confirmText?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const handleFileClick = useCallback((file: FileItem) => {
    if (file.isFolder) {
      const folderPath = file.id.replace(/^server-[^-]+-/, '');
      const fullPath = getSecurityFolderPath(file);
      if (lockedFolders.includes(fullPath ?? '') || lockedFolders.includes(folderPath)) {
        showToast('This folder is locked', 'warning', 'lock');
        promptFolderUnlock(fullPath ?? folderPath, file.id);
        return;
      }
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
    const filePath = file.id.replace(/^server-[^-]+-/, '').replace(/^recent-\d+$/, file.name);
    authApi.trackRecentFile({ filePath, fileName: file.name, fileType: file.isFolder ? 'folder' : file.type, category: file.category || undefined, sizeBytes: file.sizeBytes || undefined })
      .then(() => loadRecentFiles()).catch(() => {});
  }, [activeTab, handleNavigate, loadRecentFiles, lockedFolders, showToast, promptFolderUnlock, setActiveTab, setCurrentFolderId, setSelectedFile]);

  const createFolder = useCallback(() => {
    setNewFolderModal({ isOpen: true, folderName: '', error: null });
  }, []);

  const handleCreateFolderSubmit = useCallback(async () => {
    const name = newFolderModal.folderName.trim();
    if (!name) { setNewFolderModal(prev => ({ ...prev, error: 'Please enter a folder name' })); return; }
    const cat = getCategoryFromTab(activeTab);
    if (!cat) return;
    const pathForNew = currentPath ? `${currentPath}/${name}` : name;
    try {
      const res = await fetch(FILES_API + '/mkdir', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ category: cat, path: pathForNew }),
      });
      if (!res.ok) throw new Error('Create failed');
      await loadServerFolders(cat, currentPath);
      authApi.trackRecentFile({ filePath: pathForNew, fileName: name, fileType: 'folder', category: cat })
        .then(() => loadRecentFiles()).catch(() => {});
      setNewFolderModal({ isOpen: false, folderName: '', error: null });
      showToast(`Folder "${name}" created successfully`, 'success', 'folder');
    } catch {
      setNewFolderModal(prev => ({ ...prev, error: 'Could not create folder. Please try again.' }));
    }
  }, [newFolderModal.folderName, activeTab, currentPath, loadServerFolders, showToast]);

  const handleRenameSubmit = useCallback(async () => {
    const newName = renameModal.newName.trim();
    const file = renameModal.file;
    if (!newName || !file) { setRenameModal(prev => ({ ...prev, error: 'Please enter a name' })); return; }
    if (newName === file.name) { setRenameModal({ isOpen: false, file: null, newName: '', error: null }); return; }
    const cat = file.category || getCategoryFromTab(activeTab);
    if (!cat) return;
    const prefix = `server-${cat}-`;
    const sourcePath = file.id.startsWith(prefix) ? file.id.slice(prefix.length) : file.name;
    const lastSlash = sourcePath.lastIndexOf('/');
    const parentDir = lastSlash >= 0 ? sourcePath.substring(0, lastSlash + 1) : '';
    const targetPath = parentDir + newName;
    try {
      const res = await fetch(FILES_API + '/move', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ category: cat, sourcePath, targetPath }),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Rename failed'); }
      await loadServerFolders(cat, currentPath);
      loadRecentFiles();
      setRenameModal({ isOpen: false, file: null, newName: '', error: null });
      showToast(`Renamed to "${newName}"`, 'success', 'rename');
    } catch (e) {
      setRenameModal(prev => ({ ...prev, error: (e as Error).message || 'Rename failed. Please try again.' }));
    }
  }, [renameModal, activeTab, currentPath, loadServerFolders, loadRecentFiles, showToast]);

  const handleDelete = useCallback(async (file: FileItem) => {
    try {
      const cat = file.category || getCategoryFromTab(activeTab);
      if (!cat) return;
      const prefix = `server-${cat}-`;
      let relativePath = file.id.startsWith(prefix) ? file.id.slice(prefix.length) : file.name;
      if (currentPath && relativePath === file.name) relativePath = `${currentPath}/${file.name}`;
      const res = await fetch('/api/trash/move-to-trash', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ category: cat, path: relativePath }),
      });
      if (!res.ok) {
        const error = await res.json();
        const errMsg = error.error || 'Move to trash failed';
        // If file is already gone (not found), still clean it from UI & recents
        if (errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('no such file') || errMsg.toLowerCase().includes('enoent')) {
          setFiles(prev => prev.filter(f => f.id !== file.id));
          setRecentItems(prev => prev.filter(f => f.id !== file.id));
          setSelectedFile(null);
          loadRecentFiles();
          showToast(`${file.name} was already removed`, 'info');
          return;
        }
        throw new Error(errMsg);
      }
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setRecentItems(prev => prev.filter(f => f.id !== file.id));
      setSelectedFile(null);
      await loadServerFolders(cat, currentPath);
      loadRecentFiles();
      showToast(`${file.name} moved to trash`, 'success', 'trash');
    } catch (error) {
      showToast(`Delete failed: ${(error as Error).message}`, 'error');
    }
  }, [activeTab, currentPath, loadServerFolders, loadRecentFiles, showToast, setFiles, setRecentItems, setSelectedFile]);

  const handleFileAction = useCallback(async (action: string, file: FileItem, targetFolder?: FileItem) => {
    const cat = file.category || getCategoryFromTab(activeTab);
    if (!cat) return;
    try {
      switch (action) {
        case 'Open':
          if (file.url) { window.open(file.url, '_blank'); } else { handleFileClick(file); }
          break;
        case 'Download': {
          const prefix = `server-${cat}-`;
          const relativePath = file.id.startsWith(prefix) ? file.id.slice(prefix.length) : file.name;
          window.open(`${FILES_API}/download?category=${cat}&path=${encodeURIComponent(relativePath)}`, '_blank');
          break;
        }
        case 'Rename':
          setRenameModal({ isOpen: true, file, newName: file.name, error: null });
          break;
        case 'Share':
          if (!file.isFolder) {
            setShareModal({ isOpen: true, file });
          }
          break;
        case 'Delete':
          setConfirmModal({
            isOpen: true, title: 'Move to Trash',
            message: `Are you sure you want to move "${file.name}" to trash? You can restore it later from the trash.`,
            confirmText: 'Move to Trash', variant: 'warning',
            onConfirm: async () => { setConfirmModal(prev => ({ ...prev, isOpen: false })); await handleDelete(file); },
          });
          break;
        case 'MoveToRoot': {
          const sourcePrefix = `server-${cat}-`;
          const sourcePath = file.id.startsWith(sourcePrefix) ? file.id.slice(sourcePrefix.length) : file.name;
          const res = await fetch(FILES_API + '/move', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ category: cat, sourcePath, targetPath: file.name }) });
          if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Move failed'); }
          await loadServerFolders(cat, currentPath);
          loadRecentFiles();
          showToast(`${file.name} moved to root folder!`, 'success', 'move');
          break;
        }
        case 'Move':
          if (!targetFolder) return;
          {
            const sourcePrefix = `server-${cat}-`;
            const sourcePath = file.id.startsWith(sourcePrefix) ? file.id.slice(sourcePrefix.length) : file.name;
            const targetPrefix = `server-${cat}-`;
            const targetPath = targetFolder.id.startsWith(targetPrefix) ? targetFolder.id.slice(targetPrefix.length) : targetFolder.name;
            const res = await fetch(FILES_API + '/move', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ category: cat, sourcePath, targetPath: `${targetPath}/${file.name}` }) });
            if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Move failed'); }
            await loadServerFolders(cat, currentPath);
            loadRecentFiles();
            showToast(`${file.name} moved to ${targetFolder.name}!`, 'success', 'move');
          }
          break;
        default: break;
      }
    } catch (error) { showToast(`${action} failed: ${(error as Error).message}`, 'error'); }
  }, [activeTab, currentPath, handleDelete, handleFileClick, loadServerFolders, loadRecentFiles, showToast]);

  const handleBulkFileAction = useCallback(async (action: string, selectedFiles: FileItem[]) => {
    if (!selectedFiles.length) return;
    try {
      switch (action) {
        case 'Delete':
          setConfirmModal({
            isOpen: true, title: 'Move to Trash',
            message: `Are you sure you want to move ${selectedFiles.length} item${selectedFiles.length > 1 ? 's' : ''} to trash? You can restore them later.`,
            confirmText: 'Move to Trash', variant: 'warning',
            onConfirm: async () => {
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
              let count = 0;
              for (const file of selectedFiles) { try { await handleDelete(file); count++; } catch {} }
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
            window.open(`${FILES_API}/download?category=${cat}&path=${encodeURIComponent(relativePath)}`, '_blank');
          }
          break;
      }
    } catch (error) { showToast(`Bulk ${action.toLowerCase()} failed: ${(error as Error).message}`, 'error'); }
  }, [activeTab, handleDelete, showToast]);

  const handleFileDrop = useCallback((droppedFile: FileItem, targetFolder: FileItem) => {
    const fileCategory = droppedFile.category || getCategoryFromTab(activeTab);
    const folderCategory = targetFolder.category || getCategoryFromTab(activeTab);
    if (!fileCategory || !folderCategory) return;
    if (fileCategory !== folderCategory) {
      const sourceName = tabToCategoryLabel[Object.entries({ all: 'general', photos: 'media', videos: 'video_vault', music: 'music' }).find(([, v]) => v === fileCategory)?.[0] || ''] || fileCategory;
      const targetName = tabToCategoryLabel[Object.entries({ all: 'general', photos: 'media', videos: 'video_vault', music: 'music' }).find(([, v]) => v === folderCategory)?.[0] || ''] || folderCategory;
      setConfirmModal({
        isOpen: true, title: 'Move to Different Section',
        message: `"${droppedFile.name}" is from ${sourceName}. Do you want to move it into "${targetFolder.name}" in ${targetName}?`,
        confirmText: 'Move File', variant: 'info',
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          try {
            const sourcePrefix = `server-${fileCategory}-`;
            const sourcePath = droppedFile.id.startsWith(sourcePrefix) ? droppedFile.id.slice(sourcePrefix.length) : droppedFile.name;
            const targetPrefix = `server-${folderCategory}-`;
            const folderPath = targetFolder.id.startsWith(targetPrefix) ? targetFolder.id.slice(targetPrefix.length) : targetFolder.name;
            const res = await fetch(FILES_API + '/move-cross', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ sourceCategory: fileCategory, sourcePath, targetCategory: folderCategory, targetPath: `${folderPath}/${droppedFile.name}` }) });
            if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Move failed'); }
            await loadServerFolders(fileCategory, '');
            await loadServerFolders(folderCategory, '');
            loadRecentFiles();
            showToast(`${droppedFile.name} moved to ${targetFolder.name}!`, 'success', 'move');
          } catch (error) { showToast(`Move failed: ${(error as Error).message}`, 'error'); }
        },
      });
    } else {
      handleFileAction('Move', droppedFile, targetFolder);
    }
  }, [activeTab, handleFileAction, loadServerFolders, loadRecentFiles, showToast]);

  const handleSidebarDrop = useCallback((tabId: string, droppedFile: FileItem) => {
    const targetCategory = getCategoryFromTab(tabId);
    const sourceCategory = droppedFile.category || getCategoryFromTab(activeTab);
    if (!targetCategory || !sourceCategory) return;
    if (sourceCategory === targetCategory) { showToast(`${droppedFile.name} is already in ${tabToCategoryLabel[tabId] || tabId}`, 'info'); return; }
    const targetLabel = tabToCategoryLabel[tabId] || tabId;
    const sourceLabel = tabToCategoryLabel[Object.entries({ all: 'general', photos: 'media', videos: 'video_vault', music: 'music' }).find(([, v]) => v === sourceCategory)?.[0] || ''] || String(sourceCategory);
    setConfirmModal({
      isOpen: true, title: 'Move to Different Section',
      message: `Do you want to move "${droppedFile.name}" from ${sourceLabel} to ${targetLabel}? The file will be placed in the root of ${targetLabel}.`,
      confirmText: `Move to ${targetLabel}`, variant: 'info',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const sourcePrefix = `server-${sourceCategory}-`;
          const sourcePath = droppedFile.id.startsWith(sourcePrefix) ? droppedFile.id.slice(sourcePrefix.length) : droppedFile.name;
          const res = await fetch(FILES_API + '/move-cross', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ sourceCategory, sourcePath, targetCategory, targetPath: droppedFile.name }) });
          if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Move failed'); }
          await loadServerFolders(sourceCategory, '');
          await loadServerFolders(targetCategory, '');
          loadRecentFiles();
          showToast(`${droppedFile.name} moved to ${targetLabel}!`, 'success', 'move');
        } catch (error) { showToast(`Move failed: ${(error as Error).message}`, 'error'); }
      },
    });
  }, [activeTab, loadServerFolders, loadRecentFiles, showToast]);

  const isFolderLocked = useCallback((file: FileItem) => {
    const fullPath = getSecurityFolderPath(file);
    if (!fullPath) return false;
    const relativePath = file.id.replace(/^server-[^-]+-/, '');
    return lockedFolders.includes(fullPath) || lockedFolders.includes(relativePath);
  }, [lockedFolders]);

  return {
    newFolderModal,
    setNewFolderModal,
    renameModal,
    setRenameModal,
    shareModal,
    setShareModal,
    confirmModal,
    setConfirmModal,
    handleFileClick,
    createFolder,
    handleCreateFolderSubmit,
    handleRenameSubmit,
    handleDelete,
    handleFileAction,
    handleBulkFileAction,
    handleFileDrop,
    handleSidebarDrop,
    isFolderLocked,
  };
}
