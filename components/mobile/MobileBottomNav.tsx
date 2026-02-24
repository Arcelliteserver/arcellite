import React from 'react';
import { FolderOpen, Sparkles, User } from 'lucide-react';

export type MobileTab = 'overview' | 'files' | 'chat' | 'photos' | 'settings';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

/* Home icon — Material Symbols view_cozy (4-square grid) */
const HomeIcon: React.FC<{ color?: string }> = ({ color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill={color}>
    <path d="M340-540H200q-33 0-56.5-23.5T120-620v-140q0-33 23.5-56.5T200-840h140q33 0 56.5 23.5T420-760v140q0 33-23.5 56.5T340-540Zm-140-80h140v-140H200v140Zm140 500H200q-33 0-56.5-23.5T120-200v-140q0-33 23.5-56.5T200-420h140q33 0 56.5 23.5T420-340v140q0 33-23.5 56.5T340-120Zm-140-80h140v-140H200v140Zm560-340H620q-33 0-56.5-23.5T540-620v-140q0-33 23.5-56.5T620-840h140q33 0 56.5 23.5T840-760v140q0 33-23.5 56.5T760-540Zm-140-80h140v-140H620v140Zm140 500H620q-33 0-56.5-23.5T540-200v-140q0-33 23.5-56.5T620-420h140q33 0 56.5 23.5T840-340v140q0 33-23.5 56.5T760-120Zm-140-80h140v-140H620v140ZM340-620Zm0 280Zm280-280Zm0 280Z"/>
  </svg>
);

/* Gallery icon — Material Symbols mosaic */
const GalleryIcon: React.FC<{ color?: string }> = ({ color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill={color}>
    <path d="M440-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h240v720Zm-80-80v-560H200v560h160Zm160-320v-320h240q33 0 56.5 23.5T840-760v240H520Zm80-80h160v-160H600v160Zm-80 480v-320h320v240q0 33-23.5 56.5T760-120H520Zm80-80h160v-160H600v160ZM360-480Zm240-120Zm0 240Z"/>
  </svg>
);

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onTabChange }) => {

  return (
    <nav className="font-heading fixed bottom-0 left-0 right-0 z-[100] px-3 sm:px-4 pb-4 sm:pb-5 pointer-events-none safe-area-bottom">
      <div className="pointer-events-auto bg-[#111214] border border-[#2d2d2f] rounded-3xl flex items-center justify-around px-2 h-[72px] sm:h-[84px] shadow-xl shadow-black/20">
        {/* Home — view_cozy grid icon */}
        <button
          onClick={() => onTabChange('overview')}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-90"
        >
          <div className="relative">
            <HomeIcon color={activeTab === 'overview' ? '#5D5FEF' : '#666666'} />
          </div>
          <span className={`text-[10px] transition-colors duration-200 ${
            activeTab === 'overview' ? 'font-semibold text-[#5D5FEF]' : 'font-medium text-[#666666]'
          }`}>
            Home
          </span>
        </button>

        {/* Files */}
        <button
          onClick={() => onTabChange('files')}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-90"
        >
          <FolderOpen
            className={`w-[24px] h-[24px] transition-colors duration-200 ${
              activeTab === 'files' ? 'text-[#5D5FEF]' : 'text-[#666666]'
            }`}
            strokeWidth={activeTab === 'files' ? 2.4 : 1.8}
          />
          <span className={`text-[10px] transition-colors duration-200 ${
            activeTab === 'files' ? 'font-semibold text-[#5D5FEF]' : 'font-medium text-[#666666]'
          }`}>
            Files
          </span>
        </button>

        {/* Chat — center, elevated */}
        <button
          onClick={() => onTabChange('chat')}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-90 -mt-2"
        >
          <div
            className={`w-[48px] h-[48px] rounded-[16px] flex items-center justify-center transition-all ${
              activeTab === 'chat'
                ? 'bg-gradient-to-br from-[#5D5FEF] to-[#4D4FCF] shadow-lg shadow-[#5D5FEF]/40'
                : 'bg-[#222222]'
            }`}
          >
            <Sparkles className="w-[24px] h-[24px] text-white" strokeWidth={activeTab === 'chat' ? 2.4 : 1.8} />
          </div>
        </button>

        {/* Gallery — mosaic icon */}
        <button
          onClick={() => onTabChange('photos')}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-90"
        >
          <GalleryIcon color={activeTab === 'photos' ? '#5D5FEF' : '#666666'} />
          <span className={`text-[10px] transition-colors duration-200 ${
            activeTab === 'photos' ? 'font-semibold text-[#5D5FEF]' : 'font-medium text-[#666666]'
          }`}>
            Gallery
          </span>
        </button>

        {/* Profile */}
        <button
          onClick={() => onTabChange('settings')}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-90"
        >
          <User
            className={`w-[24px] h-[24px] transition-colors duration-200 ${
              activeTab === 'settings' ? 'text-[#5D5FEF]' : 'text-[#666666]'
            }`}
            strokeWidth={activeTab === 'settings' ? 2.4 : 1.8}
          />
          <span className={`text-[10px] transition-colors duration-200 ${
            activeTab === 'settings' ? 'font-semibold text-[#5D5FEF]' : 'font-medium text-[#666666]'
          }`}>
            Profile
          </span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
