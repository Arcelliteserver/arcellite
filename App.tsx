import React, { useEffect, useState } from 'react';
import Sidebar from './components/sidebar/Sidebar';
import Header from './components/header/Header';
import FileDetails from './components/files/FileDetails';
import MobileApp from './components/mobile/MobileApp';
// Features
import ChatView from './components/views/features/ChatView';
import HelpSupportView from './components/views/features/HelpSupportView';
import DocumentationView from './components/views/features/DocumentationView';
import MyAppsView from './components/views/features/MyAppsView';
import MyTasksView from './components/views/features/MyTasksView';

// PWA
import InstallPrompt from './components/pwa/InstallPrompt';

// Settings
import AccountSettingsView from './components/views/settings/AccountSettingsView';
import PlanBillingView from './components/views/settings/PlanBillingView';
import SessionsView from './components/views/settings/SessionsView';
import AppearanceView from './components/views/settings/AppearanceView';
import AIModelsView from './components/views/settings/AIModelsView';
import APIKeysView from './components/views/settings/APIKeysView';
import AISecurityView from './components/views/settings/AISecurityView';
import NotificationsView from './components/views/settings/NotificationsView';
import FamilySharingView from './components/views/settings/FamilySharingView';

// System
import SystemView from './components/views/system/SystemView';
import UpdateView from './components/views/system/UpdateView';
import RemovableStorageView from './components/views/system/RemovableStorageView';
import MountedDeviceView from './components/views/system/MountedDeviceView';
import SecurityVaultView from './components/views/system/SecurityVaultView';
import ExportDataView from './components/views/system/ExportDataView';
import DomainSetupView from './components/views/settings/DomainSetupView';
import TrashView from './components/views/system/TrashView';
import ActivityLogView from './components/views/system/ActivityLogView';
import DatabaseView from './components/views/system/DatabaseView';
import FilesView from './components/views/files/FilesView';
import SharedView from './components/views/files/SharedView';
import ManageStorageView from './components/views/settings/ManageStorageView';
import AuthView from './components/auth/AuthView';
import AccessDeniedView from './components/views/AccessDeniedView';
import MobileAccessDeniedView from './components/mobile/MobileAccessDeniedView';
import ConfirmModal from './components/common/ConfirmModal';
import ShareDialog from './components/common/ShareDialog';
import UploadProgress from './components/common/UploadProgress';
import GlobalMusicPlayer from './components/common/GlobalMusicPlayer';
import Toast from './components/common/Toast';
import LockScreen from './components/common/LockScreen';
import SetupWizard from './components/onboarding/SetupWizard';

import { authApi } from './services/api.client';

// Custom hooks
import { useAuth } from './hooks/useAuth';
import { useNavigation } from './hooks/useNavigation';
import { useFileSystem } from './hooks/useFileSystem';
import { useFileOperations } from './hooks/useFileOperations';
import { useUpload } from './hooks/useUpload';
import { useScreenLock } from './hooks/useScreenLock';
import { useFolderLock } from './hooks/useFolderLock';
import { useLayout } from './hooks/useLayout';
import type { FileItem } from './types';

