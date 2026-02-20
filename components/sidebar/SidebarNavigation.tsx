import React, { useState, useEffect } from 'react';
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
  droppable?: boolean; // Can receive dropped files
}

// Admin-only tabs hidden from family member accounts
const FAMILY_HIDDEN_TABS = new Set(['database', 'stats', 'server', 'activity', 'security-vault', 'export']);

interface SidebarNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSidebarDrop?: (tabId: string, file: any) => void;
  isFamilyMember?: boolean;
}

const navItems: NavItem[] = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
  { id: 'all', icon: FolderOpen, label: 'Files', droppable: true },
  { id: 'photos', icon: Image, label: 'Photos', droppable: true },
  { id: 'videos', icon: Film, label: 'Videos', droppable: true },
  { id: 'shared', icon: Users, label: 'Shared' },
  { id: 'music', icon: Music, label: 'Music', droppable: true },
  { id: 'chat', icon: Sparkles, label: 'AI Chat' },
  { id: 'database', icon: Database, label: 'Database' },
  { id: 'trash', icon: Trash2, label: 'Trash' },
];

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({ activeTab, onTabChange, onSidebarDrop, isFamilyMember }) => {
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [shareCount, setShareCount] = useState(0);
  const visibleNavItems = isFamilyMember ? navItems.filter(item => !FAMILY_HIDDEN_TABS.has(item.id)) : navItems;

  useEffect(() => {
    const fetchShareCount = async () => {
      try {
        const token = localStorage.getItem('sessionToken');
        if (!token) return;
        const resp = await fetch('/api/share/count', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          setShareCount(data.count || 0);
        }
      } catch { /* ignore */ }
    };
    fetchShareCount();
    const interval = setInterval(fetchShareCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDragOver = (e: React.DragEvent, item: NavItem) => {
    if (!item.droppable) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTab(item.id);
  };

  const handleDragLeave = () => {
    setDragOverTab(null);
  };

  const handleDrop = (e: React.DragEvent, item: NavItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTab(null);
    if (!item.droppable || !onSidebarDrop) return;
    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const file = JSON.parse(data);
      onSidebarDrop(item.id, file);
    } catch {}
  };

  return (
    <nav className="sidebar-nav flex-1 px-3 sm:px-3 md:px-4 space-y-0.5 overflow-y-auto">
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const isDragOver = dragOverTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            onDragOver={(e) => handleDragOver(e, item)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item)}
            className={`flex items-center gap-2 sm:gap-3 md:gap-3.5 w-full px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-2.5 rounded-xl transition-all relative group text-left justify-start ${
              isDragOver
                ? 'bg-[#5D5FEF]/15 text-[#5D5FEF] font-bold ring-2 ring-[#5D5FEF] ring-offset-1 scale-[1.02]'
                : activeTab === item.id 
                ? 'bg-[#5D5FEF]/10 text-[#5D5FEF] font-bold' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            {activeTab === item.id && !isDragOver && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#5D5FEF] rounded-r-full" />
            )}
            {isDragOver && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[#5D5FEF] rounded-r-full animate-pulse" />
            )}
            <div className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 flex items-center justify-center flex-shrink-0">
              <Icon className={`w-full h-full transition-colors ${isDragOver ? 'text-[#5D5FEF]' : activeTab === item.id ? 'text-[#5D5FEF]' : 'text-gray-400 group-hover:text-gray-600'}`} />
            </div>
            <span className="text-sm sm:text-[15px] md:text-[15px] whitespace-nowrap text-left">{item.label}</span>
            {item.id === 'shared' && shareCount > 0 && !isDragOver && (
              <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-[#5D5FEF] text-white text-[10px] font-black leading-none">
                {shareCount > 99 ? '99+' : shareCount}
              </span>
            )}
            {isDragOver && (
              <span className="ml-auto text-[8px] font-black uppercase tracking-wider text-[#5D5FEF] bg-[#5D5FEF]/10 px-1.5 py-0.5 rounded-md animate-pulse">
                Drop here
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default SidebarNavigation;

