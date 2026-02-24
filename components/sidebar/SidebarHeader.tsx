import React from 'react';
import { Cloud, PanelLeft } from 'lucide-react';

interface SidebarHeaderProps {
  onLogoClick: () => void;
  onToggleCollapse?: () => void;
  collapsed?: boolean;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onLogoClick, onToggleCollapse, collapsed }) => {
  return (
    <div className={`flex items-center h-16 flex-shrink-0 px-3 ${collapsed ? 'justify-center' : 'justify-between gap-2'}`}>
      {/* Logo */}
      <button
        onClick={onLogoClick}
        className="flex items-center gap-2.5 flex-shrink-0"
        title="Arcellite"
      >
        <Cloud className="w-6 h-6 text-[#5D5FEF] flex-shrink-0" strokeWidth={2.5} />
        {!collapsed && (
          <span className="font-heading font-bold text-[18px] tracking-tight text-white leading-none whitespace-nowrap">
            Arcellite<span className="text-[#5D5FEF]">.</span>
          </span>
        )}
      </button>

      {/* Collapse button — only shown when expanded */}
      {!collapsed && onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/[0.08] transition-all flex-shrink-0"
          title="Collapse sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default SidebarHeader;