const App: React.FC = () => {
  const [nowPlaying, setNowPlaying] = useState<FileItem | null>(null);
  // ── Hooks ────────────────────────────────────────────────────────
  const auth = useAuth();
  const nav = useNavigation();
  const layout = useLayout();

  const folderLock = useFolderLock({
    setActiveTab: nav.setActiveTab,
    setCurrentFolderId: nav.setCurrentFolderId,
    handleNavigate: nav.handleNavigate,
    activeTab: nav.activeTab,
  });

  const screenLock = useScreenLock();

  const fileSystem = useFileSystem({
    activeTab: nav.activeTab,
    currentFolderId: nav.currentFolderId,
    ghostFolders: folderLock.ghostFolders,
    currentUser: auth.currentUser,
  });

  const fileOps = useFileOperations({
    files: fileSystem.files,
    currentUser: auth.currentUser,
    currentFolderId: nav.currentFolderId,
    currentPath: fileSystem.currentPath,
    activeTab: nav.activeTab,
    lockedFolders: folderLock.lockedFolders,
    ghostFolders: folderLock.ghostFolders,
    loadServerFolders: fileSystem.loadServerFolders,
    loadRecentFiles: fileSystem.loadRecentFiles,
    setCurrentFolderId: nav.setCurrentFolderId,
    setActiveTab: nav.setActiveTab,
    setSelectedFile: nav.setSelectedFile,
    setRecentItems: fileSystem.setRecentItems,
    setFiles: fileSystem.setFiles,
    showToast: layout.showToast,
    promptFolderUnlock: folderLock.promptFolderUnlock,
    handleNavigate: nav.handleNavigate,
  });

  const upload = useUpload({
    activeTab: nav.activeTab,
    currentFolderId: nav.currentFolderId,
    currentPath: fileSystem.currentPath,
    currentUser: auth.currentUser,
    showToast: layout.showToast,
    loadServerFolders: fileSystem.loadServerFolders,
    loadRecentFiles: fileSystem.loadRecentFiles,
    setActiveTab: nav.setActiveTab,
    setCurrentFolderId: nav.setCurrentFolderId,
    setConfirmModal: fileOps.setConfirmModal,
  });

  // ── Settings fan-out after login ────────────────────────────────
  useEffect(() => {
    if (!auth.currentUser || !auth.isAuthenticated) return;
    Promise.all([
      authApi.getSettings().catch(() => ({ settings: {} })),
      authApi.getSecurityStatus().catch(() => ({ ghostFolders: [] })),
    ]).then(([settingsRes, secStatus]: [any, any]) => {
      const s = settingsRes.settings || {};
      upload.setPdfThumbnails(s.pdfThumbnails ?? true);
      upload.setVideoThumbnails(s.videoThumbnails ?? true);
      upload.setAiAutoRename(s.aiAutoRename ?? false);
      screenLock.initFromSettings(s);
      folderLock.initFromSettings(s);
      folderLock.initFromSecurity(secStatus);
    }).catch(() => {});
  }, [auth.currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load recent files & AI-renamed set when authenticated ────────
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    fileSystem.loadRecentFiles();
    upload.loadAiRenamedFiles();
  }, [auth.isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-lock idle timer ─────────────────────────────────────────
  useEffect(() => {
    if (!auth.isAuthenticated || !screenLock.autoLockEnabled || !screenLock.autoLockPin || layout.isMobileDevice) return;
    const timeoutMs = screenLock.autoLockTimeout * 60 * 1000;
    const resetTimer = () => {
      if (screenLock.autoLockTimerRef.current) clearTimeout(screenLock.autoLockTimerRef.current);
      screenLock.autoLockTimerRef.current = setTimeout(() => screenLock.setIsScreenLocked(true), timeoutMs);
    };
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (screenLock.autoLockTimerRef.current) clearTimeout(screenLock.autoLockTimerRef.current);
    };
  }, [auth.isAuthenticated, screenLock.autoLockEnabled, screenLock.autoLockPin, screenLock.autoLockTimeout]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── USB device SSE ───────────────────────────────────────────────
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    const connect = () => {
      eventSource = new EventSource('/api/system/usb-events');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'change') {
            for (const dev of data.added || []) {
              const name = dev.label || dev.model || dev.name;
              layout.showToast(`${name} connected (${dev.sizeHuman})`, 'info', 'usb');
            }
            for (const name of data.removed || []) {
              layout.showToast(`Device ${name} disconnected`, 'info', 'usb');
              if (layout.mountedDevice && (layout.mountedDevice as any).name === name) {
                layout.setMountedDevice(null);
                if (nav.activeTab === 'drive') nav.setActiveTab('usb');
              }
            }
          }
        } catch {}
      };
      eventSource.onerror = () => {
        eventSource?.close();
        reconnectTimeout = setTimeout(connect, 10000);
      };
    };
    connect();
    return () => { eventSource?.close(); clearTimeout(reconnectTimeout); };
  }, [auth.isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigate-to-apps window event ────────────────────────────────
  useEffect(() => {
    const handler = () => nav.setActiveTab('myapps');
    window.addEventListener('navigate-to-apps', handler);
    return () => window.removeEventListener('navigate-to-apps', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ───────────────────────────────────────────────
  const showFileControls = ['all', 'photos', 'videos', 'music', 'overview', 'shared', 'trash', 'drive'].includes(nav.activeTab);
  const showNewFolder = ['all', 'photos', 'videos', 'music'].includes(nav.activeTab);

  // ── handleSignOut (orchestrated across multiple hooks) ───────────
  const handleSignOut = async () => {
    await auth.handleSignOut();
    nav.setActiveTab('overview');
    nav.setCurrentFolderId(null);
    nav.setSelectedFile(null);
    fileSystem.setRecentItems([]);
    screenLock.setAutoLockEnabled(false);
    screenLock.setAutoLockPin('');
    screenLock.setIsScreenLocked(false);
    layout.setMountedDevice(null);
  };

  const handleDeleteAccount = () => {
    auth.handleDeleteAccount();
    nav.setActiveTab('overview');
    nav.setCurrentFolderId(null);
    nav.setSelectedFile(null);
    fileSystem.setRecentItems([]);
  };

  // ── Early renders: skeleton matches app layout (sidebar + dashboard on desktop; header + content + bottom nav on mobile) ──
  if (auth.checkingSetup) {
    const useMobileSkeleton = layout.isMobile || layout.isMobileDevice;
    if (useMobileSkeleton) {
      return (
        <div className="flex flex-col h-screen bg-[#F7F7F7] text-[#222222] antialiased overflow-hidden">
          {/* Mobile skeleton: matches MobileHeader (search bar + bell) */}
          <header className="fixed top-0 left-0 right-0 z-[200] safe-area-top bg-[#F7F7F7]/95 backdrop-blur-sm border-b border-gray-200/60">
            <div className="flex items-center gap-3 px-4 sm:px-5 h-[72px] pt-1">
              <div className="flex-1 min-w-0 h-[48px] bg-white border border-gray-200 rounded-2xl animate-pulse" />
              <div className="w-[48px] h-[48px] rounded-2xl bg-white border border-gray-200 animate-pulse flex-shrink-0" />
            </div>
          </header>
          {/* Main: same padding as MobileApp main (pt for header, pb for bottom nav) */}
          <main className="flex-1 min-h-0 pt-[76px] pb-[120px] sm:pb-[130px] overflow-y-auto overflow-x-hidden px-4 sm:px-5 py-5">
            <div className="mb-5">
              <div className="h-6 w-28 rounded-lg bg-gray-200 animate-pulse mb-3" />
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-gray-100 border border-gray-100 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                ))}
              </div>
            </div>
            <div className="h-4 w-32 rounded bg-gray-100 animate-pulse mb-2" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-gray-100 border border-gray-100 animate-pulse" style={{ animationDelay: `${(i + 4) * 50}ms` }} />
              ))}
            </div>
          </main>
          {/* Bottom nav: matches MobileBottomNav (dark pill, 5 items) */}
          <nav className="fixed bottom-0 left-0 right-0 z-[100] px-3 sm:px-4 pb-4 sm:pb-5 safe-area-bottom pointer-events-none">
            <div className="h-[72px] sm:h-[84px] bg-[#111214] border border-[#2d2d2f] rounded-3xl flex items-center justify-around px-2 shadow-xl shadow-black/20 pointer-events-none">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-9 h-9 rounded-xl bg-[#2d2d2f] animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
              ))}
            </div>
          </nav>
        </div>
      );
    }
    return (
      <div className="flex h-screen bg-gray-100 text-[#1d1d1f] antialiased overflow-hidden">
        {/* Sidebar placeholder */}
        <div className="w-60 flex-shrink-0 h-full bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <div className="h-8 w-8 rounded-xl bg-gray-200 animate-pulse" />
          </div>
          <div className="flex-1 p-2 space-y-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-9 rounded-lg bg-gray-100 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
          <div className="p-3 border-t border-gray-100">
            <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          </div>
        </div>
        {/* Main content placeholder (dashboard) */}
        <main className="flex-1 flex flex-col min-w-0 bg-white rounded-tl-[20px] overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-1 h-8 bg-gray-200 rounded-full animate-pulse flex-shrink-0" />
              <div className="space-y-1">
                <div className="h-5 w-32 rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-48 rounded bg-gray-50 animate-pulse" />
              </div>
            </div>
            <div className="h-9 w-24 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
          </div>
          <div className="flex-1 p-6 overflow-auto">
            <div className="mb-6">
              <div className="h-4 w-24 rounded bg-gray-100 animate-pulse mb-2" />
              <div className="h-px bg-gray-100" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-gray-50 border border-gray-100 animate-pulse" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (auth.setupNeeded) {
    return (
      <SetupWizard
        onComplete={async () => {
          try { const { user } = await authApi.getCurrentUser(); auth.setCurrentUser(user); } catch {}
          auth.setSetupNeeded(false);
          auth.setIsAuthenticated(true);
          fileSystem.loadRecentFiles();
          upload.loadAiRenamedFiles();
          Promise.all([
            authApi.getSettings().catch(() => ({ settings: {} })),
            authApi.getSecurityStatus().catch(() => ({ ghostFolders: [] })),
          ]).then(([settingsRes, secStatus]: [any, any]) => {
            const s = settingsRes.settings || {};
            upload.setPdfThumbnails(s.pdfThumbnails ?? true);
            upload.setVideoThumbnails(s.videoThumbnails ?? true);
            upload.setAiAutoRename(s.aiAutoRename ?? false);
            screenLock.initFromSettings(s);
            folderLock.initFromSettings(s);
            folderLock.initFromSecurity(secStatus);
          }).catch(() => {});
        }}
      />
    );
  }

  if (!auth.isAuthenticated) {
    const showDenied = auth.showAccessDenied || auth.accessStatus === 'denied';
    if (showDenied) return layout.isMobile ? <MobileAccessDeniedView /> : <AccessDeniedView />;
    if (auth.accessStatus === 'pending') {
      const useMobileSkeleton = layout.isMobile || layout.isMobileDevice;
      if (useMobileSkeleton) {
        return (
          <div className="flex flex-col h-screen bg-[#F7F7F7] text-[#222222] antialiased overflow-hidden">
            <header className="fixed top-0 left-0 right-0 z-[200] safe-area-top bg-[#F7F7F7]/95 backdrop-blur-sm border-b border-gray-200/60">
              <div className="flex items-center gap-3 px-4 sm:px-5 h-[72px] pt-1">
                <div className="flex-1 min-w-0 h-[48px] bg-white border border-gray-200 rounded-2xl animate-pulse" />
                <div className="w-[48px] h-[48px] rounded-2xl bg-white border border-gray-200 animate-pulse flex-shrink-0" />
              </div>
            </header>
            <main className="flex-1 min-h-0 pt-[76px] pb-[120px] sm:pb-[130px] flex items-center justify-center px-4">
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-[#5D5FEF] animate-spin" />
                <span className="text-sm font-medium">Loading…</span>
              </div>
            </main>
            <nav className="fixed bottom-0 left-0 right-0 z-[100] px-3 sm:px-4 pb-4 sm:pb-5 safe-area-bottom pointer-events-none">
              <div className="h-[72px] sm:h-[84px] bg-[#111214] border border-[#2d2d2f] rounded-3xl flex items-center justify-around px-2 shadow-xl shadow-black/20">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-9 h-9 rounded-xl bg-[#2d2d2f] animate-pulse" />
                ))}
              </div>
            </nav>
          </div>
        );
      }
      return (
        <div className="flex h-screen bg-gray-100 text-[#1d1d1f] antialiased overflow-hidden">
          <div className="w-60 flex-shrink-0 h-full bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <div className="h-8 w-8 rounded-xl bg-gray-200 animate-pulse" />
            </div>
            <div className="flex-1 p-2 space-y-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-9 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
            <div className="p-3 border-t border-gray-100">
              <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          </div>
          <main className="flex-1 flex flex-col min-w-0 bg-white rounded-tl-[20px] overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-1 h-8 bg-gray-200 rounded-full animate-pulse flex-shrink-0" />
                <div className="space-y-1">
                  <div className="h-5 w-32 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-48 rounded bg-gray-50 animate-pulse" />
                </div>
              </div>
              <div className="h-9 w-24 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
            </div>
            <div className="flex-1 p-6 flex items-center justify-center">
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-gray-400 animate-spin" />
                <span className="text-sm font-medium">Loading…</span>
              </div>
            </div>
          </main>
        </div>
      );
    }
    return <AuthView onLogin={auth.handleLogin} onAccessDenied={() => auth.setShowAccessDenied(true)} />;
  }

  if (!layout.isMobileDevice && screenLock.isScreenLocked && screenLock.autoLockPin) {
    return <LockScreen correctPin={screenLock.autoLockPin} onUnlock={() => screenLock.setIsScreenLocked(false)} />;
  }
  if (!layout.isMobileDevice && screenLock.isScreenLocked && !screenLock.autoLockPin) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[9999]"
        style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #111128 25%, #0d0d24 50%, #0a0a1a 100%)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#5D5FEF] animate-spin" />
      </div>
    );
  }

  // ── Mobile ───────────────────────────────────────────────────────
  if (layout.isMobile) {
    return (
      <>
        <MobileApp
          user={auth.currentUser}
          onUserUpdate={auth.setCurrentUser}
          onSignOut={handleSignOut}
          files={fileSystem.files}
          recentItems={fileSystem.recentItems}
          currentFolderId={nav.currentFolderId}
          selectedFile={nav.selectedFile}
          searchQuery={fileSystem.searchQuery}
          onSearchChange={fileSystem.setSearchQuery}
          activeTab={nav.activeTab}
          onTabChange={(tab) => { nav.setActiveTab(tab); nav.handleNavigate(null); nav.setCurrentFolderId(null); }}
          onFileClick={fileOps.handleFileClick}
          onFileAction={fileOps.handleFileAction}
          onGoBack={() => nav.handleGoBack(fileSystem.loadServerFolders)}
          onNavigate={nav.handleNavigate}
          onCreateFolder={fileOps.createFolder}
          onUpload={upload.handleUpload}
          filteredFolders={fileSystem.filteredFolders}
          filteredFilesOnly={fileSystem.filteredFilesOnly}
          selectedModel={layout.selectedModel}
          onModelChange={layout.handleModelChange}
          pdfThumbnails={upload.pdfThumbnails}
          videoThumbnails={upload.videoThumbnails}
          aiRenamedSet={upload.aiRenamedSet}
          showToast={layout.showToast}
          onRefreshFiles={() => {
            fileSystem.loadServerFolders('general', '');
            fileSystem.loadServerFolders('media', '');
            fileSystem.loadServerFolders('video_vault', '');
            fileSystem.loadServerFolders('music', '');
            fileSystem.loadRecentFiles();
          }}
          onNavigateToFile={(category, itemPath, isFolder) => {
            const tabMap: Record<string, string> = { general: 'all', media: 'photos', video_vault: 'videos', music: 'music' };
            nav.setActiveTab(tabMap[category] || 'all');
            if (isFolder) {
              nav.setCurrentFolderId(`server-${category}-${itemPath}`);
              fileSystem.loadServerFolders(category, itemPath);
            } else {
              const parentPath = itemPath.includes('/') ? itemPath.substring(0, itemPath.lastIndexOf('/')) : '';
              if (parentPath) {
                nav.setCurrentFolderId(`server-${category}-${parentPath}`);
                fileSystem.loadServerFolders(category, parentPath);
              } else {
                nav.setCurrentFolderId(null);
                fileSystem.loadServerFolders(category, '');
              }
            }
          }}
          onSettingsChange={(s) => {
            upload.setPdfThumbnails(s.pdfThumbnails);
            upload.setVideoThumbnails(s.videoThumbnails);
            upload.setAiAutoRename(s.aiAutoRename);
          }}
          onDeleteAccount={handleDeleteAccount}
          onAutoLockChange={(enabled, timeout, pin) => {
            screenLock.setAutoLockEnabled(enabled);
            screenLock.setAutoLockTimeout(timeout);
            screenLock.setAutoLockPin(pin);
          }}
          onFolderLockChange={(_enabled, lockedFolders, pin) => {
            folderLock.setLockedFolders(lockedFolders);
            folderLock.setFolderLockPin(pin);
          }}
          isFolderLocked={fileOps.isFolderLocked}
          mountedDevice={layout.mountedDevice}
          onMountedDeviceOpen={(dev) => layout.setMountedDevice(dev)}
          onDeselectFile={() => nav.setSelectedFile(null)}
          onDelete={fileOps.handleDelete}
          isFamilyMember={auth.currentUser?.isFamilyMember === true}
          onShareWithFamily={(file) => fileOps.setShareModal({ isOpen: true, file })}
        />

        <UploadProgress
          files={upload.uploadProgress}
          visible={upload.uploadProgressVisible}
          onDismiss={() => { upload.setUploadProgressVisible(false); upload.setUploadProgress([]); }}
        />

        {layout.toast && <Toast toast={layout.toast} onDismiss={() => layout.setToast(null)} position="bottom-center" />}

        <ConfirmModal
          isOpen={fileOps.confirmModal.isOpen}
          title={fileOps.confirmModal.title}
          message={fileOps.confirmModal.message}
          confirmText={fileOps.confirmModal.confirmText}
          variant={fileOps.confirmModal.variant}
          onConfirm={fileOps.confirmModal.onConfirm}
          onCancel={() => {
            if ((window as any).__tempCancelHandler) {
              (window as any).__tempCancelHandler();
              delete (window as any).__tempCancelHandler;
            } else {
              fileOps.setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
          }}
        />

        {/* Folder Lock PIN Prompt */}
        {folderLock.folderLockPrompt.show && (
          <>
            <div className="fixed inset-0 bg-black/50 z-[600] animate-in fade-in duration-200"
              onClick={() => folderLock.setFolderLockPrompt({ show: false, folderPath: '', folderId: '' })} />
            <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-8">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-2">Folder Locked</h3>
                  <p className="text-xs text-gray-400">Enter your 6-digit PIN to access <strong>{folderLock.folderLockPrompt.folderPath}</strong></p>
                </div>
                {folderLock.folderLockoutUntil && folderLock.folderLockoutUntil > Date.now() ? (
                  <div className="mb-4">
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
                      <p className="text-red-700 text-xs font-bold mb-1">Security Lockout</p>
                      <p className="text-red-500 text-[11px]">Too many failed attempts</p>
                      <div className="mt-3 bg-red-100 rounded-xl py-2 px-4">
                        <p className="text-red-800 text-lg font-black font-mono tracking-wider">{folderLock.folderLockCountdown}</p>
                        <p className="text-red-500 text-[10px] font-semibold mt-0.5">Try again after countdown</p>
                      </div>
                    </div>
                    <button onClick={() => folderLock.setFolderLockPrompt({ show: false, folderPath: '', folderId: '' })}
                      className="w-full mt-3 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all">
                      Close
                    </button>
                  </div>
                ) : (
                  <>
                    <input type="password" inputMode="numeric" maxLength={6} value={folderLock.folderLockInput}
                      onChange={(e) => { folderLock.setFolderLockInput(e.target.value.replace(/\D/g, '').slice(0, 6)); if (folderLock.folderLockError && !folderLock.folderLockError.startsWith('Incorrect PIN')) folderLock.setFolderLockError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && folderLock.folderLockInput.length === 6 && folderLock.handleFolderLockPinSubmit()}
                      placeholder="••••••"
                      className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none mb-4 placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-sm"
                      autoFocus />
                    {folderLock.folderLockAttempts > 0 && folderLock.folderLockAttempts < 4 && (
                      <div className="flex items-center justify-center gap-1.5 mb-3">
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} className={`w-2 h-2 rounded-full transition-all ${i < folderLock.folderLockAttempts ? 'bg-red-400 scale-110' : 'bg-gray-200'}`} />
                        ))}
                        <span className="ml-2 text-[10px] font-bold text-gray-400">{folderLock.folderLockAttempts}/4</span>
                      </div>
                    )}
                    {folderLock.folderLockError && (
                      <div className={`rounded-xl p-3 mb-4 flex items-center gap-2 ${folderLock.folderLockAttempts >= 3 ? 'bg-orange-50 border border-orange-200' : 'bg-red-50 border border-red-100'}`}>
                        <p className={`text-xs font-bold ${folderLock.folderLockAttempts >= 3 ? 'text-orange-600' : 'text-red-600'}`}>{folderLock.folderLockError}</p>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => folderLock.setFolderLockPrompt({ show: false, folderPath: '', folderId: '' })}
                        className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all">
                        Cancel
                      </button>
                      <button onClick={folderLock.handleFolderLockPinSubmit} disabled={folderLock.folderLockInput.length !== 6}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
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
        {fileOps.newFolderModal.isOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-[600] animate-in fade-in duration-200"
              onClick={() => fileOps.setNewFolderModal({ isOpen: false, folderName: '', error: null })} />
            <div className="fixed inset-0 z-[700] flex items-end justify-center p-0 animate-in fade-in slide-in-from-bottom-4 duration-200">
              <div className="bg-white rounded-t-3xl shadow-2xl w-full max-w-md overflow-hidden safe-area-bottom">
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3" />
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-black text-gray-900">Create New Folder</h3>
                </div>
                <div className="p-6">
                  <input type="text" autoFocus value={fileOps.newFolderModal.folderName}
                    onChange={(e) => fileOps.setNewFolderModal(prev => ({ ...prev, folderName: e.target.value, error: null }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') fileOps.handleCreateFolderSubmit(); if (e.key === 'Escape') fileOps.setNewFolderModal({ isOpen: false, folderName: '', error: null }); }}
                    placeholder="Folder name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm font-medium" />
                  {fileOps.newFolderModal.error && <p className="text-xs text-red-500 mt-2 font-medium">{fileOps.newFolderModal.error}</p>}
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
                  <button onClick={() => fileOps.setNewFolderModal({ isOpen: false, folderName: '', error: null })}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</button>
                  <button onClick={fileOps.handleCreateFolderSubmit} disabled={!fileOps.newFolderModal.folderName.trim()}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Create</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Rename Modal */}
        {fileOps.renameModal.isOpen && fileOps.renameModal.file && (
          <>
            <div className="fixed inset-0 bg-black/50 z-[600] animate-in fade-in duration-200"
              onClick={() => fileOps.setRenameModal({ isOpen: false, file: null, newName: '', error: null })} />
            <div className="fixed inset-0 z-[700] flex items-end justify-center p-0 animate-in fade-in slide-in-from-bottom-4 duration-200">
              <div className="bg-white rounded-t-3xl shadow-2xl w-full max-w-md overflow-hidden safe-area-bottom">
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3" />
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-black text-gray-900">Rename</h3>
                  <p className="text-xs text-gray-500 mt-1">Rename <span className="font-bold text-gray-700">{fileOps.renameModal.file.name}</span></p>
                </div>
                <div className="p-6">
                  <input type="text" autoFocus value={fileOps.renameModal.newName}
                    onChange={(e) => fileOps.setRenameModal(prev => ({ ...prev, newName: e.target.value, error: null }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') fileOps.handleRenameSubmit(); if (e.key === 'Escape') fileOps.setRenameModal({ isOpen: false, file: null, newName: '', error: null }); }}
                    onFocus={(e) => { const val = e.target.value; const dotIdx = val.lastIndexOf('.'); if (dotIdx > 0 && !fileOps.renameModal.file?.isFolder) { e.target.setSelectionRange(0, dotIdx); } else { e.target.select(); } }}
                    placeholder="New name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm font-medium" />
                  {fileOps.renameModal.error && <p className="text-xs text-red-500 mt-2 font-medium">{fileOps.renameModal.error}</p>}
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
                  <button onClick={() => fileOps.setRenameModal({ isOpen: false, file: null, newName: '', error: null })}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</button>
                  <button onClick={fileOps.handleRenameSubmit} disabled={!fileOps.renameModal.newName.trim() || fileOps.renameModal.newName.trim() === fileOps.renameModal.file?.name}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Rename</button>
                </div>
              </div>
            </div>
          </>
        )}

        <InstallPrompt />

        {/* Share Dialog */}
        <ShareDialog
          isOpen={fileOps.shareModal.isOpen}
          file={fileOps.shareModal.file}
          onClose={() => fileOps.setShareModal({ isOpen: false, file: null })}
          onSuccess={(msg) => layout.showToast(msg, 'success')}
          onError={(msg) => layout.showToast(msg, 'error')}
        />
      </>
    );
  }

  // ── Desktop ──────────────────────────────────────────────────────
  return (
    <div className={`flex h-screen bg-[#111214] text-[#1d1d1f] antialiased overflow-hidden max-w-full ${layout.isResizing ? 'cursor-col-resize select-none' : ''}`}>

      {layout.isMobileMenuOpen && (
        <div className="fixed inset-0 z-[499] md:hidden"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)', WebkitTapHighlightColor: 'transparent' }}
          onClick={() => layout.setIsMobileMenuOpen(false)} />
      )}

      <div className={`fixed md:relative top-0 left-0 bottom-0 md:inset-y-0 md:left-0 z-[600] md:z-10 transform transition-all duration-300 ${layout.isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-full overflow-hidden">
          <Sidebar
            activeTab={nav.activeTab}
            setActiveTab={(tab) => {
              nav.setActiveTab(tab);
              nav.handleNavigate(null);
              nav.setCurrentFolderId(null);
              layout.setIsMobileMenuOpen(false);
            }}
            onUpload={upload.handleUpload}
            onSidebarDrop={fileOps.handleSidebarDrop}
            collapsed={layout.sidebarCollapsed}
            onToggleCollapse={() => layout.setSidebarCollapsed(!layout.sidebarCollapsed)}
            isFamilyMember={auth.currentUser?.isFamilyMember === true}
            isSuspended={auth.currentUser?.isSuspended === true}
          />
        </div>
      </div>

      <main className={`flex-1 flex flex-col h-full overflow-hidden bg-white md:rounded-tl-[20px] w-full md:w-auto min-w-0 max-w-full relative ${layout.isMobileMenuOpen ? 'z-[400]' : 'z-0'} md:z-auto`}>
        {/* Suspension banner — shown only to suspended family members */}
        {auth.currentUser?.isSuspended && (
          <div className="flex items-center justify-center gap-3 px-4 py-2.5 bg-amber-500 text-white text-xs font-bold z-50 flex-shrink-0">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>Your account is suspended. You can view your files but cannot upload or make changes. Contact the account administrator.</span>
          </div>
        )}
        <Header
          activeTab={nav.activeTab}
          searchQuery={fileSystem.searchQuery}
          onSearchChange={fileSystem.setSearchQuery}
          onNavigate={nav.handleNavigate}
          onAccountSettings={() => nav.setActiveTab('settings')}
          onSecurityVault={() => nav.setActiveTab('security')}
          onTabChange={nav.setActiveTab}
          onSignOut={handleSignOut}
          onMobileMenuToggle={() => layout.setIsMobileMenuOpen(!layout.isMobileMenuOpen)}
          sidebarCollapsed={layout.sidebarCollapsed}
          onSidebarToggle={() => layout.setSidebarCollapsed(!layout.sidebarCollapsed)}
          user={auth.currentUser}
        />

        {nav.activeTab === 'documentation' ? (
          <DocumentationView />
        ) : nav.activeTab === 'chat' ? (
          <ChatView selectedModel={layout.selectedModel} user={auth.currentUser} isFamilyMember={auth.currentUser?.isFamilyMember === true} onRefreshFiles={() => {
            fileSystem.loadServerFolders('general', '');
            fileSystem.loadServerFolders('media', '');
            fileSystem.loadServerFolders('video_vault', '');
            fileSystem.loadServerFolders('music', '');
            fileSystem.loadRecentFiles();
          }} onNavigateToDatabase={() => nav.setActiveTab('database')}
          onNavigateToFile={(category, itemPath, isFolder) => {
            const tabMap: Record<string, string> = { general: 'all', media: 'photos', video_vault: 'videos', music: 'music' };
            nav.setActiveTab(tabMap[category] || 'all');
            if (isFolder) {
              nav.setCurrentFolderId(`server-${category}-${itemPath}`);
              fileSystem.loadServerFolders(category, itemPath);
            } else {
              const parentPath = itemPath.includes('/') ? itemPath.substring(0, itemPath.lastIndexOf('/')) : '';
              if (parentPath) {
                nav.setCurrentFolderId(`server-${category}-${parentPath}`);
                fileSystem.loadServerFolders(category, parentPath);
              } else {
                nav.setCurrentFolderId(null);
                fileSystem.loadServerFolders(category, '');
              }
            }
          }} />
        ) : (
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 md:px-6 lg:px-10 pb-6 sm:pb-8 md:pb-12 pt-5 md:pt-8 scroll-smooth custom-scrollbar">
            <div className="max-w-[1600px] mx-auto min-h-fit md:min-h-full pb-8 sm:pb-12 md:pb-20 w-full">
              {nav.activeTab === 'system' ? (
                <SystemView />
              ) : nav.activeTab === 'usb' ? (
                <RemovableStorageView onMountedDeviceOpen={(dev) => { layout.setMountedDevice(dev); nav.setActiveTab('drive'); }} />
              ) : nav.activeTab === 'drive' && layout.mountedDevice ? (
                <MountedDeviceView device={layout.mountedDevice} onFileSelect={(file: any) => nav.setSelectedFile(file)} selectedFile={nav.selectedFile} />
              ) : nav.activeTab === 'drive' ? (
                <div className="flex items-center justify-center py-20 text-gray-400"><p className="text-sm font-bold">No device mounted</p></div>
              ) : nav.activeTab === 'sessions' ? (
                <SessionsView onNavigate={nav.setActiveTab} />
              ) : nav.activeTab === 'settings' ? (
                <AccountSettingsView
                  selectedModel={layout.selectedModel}
                  onModelChange={layout.handleModelChange}
                  onNavigate={nav.setActiveTab}
                  user={auth.currentUser}
                  onUserUpdate={auth.setCurrentUser}
                  onDeleteAccount={handleDeleteAccount}
                />
              ) : nav.activeTab === 'security' ? (
                <SecurityVaultView
                  onAutoLockChange={(enabled, timeout, pin) => { screenLock.setAutoLockEnabled(enabled); screenLock.setAutoLockTimeout(timeout); screenLock.setAutoLockPin(pin); }}
                  onFolderLockChange={(_enabled, lockedFolders, pin) => { folderLock.setLockedFolders(lockedFolders); folderLock.setFolderLockPin(pin); }}
                />
              ) : nav.activeTab === 'notifications' ? (
                <NotificationsView />
              ) : nav.activeTab === 'appearance' ? (
                <AppearanceView showToast={layout.showToast}
                  onSettingsChange={(s) => { upload.setPdfThumbnails(s.pdfThumbnails); upload.setVideoThumbnails(s.videoThumbnails); upload.setAiAutoRename(s.aiAutoRename); }} />
              ) : nav.activeTab === 'aimodels' ? (
                <AIModelsView showToast={layout.showToast} />
              ) : nav.activeTab === 'apikeys' ? (
                <APIKeysView showToast={layout.showToast} />
              ) : nav.activeTab === 'aisecurity' ? (
                <AISecurityView showToast={layout.showToast} />
              ) : nav.activeTab === 'myapps' ? (
                <MyAppsView />
              ) : nav.activeTab === 'mytasks' ? (
                <MyTasksView showToast={layout.showToast} onOpenChat={() => { nav.setActiveTab('chat'); nav.handleNavigate(null); }} />
              ) : nav.activeTab === 'activity' ? (
                <ActivityLogView />
              ) : nav.activeTab === 'export' ? (
                <ExportDataView />
              ) : nav.activeTab === 'domain' ? (
                <DomainSetupView showToast={layout.showToast} />
              ) : nav.activeTab === 'planbilling' ? (
                <PlanBillingView showToast={layout.showToast} />
              ) : nav.activeTab === 'family' ? (
                <FamilySharingView showToast={layout.showToast} />
              ) : nav.activeTab === 'help' ? (
                <HelpSupportView user={auth.currentUser} />
              ) : nav.activeTab === 'trash' ? (
                <TrashView />
              ) : nav.activeTab === 'database' ? (
                <DatabaseView />
              ) : nav.activeTab === 'shared' ? (
                <SharedView showToast={layout.showToast} />
              ) : nav.activeTab === 'updates' ? (
                <UpdateView />
              ) : nav.activeTab === 'manage-storage' ? (
                <ManageStorageView isFamilyMember={auth.currentUser?.isFamilyMember === true} />
              ) : (
                <FilesView
                  activeTab={nav.activeTab}
                  showBanner={layout.showBanner}
                  setShowBanner={layout.setShowBanner}
                  setActiveTab={nav.setActiveTab}
                  currentFolderId={nav.currentFolderId}
                  showFileControls={showFileControls}
                  showNewFolder={showNewFolder}
                  createFolder={fileOps.createFolder}
                  viewMode={fileSystem.viewMode}
                  setViewMode={fileSystem.setViewMode}
                  sortBy={fileSystem.sortBy}
                  setSortBy={fileSystem.setSortBy}
                  filteredFolders={fileSystem.filteredFolders}
                  filteredFilesOnly={fileSystem.filteredFilesOnly}
                  files={fileSystem.files}
                  handleFileClick={fileOps.handleFileClick}
                  handleFileAction={fileOps.handleFileAction}
                  selectedFile={nav.selectedFile}
                  onGoBack={() => nav.handleGoBack(fileSystem.loadServerFolders)}
                  pdfThumbnails={upload.pdfThumbnails}
                  videoThumbnails={upload.videoThumbnails}
                  aiRenamedSet={upload.aiRenamedSet}
                  onFileDrop={fileOps.handleFileDrop}
                  isFolderLocked={fileOps.isFolderLocked}
                  onBulkAction={fileOps.handleBulkFileAction}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {showFileControls && nav.selectedFile && (
        <>
          <div onMouseDown={layout.startResizing} className={`w-px h-full cursor-col-resize hover:bg-[#5D5FEF]/30 transition-colors z-20 ${layout.isResizing ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`} />
          <div className="flex-shrink-0 h-full overflow-hidden" style={{ width: layout.detailsWidth }}>
            <FileDetails
              file={nav.selectedFile}
              onClose={() => nav.setSelectedFile(null)}
              onDelete={fileOps.handleDelete}
              onFileRenamed={() => {
                if (fileSystem.category) fileSystem.loadServerFolders(fileSystem.category, fileSystem.currentPath);
                fileSystem.loadRecentFiles();
                upload.loadAiRenamedFiles();
              }}
              onPlayInGlobalPlayer={(f) => setNowPlaying(f)}
            />
          </div>
        </>
      )}

      <InstallPrompt />

      {!layout.isMobile && nowPlaying && nowPlaying.url && (nowPlaying.type === 'audio' || /\.(mp3|wav|flac|aac|ogg|m4a|wma|opus|aiff)$/i.test(nowPlaying.name)) && (
        <GlobalMusicPlayer file={nowPlaying} onClose={() => setNowPlaying(null)} />
      )}

      <UploadProgress
        files={upload.uploadProgress}
        visible={upload.uploadProgressVisible}
        onDismiss={() => { upload.setUploadProgressVisible(false); upload.setUploadProgress([]); }}
      />

      {layout.toast && <Toast toast={layout.toast} onDismiss={() => layout.setToast(null)} position="bottom-right" />}

      <ConfirmModal
        isOpen={fileOps.confirmModal.isOpen}
        title={fileOps.confirmModal.title}
        message={fileOps.confirmModal.message}
        confirmText={fileOps.confirmModal.confirmText}
        variant={fileOps.confirmModal.variant}
        onConfirm={fileOps.confirmModal.onConfirm}
        onCancel={() => {
          if ((window as any).__tempCancelHandler) {
            (window as any).__tempCancelHandler();
            delete (window as any).__tempCancelHandler;
          } else {
            fileOps.setConfirmModal(prev => ({ ...prev, isOpen: false }));
          }
        }}
      />

      {/* New Folder Modal */}
      {fileOps.newFolderModal.isOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[600] animate-in fade-in duration-200"
            onClick={() => fileOps.setNewFolderModal({ isOpen: false, folderName: '', error: null })} />
          <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-gradient-to-r from-[#5D5FEF]/10 to-[#5D5FEF]/5 px-6 py-5 border-b border-gray-100">
                <h3 className="text-lg font-black text-gray-900">Create New Folder</h3>
                <p className="text-xs text-gray-500 mt-1">Enter a name for your new folder</p>
              </div>
              <div className="p-6">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-2 block">Folder Name</label>
                <input type="text" autoFocus value={fileOps.newFolderModal.folderName}
                  onChange={(e) => fileOps.setNewFolderModal(prev => ({ ...prev, folderName: e.target.value, error: null }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') fileOps.handleCreateFolderSubmit(); if (e.key === 'Escape') fileOps.setNewFolderModal({ isOpen: false, folderName: '', error: null }); }}
                  placeholder="My Folder"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm font-medium" />
                {fileOps.newFolderModal.error && <p className="text-xs text-red-500 mt-2 font-medium">{fileOps.newFolderModal.error}</p>}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
                <button onClick={() => fileOps.setNewFolderModal({ isOpen: false, folderName: '', error: null })}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all">Cancel</button>
                <button onClick={fileOps.handleCreateFolderSubmit} disabled={!fileOps.newFolderModal.folderName.trim()}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all disabled:opacity-50 disabled:cursor-not-allowed">Create</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rename Modal */}
      {fileOps.renameModal.isOpen && fileOps.renameModal.file && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[600] animate-in fade-in duration-200"
            onClick={() => fileOps.setRenameModal({ isOpen: false, file: null, newName: '', error: null })} />
          <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-gradient-to-r from-[#5D5FEF]/10 to-[#5D5FEF]/5 px-6 py-5 border-b border-gray-100">
                <h3 className="text-lg font-black text-gray-900">Rename</h3>
                <p className="text-xs text-gray-500 mt-1">Enter a new name for <span className="font-bold text-gray-700">{fileOps.renameModal.file.name}</span></p>
              </div>
              <div className="p-6">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-2 block">New Name</label>
                <input type="text" autoFocus value={fileOps.renameModal.newName}
                  onChange={(e) => fileOps.setRenameModal(prev => ({ ...prev, newName: e.target.value, error: null }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') fileOps.handleRenameSubmit(); if (e.key === 'Escape') fileOps.setRenameModal({ isOpen: false, file: null, newName: '', error: null }); }}
                  onFocus={(e) => { const val = e.target.value; const dotIdx = val.lastIndexOf('.'); if (dotIdx > 0 && !fileOps.renameModal.file?.isFolder) { e.target.setSelectionRange(0, dotIdx); } else { e.target.select(); } }}
                  placeholder="New name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm font-medium" />
                {fileOps.renameModal.error && <p className="text-xs text-red-500 mt-2 font-medium">{fileOps.renameModal.error}</p>}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
                <button onClick={() => fileOps.setRenameModal({ isOpen: false, file: null, newName: '', error: null })}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all">Cancel</button>
                <button onClick={fileOps.handleRenameSubmit} disabled={!fileOps.renameModal.newName.trim() || fileOps.renameModal.newName.trim() === fileOps.renameModal.file?.name}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all disabled:opacity-50 disabled:cursor-not-allowed">Rename</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Folder Lock PIN Prompt */}
      {folderLock.folderLockPrompt.show && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[600] animate-in fade-in duration-200"
            onClick={() => folderLock.setFolderLockPrompt({ show: false, folderPath: '', folderId: '' })} />
          <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-8">
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-2">Folder Locked</h3>
                <p className="text-xs text-gray-400">Enter your 6-digit PIN to access <strong>{folderLock.folderLockPrompt.folderPath}</strong></p>
              </div>
              {folderLock.folderLockoutUntil && folderLock.folderLockoutUntil > Date.now() ? (
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
                      <p className="text-red-800 text-lg font-black font-mono tracking-wider">{folderLock.folderLockCountdown}</p>
                      <p className="text-red-500 text-[10px] font-semibold mt-0.5">Try again after countdown</p>
                    </div>
                  </div>
                  <button onClick={() => folderLock.setFolderLockPrompt({ show: false, folderPath: '', folderId: '' })}
                    className="w-full mt-3 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all">Close</button>
                </div>
              ) : (
                <>
                  <input type="password" inputMode="numeric" maxLength={6} value={folderLock.folderLockInput}
                    onChange={(e) => { folderLock.setFolderLockInput(e.target.value.replace(/\D/g, '').slice(0, 6)); if (folderLock.folderLockError && !folderLock.folderLockError.startsWith('Incorrect PIN')) folderLock.setFolderLockError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && folderLock.folderLockInput.length === 6 && folderLock.handleFolderLockPinSubmit()}
                    placeholder="••••••"
                    className="w-full px-4 py-3 bg-[#F5F5F7] rounded-xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-center text-lg font-black tracking-[0.3em] outline-none mb-4 placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-sm"
                    autoFocus />
                  {folderLock.folderLockAttempts > 0 && folderLock.folderLockAttempts < 4 && (
                    <div className="flex items-center justify-center gap-1.5 mb-3">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-2 h-2 rounded-full transition-all ${i < folderLock.folderLockAttempts ? 'bg-red-400 scale-110' : 'bg-gray-200'}`} />
                      ))}
                      <span className="ml-2 text-[10px] font-bold text-gray-400">{folderLock.folderLockAttempts}/4</span>
                    </div>
                  )}
                  {folderLock.folderLockError && (
                    <div className={`rounded-xl p-3 mb-4 flex items-center gap-2 ${folderLock.folderLockAttempts >= 3 ? 'bg-orange-50 border border-orange-200' : 'bg-red-50 border border-red-100'}`}>
                      <p className={`text-xs font-bold ${folderLock.folderLockAttempts >= 3 ? 'text-orange-600' : 'text-red-600'}`}>{folderLock.folderLockError}</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => folderLock.setFolderLockPrompt({ show: false, folderPath: '', folderId: '' })}
                      className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all">Cancel</button>
                    <button onClick={folderLock.handleFolderLockPinSubmit} disabled={folderLock.folderLockInput.length !== 6}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all disabled:opacity-50 disabled:cursor-not-allowed">Unlock</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Share Dialog */}
      <ShareDialog
        isOpen={fileOps.shareModal.isOpen}
        file={fileOps.shareModal.file}
        onClose={() => fileOps.setShareModal({ isOpen: false, file: null })}
        onSuccess={(msg) => layout.showToast(msg, 'success')}
        onError={(msg) => layout.showToast(msg, 'error')}
      />
    </div>
  );
};

export default App;
