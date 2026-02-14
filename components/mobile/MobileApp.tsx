import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import MobileBottomNav, { MobileTab } from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import MobileOverview from './MobileOverview';
import MobileFiles from './MobileFiles';
import MobileChat from './MobileChat';
import MobileMore from './MobileMore';
import MobileFileViewer from './MobileFileViewer';
import { FileItem } from '../../types';

// Reuse desktop views for sub-pages navigated from "More"
import StatsView from '../views/system/StatsView';
import ServerView from '../views/system/ServerView';
import SystemLogsView from '../views/system/SystemLogsView';
import RemovableStorageView from '../views/system/RemovableStorageView';
import MountedDeviceView from '../views/system/MountedDeviceView';
import SecurityVaultView from '../views/system/SecurityVaultView';
import ActivityLogView from '../views/system/ActivityLogView';
import ExportDataView from '../views/system/ExportDataView';
import DatabaseView from '../views/system/DatabaseView';
import TrashView from '../views/system/TrashView';
import SharedView from '../views/files/SharedView';
import AccountSettingsView from '../views/settings/AccountSettingsView';
import AppearanceView from '../views/settings/AppearanceView';
import APIKeysView from '../views/settings/APIKeysView';
import AISecurityView from '../views/settings/AISecurityView';
import NotificationsView from '../views/settings/NotificationsView';
import HelpSupportView from '../views/features/HelpSupportView';
import MyAppsView from '../views/features/MyAppsView';

export interface MobileAppProps {
  // User
  user: any;
  onUserUpdate: (user: any) => void;
  onSignOut: () => void;

  // Files state
  files: FileItem[];
  recentItems: FileItem[];
  currentFolderId: string | null;
  selectedFile: FileItem | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;

  // File operations
  onFileClick: (file: FileItem) => void;
  onFileAction: (action: string, file: FileItem, targetFolder?: FileItem) => void;
  onGoBack: () => void;
  onNavigate: (id: string | null) => void;
  onCreateFolder: () => void;
  onUpload: (files: File[]) => void;

  // Filtered data
  filteredFolders: FileItem[];
  filteredFilesOnly: FileItem[];

  // AI
  selectedModel: string;
  onModelChange: (model: string) => void;

  // Smart features
  pdfThumbnails: boolean;
  aiRenamedSet: Set<string>;

  // Callbacks
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefreshFiles: () => void;
  onNavigateToFile: (category: string, itemPath: string, isFolder: boolean) => void;

  // Settings callbacks
  onSettingsChange: (s: { pdfThumbnails: boolean; aiAutoRename: boolean }) => void;
  onDeleteAccount: () => void;

  // Mounted device
  mountedDevice: any;
  onMountedDeviceOpen: (dev: any) => void;

  // File viewer
  onDeselectFile: () => void;
  onDelete: (file: FileItem) => void;
}

