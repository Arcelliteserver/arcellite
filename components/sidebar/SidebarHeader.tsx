import React from 'react';
import { Cloud } from 'lucide-react';

interface SidebarHeaderProps {
  onLogoClick: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onLogoClick }) => {
  return (
    <div className="flex items-center gap-2 p-4 sm:p-6 md:p-6 cursor-pointer justify-start" onClick={onLogoClick}>
      <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-7 md:h-7 flex items-center justify-center flex-shrink-0">
        <Cloud className="w-full h-full text-[#5D5FEF] fill-[#5D5FEF]/10" strokeWidth={2.5} />
      </div>
      <h1 className="font-bold text-base sm:text-lg md:text-lg tracking-tight text-[#111111] text-left">
        Arcellite<span className="text-[#5D5FEF]">.</span>
      </h1>
    </div>
  );
};

export default SidebarHeader;

