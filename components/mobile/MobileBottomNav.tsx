import React from 'react';
import { LayoutGrid, FolderOpen, Sparkles, Image, Settings } from 'lucide-react';

export type MobileTab = 'overview' | 'files' | 'chat' | 'photos' | 'settings';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

const tabs: { id: MobileTab; label: string; icon: React.FC<{ className?: string; strokeWidth?: number }> }[] = [
  { id: 'overview', label: 'Home', icon: LayoutGrid },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'chat', label: 'Chat', icon: Sparkles },
  { id: 'photos', label: 'Gallery', icon: Image },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] px-4 pb-4 pointer-events-none safe-area-bottom">
      <div className="pointer-events-auto bg-[#111122] rounded-2xl flex items-center justify-around px-2 h-[72px] shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center gap-[4px] flex-1 py-1 transition-all active:scale-90"
            >
              <Icon
                className={`w-[22px] h-[22px] transition-colors duration-200 ${
                  isActive ? 'text-[#5D5FEF]' : 'text-gray-400'
                }`}
                strokeWidth={isActive ? 2.2 : 1.5}
              />
              <span className={`text-[11px] transition-colors duration-200 ${
                isActive ? 'font-semibold text-[#5D5FEF]' : 'font-medium text-gray-500'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
