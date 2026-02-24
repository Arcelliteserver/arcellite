import React from 'react';
import SidebarHeader from './SidebarHeader';
import SidebarActions from './SidebarActions';
import SidebarNavigation from './SidebarNavigation';
import StorageWidget from './StorageWidget';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onUpload: (files: File[]) => void;
  onSidebarDrop?: (tabId: string, file: any) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isFamilyMember?: boolean;
  isSuspended?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onUpload,
  onSidebarDrop,
  collapsed,
  onToggleCollapse,
  isFamilyMember,
  isSuspended,
}) => {
  return (
    <nav
      aria-label="Main navigation"
      className="font-sidebar h-full bg-[#111214] flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden"
      style={{ width: collapsed ? '68px' : '240px' }}
    >
      <SidebarHeader
        onLogoClick={() => setActiveTab('overview')}
        onToggleCollapse={onToggleCollapse}
        collapsed={collapsed}
      />
      <SidebarActions
        activeTab={activeTab}
        onUpload={onUpload}
        isFamilyMember={isFamilyMember}
        collapsed={collapsed}
      />
      <SidebarNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSidebarDrop={onSidebarDrop}
        isFamilyMember={isFamilyMember}
        collapsed={collapsed}
      />
      <StorageWidget
        activeTab={activeTab}
        onManageServer={() => setActiveTab('system')}
        onManageStorage={() => setActiveTab('manage-storage')}
        onUsbClick={() => setActiveTab('usb')}
        isFamilyMember={isFamilyMember}
        isSuspended={isSuspended}
        collapsed={collapsed}
      />
    </nav>
  );
};

export default Sidebar;
