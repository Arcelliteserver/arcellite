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

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onUpload, onSidebarDrop, collapsed, onToggleCollapse, isFamilyMember, isSuspended }) => {
  return (
    <nav aria-label="Main navigation" className="w-64 h-full bg-white flex flex-col border-r border-gray-100 flex-shrink-0 transition-all duration-300 shadow-lg md:shadow-none overflow-hidden">
      <SidebarHeader onLogoClick={() => setActiveTab('overview')} onToggleCollapse={onToggleCollapse} />
      <SidebarActions
        activeTab={activeTab}
        onUpload={onUpload}
        onStatsClick={() => setActiveTab('stats')}
        isFamilyMember={isFamilyMember}
      />
      <SidebarNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSidebarDrop={onSidebarDrop}
        isFamilyMember={isFamilyMember}
      />
      <StorageWidget
        activeTab={activeTab}
        onManageServer={() => setActiveTab('server')}
        onManageStorage={() => setActiveTab('manage-storage')}
        onUsbClick={() => setActiveTab('usb')}
        isFamilyMember={isFamilyMember}
        isSuspended={isSuspended}
      />
    </nav>
  );
};

export default Sidebar;