const MobileApp: React.FC<MobileAppProps> = (props) => {
  const {
    user,
    onUserUpdate,
    onSignOut,
    files,
    recentItems,
    currentFolderId,
    selectedFile,
    searchQuery,
    onSearchChange,
    activeTab,
    onTabChange,
    onFileClick,
    onFileAction,
    onGoBack,
    onNavigate,
    onCreateFolder,
    onUpload,
    filteredFolders,
    filteredFilesOnly,
    selectedModel,
    onModelChange,
    pdfThumbnails,
    aiRenamedSet,
    showToast,
    onRefreshFiles,
    onNavigateToFile,
    onSettingsChange,
    onDeleteAccount,
    mountedDevice,
    onMountedDeviceOpen,
    onDeselectFile,
    onDelete,
  } = props;

  // Mobile tab state — maps to bottom nav
  const [mobileTab, setMobileTab] = useState<MobileTab>('overview');
  // Sub-page within "More" (reuses desktop views)
  const [subPage, setSubPage] = useState<string | null>(null);

  // Determine the header title
  const headerTitle = useMemo(() => {
    if (subPage) {
      const titles: Record<string, string> = {
        shared: 'Shared Files',
        database: 'Databases',
        trash: 'Trash',
        stats: 'Statistics',
        server: 'Server',
        logs: 'System Logs',
        usb: 'USB Devices',
        activity: 'Activity',
        settings: 'Settings',
        security: 'Security Vault',
        notifications: 'Notifications',
        appearance: 'Appearance',
        apikeys: 'API Keys',
        aisecurity: 'AI Security',
        export: 'Export Data',
        help: 'Help & Support',
        myapps: 'My Apps',
        drive: 'Device',
      };
      return titles[subPage] || subPage;
    }
    switch (mobileTab) {
      case 'overview': return 'Arcellite';
      case 'files': return 'Files';
      case 'chat': return 'AI Chat';
      case 'photos': return 'Gallery';
      case 'settings': return 'Settings';
      default: return 'Arcellite';
    }
  }, [mobileTab, subPage]);

  // Navigate from more menu to sub-pages
  const handleMoreNavigate = useCallback((tab: string) => {
    // Some tabs map to files categories
    if (['all', 'photos', 'videos', 'music'].includes(tab)) {
      // Switch to files tab with the right category
      onTabChange(tab);
      setMobileTab('files');
      setSubPage(null);
      return;
    }
    if (tab === 'chat') {
      setMobileTab('chat');
      setSubPage(null);
      return;
    }
    // Everything else opens as a sub-page within mobile
    setSubPage(tab);
    onTabChange(tab);
  }, [onTabChange]);

  // Persistent hidden file input ref (prevents mobile GC from dropping it)
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle file upload trigger
  const handleUploadTrigger = useCallback(() => {
    // Reuse existing hidden input or create one in the DOM
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.top = '-9999px';
      input.style.opacity = '0';
      document.body.appendChild(input);
      fileInputRef.current = input;
    }
    const input = fileInputRef.current;
    // Reset value so same file can be re-selected
    input.value = '';
    input.onchange = () => {
      const fileList = input.files;
      if (fileList && fileList.length > 0) {
        onUpload(Array.from(fileList));
      }
    };
    input.click();
  }, [onUpload]);

  // Cleanup hidden input on unmount
  useEffect(() => {
    return () => {
      if (fileInputRef.current && fileInputRef.current.parentNode) {
        fileInputRef.current.parentNode.removeChild(fileInputRef.current);
      }
    };
  }, []);

  // Handle bottom nav changes
  const handleBottomTabChange = useCallback((tab: MobileTab) => {
    setMobileTab(tab);
    setSubPage(null);
    if (tab === 'overview') {
      onTabChange('overview');
    } else if (tab === 'files') {
      // Default to 'all' files when switching to files tab
      if (!['all', 'photos', 'videos', 'music'].includes(activeTab)) {
        onTabChange('all');
      }
    } else if (tab === 'chat') {
      onTabChange('chat');
    } else if (tab === 'photos') {
      onTabChange('photos');
    } else if (tab === 'settings') {
      onTabChange('settings');
    }
  }, [onTabChange, activeTab]);

  // Handle back from sub-page
  const handleBackFromSubPage = useCallback(() => {
    setSubPage(null);
    setMobileTab('settings');
  }, []);

  // Profile click → go to settings
  const handleProfileClick = useCallback(() => {
    setSubPage('settings');
    onTabChange('settings');
  }, [onTabChange]);

  // Notifications click → go to notifications  
  const handleNotificationsClick = useCallback(() => {
    setSubPage('notifications');
    onTabChange('notifications');
  }, [onTabChange]);

  // Navigate from overview quick actions
  const handleOverviewNavigate = useCallback((tab: string) => {
    if (['all', 'photos', 'videos', 'music'].includes(tab)) {
      onTabChange(tab);
      setMobileTab('files');
      setSubPage(null);
    } else {
      handleMoreNavigate(tab);
    }
  }, [onTabChange, handleMoreNavigate]);

  // Determine if chat view needs special full-height layout
  const isChatView = mobileTab === 'chat' && !subPage;

  // Show search only for files and overview tabs
  const showSearch = (mobileTab === 'files' || mobileTab === 'overview') && !subPage;

  // Handle back from chat
  const handleChatBack = useCallback(() => {
    setMobileTab('overview');
    onTabChange('overview');
  }, [onTabChange]);

  // If chat is active, render full-screen chat without bottom nav
  if (isChatView) {
    return (
      <MobileChat
        selectedModel={selectedModel}
        user={user}
        onRefreshFiles={onRefreshFiles}
        onNavigateToDatabase={() => handleMoreNavigate('database')}
        onNavigateToFile={onNavigateToFile}
        onBack={handleChatBack}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50/50 text-[#1d1d1f] antialiased overflow-hidden">
      {/* Header */}
      <MobileHeader
        title={headerTitle}
        user={user}
        onProfileClick={handleProfileClick}
        onNotificationsClick={handleNotificationsClick}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        showSearch={showSearch}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 pb-[100px] scroll-smooth custom-scrollbar">
        {subPage ? (
          /* Sub-page from "More" menu — reuse desktop views */
          <div className="px-4 py-4">
            {/* Back button */}
            <button
              onClick={handleBackFromSubPage}
              className="flex items-center gap-1.5 px-3 py-2 mb-4 bg-white text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-100 active:scale-95 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            
            {/* Render the appropriate desktop view */}
            {subPage === 'stats' && <StatsView />}
            {subPage === 'server' && <ServerView onNavigateToLogs={() => { setSubPage('logs'); onTabChange('logs'); }} />}
            {subPage === 'logs' && <SystemLogsView />}
            {subPage === 'usb' && (
              <RemovableStorageView
                onMountedDeviceOpen={(dev: any) => {
                  onMountedDeviceOpen(dev);
                  setSubPage('drive');
                  onTabChange('drive');
                }}
              />
            )}
            {subPage === 'drive' && mountedDevice && (
              <MountedDeviceView device={mountedDevice} onFileSelect={() => {}} selectedFile={null} />
            )}
            {subPage === 'settings' && (
              <AccountSettingsView
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                onNavigate={(tab: string) => { setSubPage(tab); onTabChange(tab); }}
                user={user}
                onUserUpdate={onUserUpdate}
                onDeleteAccount={onDeleteAccount}
              />
            )}
            {subPage === 'security' && <SecurityVaultView />}
            {subPage === 'notifications' && <NotificationsView />}
            {subPage === 'appearance' && (
              <AppearanceView showToast={showToast} onSettingsChange={onSettingsChange} />
            )}
            {subPage === 'apikeys' && <APIKeysView showToast={showToast} />}
            {subPage === 'aisecurity' && <AISecurityView showToast={showToast} />}
            {subPage === 'activity' && <ActivityLogView />}
            {subPage === 'export' && <ExportDataView />}
            {subPage === 'help' && <HelpSupportView user={user} />}
            {subPage === 'myapps' && <MyAppsView />}
            {subPage === 'trash' && <TrashView />}
            {subPage === 'database' && <DatabaseView />}
            {subPage === 'shared' && <SharedView showToast={showToast} />}
          </div>
        ) : mobileTab === 'overview' ? (
          <div className="px-4 py-4">
            <MobileOverview
              user={user}
              recentItems={recentItems}
              files={files}
              onFileClick={onFileClick}
              onFileAction={onFileAction}
              onNavigateTab={handleOverviewNavigate}
              onUpload={handleUploadTrigger}
              pdfThumbnails={pdfThumbnails}
              aiRenamedSet={aiRenamedSet}
            />
          </div>
        ) : mobileTab === 'files' ? (
          <div className="px-4 py-4">
            <MobileFiles
              activeCategory={activeTab}
              currentFolderId={currentFolderId}
              filteredFolders={filteredFolders}
              filteredFiles={filteredFilesOnly}
              files={files}
              onFileClick={onFileClick}
              onFileAction={onFileAction}
              selectedFile={selectedFile}
              onGoBack={onGoBack}
              onCreateFolder={onCreateFolder}
              pdfThumbnails={pdfThumbnails}
              aiRenamedSet={aiRenamedSet}
            />
          </div>
        ) : mobileTab === 'photos' ? (
          <div className="px-4 py-4">
            <MobileFiles
              activeCategory="photos"
              currentFolderId={currentFolderId}
              filteredFolders={filteredFolders}
              filteredFiles={filteredFilesOnly}
              files={files}
              onFileClick={onFileClick}
              onFileAction={onFileAction}
              selectedFile={selectedFile}
              onGoBack={onGoBack}
              onCreateFolder={onCreateFolder}
              pdfThumbnails={pdfThumbnails}
              aiRenamedSet={aiRenamedSet}
            />
          </div>
        ) : mobileTab === 'settings' ? (
          <div className="px-4 py-4">
            <MobileMore
              onNavigate={handleMoreNavigate}
              user={user}
            />
          </div>
        ) : null}
      </main>

      {/* Bottom Navigation */}
      <MobileBottomNav
        activeTab={mobileTab}
        onTabChange={handleBottomTabChange}
      />

      {/* Mobile File Viewer Overlay */}
      {selectedFile && !selectedFile.isFolder && (
        <MobileFileViewer
          file={selectedFile}
          files={filteredFilesOnly}
          onClose={onDeselectFile}
          onDelete={onDelete}
          onFileChange={(f) => onFileClick(f)}
        />
      )}
    </div>
  );
};

export default MobileApp;
