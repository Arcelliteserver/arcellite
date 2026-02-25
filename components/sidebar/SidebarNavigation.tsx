import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Server,
  LayoutGrid,
  Trash2,
  Users,
  UsersRound,
  Image,
  FolderOpen,
  Sparkles,
  Film,
  Database,
  Music,
  ChevronDown,
  HelpCircle,
  BookOpen,
} from 'lucide-react';

interface NavItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  droppable?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Tabs hidden from family member accounts
const FAMILY_HIDDEN_TABS = new Set([
  'system', 'myapps', 'database', 'family',
]);

interface SidebarNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSidebarDrop?: (tabId: string, file: any) => void;
  isFamilyMember?: boolean;
  collapsed?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: 'Primary',
    items: [
      { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
      { id: 'myapps', icon: LayoutGrid, label: 'Integration' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'system', icon: Server, label: 'System' },
    ],
  },
  {
    label: 'Data',
    items: [
      { id: 'all', icon: FolderOpen, label: 'Files', droppable: true },
      { id: 'photos', icon: Image, label: 'Photos', droppable: true },
      { id: 'videos', icon: Film, label: 'Videos', droppable: true },
      { id: 'music', icon: Music, label: 'Music', droppable: true },
      { id: 'shared', icon: Users, label: 'Shared' },
      { id: 'trash', icon: Trash2, label: 'Trash' },
      { id: 'database', icon: Database, label: 'Database' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'chat', icon: Sparkles, label: 'Arcellite Chat' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { id: 'family', icon: UsersRound, label: 'Users & Family' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { id: 'documentation', icon: BookOpen, label: 'Documentation' },
      { id: 'help', icon: HelpCircle, label: 'Help & Support' },
    ],
  },
];

function groupOf(tabId: string): string {
  for (const g of navGroups) {
    if (g.items.some(i => i.id === tabId)) return g.label;
  }
  return navGroups[0].label;
}

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  activeTab,
  onTabChange,
  onSidebarDrop,
  isFamilyMember,
  collapsed,
}) => {
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [shareCount, setShareCount] = useState(0);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(['Primary', 'Data', 'Intelligence', 'Governance'])
  );

  useEffect(() => {
    const owner = groupOf(activeTab);
    setOpenGroups(prev => {
      if (prev.has(owner)) return prev;
      const next = new Set(prev);
      next.add(owner);
      return next;
    });
  }, [activeTab]);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

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

  const handleDragLeave = () => setDragOverTab(null);

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

  const visibleGroups = navGroups.map(group => ({
    ...group,
    items: isFamilyMember
      ? group.items.filter(item => !FAMILY_HIDDEN_TABS.has(item.id))
      : group.items,
  })).filter(group => group.items.length > 0);

  return (
    <nav
      className="flex-1 overflow-y-auto overflow-x-hidden pb-2"
      style={{ scrollbarWidth: 'none' }}
    >
      {visibleGroups.map((group) => {
        const isOpen = openGroups.has(group.label);

        return (
          <div key={group.label} className="mb-1">
            {/* Group header — hidden in collapsed mode */}
            {!collapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="flex items-center justify-between w-full px-4 py-1.5 select-none group/header"
              >
                <span className="font-heading text-[9px] font-bold uppercase tracking-[0.12em] text-gray-600">
                  {group.label}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-gray-700 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                />
              </button>
            )}

            {/* Items */}
            <div
              className="overflow-hidden transition-all duration-200 ease-in-out"
              style={{
                maxHeight: collapsed ? '9999px' : isOpen ? '600px' : '0px',
                opacity: collapsed ? 1 : isOpen ? 1 : 0,
              }}
            >
              <div className={`space-y-0.5 ${collapsed ? 'px-2.5 py-0.5' : 'px-2 pb-1'}`}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isDragOver = dragOverTab === item.id;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      onDragOver={(e) => handleDragOver(e, item)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, item)}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center w-full rounded-xl transition-all relative group text-left
                        ${collapsed
                          ? 'justify-center w-9 h-9 mx-auto'
                          : 'gap-3 px-3 py-[7px] min-h-[34px]'
                        }
                        ${isDragOver
                          ? 'bg-[#5D5FEF]/20 ring-1 ring-[#5D5FEF]/40'
                          : isActive
                            ? 'bg-white/[0.08]'
                            : 'hover:bg-white/[0.05]'
                        }
                      `}
                    >
                      {/* Active left bar */}
                      {isActive && !isDragOver && !collapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[#5D5FEF] rounded-r-full" />
                      )}

                      {/* Icon */}
                      <div className={`flex items-center justify-center flex-shrink-0 ${collapsed ? 'w-[18px] h-[18px]' : 'w-[16px] h-[16px] ml-1'}`}>
                        <Icon
                          className={`w-full h-full transition-colors ${
                            isDragOver
                              ? 'text-[#5D5FEF]'
                              : isActive
                                ? 'text-white'
                                : 'text-gray-400 group-hover:text-gray-200'
                          }`}
                        />
                      </div>

                      {/* Label */}
                      {!collapsed && (
<span className={`font-heading text-[13px] font-semibold tracking-tight whitespace-nowrap flex-1 transition-colors ${
                            isActive
                              ? 'text-white'
                              : 'text-gray-400 group-hover:text-gray-100'
                          }`}>
                          {item.label}
                        </span>
                      )}

                      {/* Share badge */}
                      {item.id === 'shared' && shareCount > 0 && !isDragOver && !collapsed && (
                        <span className="min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full bg-[#5D5FEF] text-white text-[10px] font-bold leading-none">
                          {shareCount > 99 ? '99+' : shareCount}
                        </span>
                      )}

                      {/* Drag-drop label */}
                      {isDragOver && !collapsed && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#5D5FEF] bg-[#5D5FEF]/15 px-1.5 py-0.5 rounded-md animate-pulse">
                          Drop
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thin separator between groups */}
            {!collapsed && (
              <div className="mx-4 my-1 h-px bg-white/[0.06]" />
            )}
          </div>
        );
      })}
    </nav>
  );
};

export default SidebarNavigation;
