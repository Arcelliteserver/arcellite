import React, { useRef } from 'react';
import { Upload, Plus } from 'lucide-react';

interface SidebarActionsProps {
  activeTab: string;
  onUpload: (files: File[]) => void;
  isFamilyMember?: boolean;
  collapsed?: boolean;
}

const SidebarActions: React.FC<SidebarActionsProps> = ({ onUpload, collapsed }) => {
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
      <div className={`px-3 mb-2 mt-1 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <button
            onClick={handleUploadClick}
            title="Upload"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#5D5FEF] text-white hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleUploadClick}
            className="font-heading flex items-center justify-center gap-2 w-full bg-[#5D5FEF] text-white py-2.5 rounded-xl shadow-lg shadow-[#5D5FEF]/20 hover:bg-[#4D4FCF] transition-all font-semibold text-[13px] tracking-tight active:scale-[0.98]"
          >
            <Upload className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Upload</span>
          </button>
        )}
      </div>
    </>
  );
};

export default SidebarActions;
