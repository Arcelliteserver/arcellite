import React from 'react';
import { Cloud } from 'lucide-react';

interface SidebarHeaderProps {
  onLogoClick: () => void;
  onToggleCollapse?: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onLogoClick, onToggleCollapse }) => {
  return (
    <div className="flex items-center gap-2 p-4 sm:p-6 md:p-6 justify-between">
      <div className="flex items-center gap-2 cursor-pointer" onClick={onLogoClick}>
        <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-7 md:h-7 flex items-center justify-center flex-shrink-0">
          <Cloud className="w-full h-full text-[#5D5FEF] fill-[#5D5FEF]/10" strokeWidth={2.5} />
        </div>
        <h1 className="font-bold text-base sm:text-lg md:text-lg tracking-tight text-[#111111] text-left">
          Arcellite<span className="text-[#5D5FEF]">.</span>
        </h1>
      </div>
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 group"
          title="Collapse sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" className="fill-gray-400 group-hover:fill-[#5D5FEF] transition-colors">
            <path d="M320-240 80-480l240-240 57 57-184 184 183 183-56 56Zm320 0-57-57 184-184-183-183 56-56 240 240-240 240Z"/>
          </svg>
        </button>
      )}
    </div>
  );
};

export default SidebarHeader;

