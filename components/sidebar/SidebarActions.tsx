import React, { useRef } from 'react';
import { Upload, BarChart3 } from 'lucide-react';

interface SidebarActionsProps {
  activeTab: string;
  onUpload: (files: File[]) => void;
  onStatsClick: () => void;
}

const SidebarActions: React.FC<SidebarActionsProps> = ({ activeTab, onUpload, onStatsClick }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUpload(Array.from(e.target.files));
            e.target.value = '';
          }
        }} 
      />
      <div className="px-4 space-y-2 mb-6">
        <button 
          onClick={handleUploadClick}
          className="flex items-center justify-center gap-2 w-full bg-[#5D5FEF] text-white py-2.5 sm:py-3 md:py-3.5 rounded-xl shadow-lg shadow-[#5D5FEF]/20 hover:bg-[#4D4FCF] transition-all font-bold text-xs sm:text-sm md:text-sm active:scale-95 min-h-[44px]"
        >
          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4 md:h-4 flex-shrink-0" />
          <span>Upload</span>
        </button>
        <button 
          onClick={onStatsClick}
          className={`flex items-center justify-center gap-2 w-full py-2.5 sm:py-2.5 md:py-3 rounded-xl transition-all font-bold text-xs sm:text-sm md:text-sm shadow-sm active:scale-95 border min-h-[44px] ${
            activeTab === 'stats' 
              ? 'bg-[#5D5FEF]/10 border-[#5D5FEF]/20 text-[#5D5FEF]' 
              : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <BarChart3 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'stats' ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
          <span>Vault Stats</span>
        </button>
      </div>
    </>
  );
};

export default SidebarActions;

