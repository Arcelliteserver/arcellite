import React from 'react';
import {
  LayoutDashboard,
  Trash2,
  Users,
  Image,
  FolderOpen,
  Sparkles,
  Film,
  Database,
  Music,
} from 'lucide-react';

interface NavItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface SidebarNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems: NavItem[] = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
  { id: 'all', icon: FolderOpen, label: 'Files' },
  { id: 'photos', icon: Image, label: 'Photos' },
  { id: 'videos', icon: Film, label: 'Videos' },
  { id: 'shared', icon: Users, label: 'Shared' },
  { id: 'music', icon: Music, label: 'Music' },
  { id: 'chat', icon: Sparkles, label: 'AI Chat' },
  { id: 'database', icon: Database, label: 'Database' },
  { id: 'trash', icon: Trash2, label: 'Trash' },
];

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="sidebar-nav flex-1 px-3 sm:px-3 md:px-4 space-y-1 overflow-y-auto">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex items-center gap-2 sm:gap-3 md:gap-4 w-full px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 md:py-3.5 rounded-xl transition-all relative group text-left justify-start ${
              activeTab === item.id 
                ? 'bg-[#5D5FEF]/10 text-[#5D5FEF] font-bold' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            {activeTab === item.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#5D5FEF] rounded-r-full" />
            )}
            <div className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 flex items-center justify-center flex-shrink-0">
              <Icon className={`w-full h-full transition-colors ${activeTab === item.id ? 'text-[#5D5FEF]' : 'text-gray-400 group-hover:text-gray-600'}`} />
            </div>
            <span className="text-sm sm:text-[15px] md:text-[15px] whitespace-nowrap text-left">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default SidebarNavigation;

