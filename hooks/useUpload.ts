import { useState, useCallback } from 'react';
import type { UserData } from '@/types';
import type { ToastData } from '@/components/common/Toast';
import type { UploadFileProgress } from '@/components/common/UploadProgress';
import { unlockUploadAudio } from '@/components/common/UploadProgress';
import { authApi } from '@/services/api.client';
import { FILES_API, getCategoryFromTab } from '@/hooks/fileUtils';

interface UploadParams {
  activeTab: string;
  currentFolderId: string | null;
  currentPath: string;
  currentUser: UserData | null;
  showToast: (message: string, type?: ToastData['type'], icon?: ToastData['icon']) => void;
  loadServerFolders: (cat: string, path: string) => Promise<void>;
  loadRecentFiles: () => Promise<void>;
  setActiveTab: (tab: string) => void;
  setCurrentFolderId: (id: string | null) => void;
  setConfirmModal: React.Dispatch<React.SetStateAction<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info' | 'success'; confirmText?: string;
  }>>;
}

export function useUpload({
  activeTab, currentFolderId, currentPath, currentUser,
  showToast, loadServerFolders, loadRecentFiles, setActiveTab, setCurrentFolderId, setConfirmModal,
}: UploadParams) {
  const [uploadProgress, setUploadProgress] = useState<UploadFileProgress[]>([]);
  const [uploadProgressVisible, setUploadProgressVisible] = useState(false);
  const [aiAutoRename, setAiAutoRename] = useState(false);
  const [pdfThumbnails, setPdfThumbnails] = useState(true);
  const [videoThumbnails, setVideoThumbnails] = useState(true);
  const [aiRenamedSet, setAiRenamedSet] = useState<Set<string>>(new Set());

  const loadAiRenamedFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/renamed-files');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.renamedFiles) setAiRenamedSet(new Set(Object.keys(data.renamedFiles)));
      }
    } catch {}
  }, []);

  const handleUploadSingle = useCallback(async (file: File, uploadCategory: string, uploadPath: string, progressId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', uploadCategory);
    formData.append('path', uploadPath);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(prev => prev.map(f => f.id === progressId ? { ...f, progress: pct, status: 'uploading' as const } : f));
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(prev => prev.map(f => f.id === progressId ? { ...f, progress: 100, status: 'done' as const } : f));
          resolve();
        } else {
          let errMsg = 'Upload failed';
          try { errMsg = JSON.parse(xhr.responseText)?.error || errMsg; } catch {}
          setUploadProgress(prev => prev.map(f => f.id === progressId ? { ...f, status: 'error' as const, error: errMsg } : f));
          reject(new Error(errMsg));
        }
      });
      xhr.addEventListener('error', () => {
        setUploadProgress(prev => prev.map(f => f.id === progressId ? { ...f, status: 'error' as const, error: 'Network error' } : f));
        reject(new Error('Network error'));
      });
      xhr.open('POST', FILES_API + '/upload');
      const token = localStorage.getItem('sessionToken');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const relativePath = uploadPath ? `${uploadPath}/${file.name}` : file.name;
    authApi.trackRecentFile({ filePath: relativePath, fileName: file.name, fileType: ext, category: uploadCategory, sizeBytes: file.size })
      .then(() => loadRecentFiles()).catch(() => {});

    const imageExtsForRename = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'avif', 'heic', 'heif'];
    if (aiAutoRename && imageExtsForRename.includes(ext)) {
      showToast(`Analyzing "${file.name}" with AI...`, 'info', 'ai');
      try {
        const aiToken = localStorage.getItem('sessionToken');
        const aiHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (aiToken) aiHeaders['Authorization'] = `Bearer ${aiToken}`;
        const response = await fetch('/api/ai/analyze-image', {
          method: 'POST', headers: aiHeaders,
          body: JSON.stringify({ category: uploadCategory, filePath: relativePath }),
        });
        const result = await response.json();
        if (result.ok && result.renamed) {
          showToast(`AI renamed: "${file.name}" → "${result.newFileName}"`, 'success', 'ai');
          const cat = uploadCategory;
          const cPath = currentFolderId ? currentFolderId.replace(/^server-[^-]+-/, '') : '';
          await loadServerFolders(cat, cPath);
          loadRecentFiles();
          loadAiRenamedFiles();
        } else if (result.ok && !result.renamed) {
          showToast(`AI: "${result.title}" but rename failed`, 'error');
        } else {
          showToast(`AI analysis failed: ${result.error || 'Unknown error'}`, 'error');
        }
      } catch (e) {
        showToast(`AI rename failed: ${(e as Error).message}`, 'error');
      }
    }
  }, [aiAutoRename, currentFolderId, loadServerFolders, loadRecentFiles, loadAiRenamedFiles, showToast]);

  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
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
          isOpen: true, title: 'Choose Upload Location',
          message: `Upload ${files.length} file${files.length > 1 ? 's' : ''} to current folder "${currentPath.split('/').pop()}" or to root folder?`,
          confirmText: 'Current Folder', variant: 'info',
          onConfirm: () => {
            resolvedPath = currentPath;
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            resolve();
          },
        });
        (window as any).__tempCancelHandler = () => {
          resolvedPath = '';
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          resolve();
        };
      });
    }

    const progressFiles: UploadFileProgress[] = files.map((file, idx) => ({
      id: `upload-${Date.now()}-${idx}`, fileName: file.name, fileSize: file.size, progress: 0, status: 'pending' as const,
    }));
    setUploadProgress(progressFiles);
    setUploadProgressVisible(true);

    let failCount = 0;
    const categoriesToRefresh = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progressId = progressFiles[i].id;
      try {
        setUploadProgress(prev => prev.map(f => f.id === progressId ? { ...f, status: 'uploading' as const } : f));
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
      } catch { failCount++; }
    }

    for (const key of categoriesToRefresh) {
      const [cat, path] = key.split(':');
      await loadServerFolders(cat, path);
    }

    if (failCount === 0) setTimeout(() => setUploadProgressVisible(false), 4000);

    if (categoriesToRefresh.size === 1) {
      const [uploadedCat] = [...categoriesToRefresh][0].split(':');
      if (uploadedCat !== currentCategory) {
        if (uploadedCat === 'media') setActiveTab('photos');
        else if (uploadedCat === 'video_vault') setActiveTab('videos');
        else if (uploadedCat === 'general') setActiveTab('all');
        setCurrentFolderId(null);
      }
    }
  }, [activeTab, currentFolderId, currentPath, loadServerFolders, handleUploadSingle, setActiveTab, setCurrentFolderId, setConfirmModal]);

  return {
    uploadProgress,
    setUploadProgress,
    uploadProgressVisible,
    setUploadProgressVisible,
    aiAutoRename,
    setAiAutoRename,
    pdfThumbnails,
    setPdfThumbnails,
    videoThumbnails,
    setVideoThumbnails,
    aiRenamedSet,
    setAiRenamedSet,
    loadAiRenamedFiles,
    handleUploadSingle,
    handleUpload,
  };
}
