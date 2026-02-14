import React from 'react';
import { ChevronLeft, Sparkles } from 'lucide-react';
import ChatView from '../views/features/ChatView';

interface MobileChatProps {
  selectedModel: string;
  user: { firstName: string | null; lastName: string | null; avatarUrl: string | null; email: string } | null;
  onRefreshFiles: () => void;
  onNavigateToDatabase: () => void;
  onNavigateToFile: (category: string, itemPath: string, isFolder: boolean) => void;
  onBack: () => void;
}

const MobileChat: React.FC<MobileChatProps> = ({
  selectedModel,
  user,
  onRefreshFiles,
  onNavigateToDatabase,
  onNavigateToFile,
  onBack,
}) => {
  return (
    <div className="flex flex-col h-screen bg-white animate-in fade-in duration-200">
      {/* Chat Header */}
      <header className="flex items-center justify-between px-3 h-14 bg-white/95 backdrop-blur-xl border-b border-gray-100 flex-shrink-0 safe-area-top">
        <button
          onClick={onBack}
          className="p-2 -ml-1 rounded-xl text-gray-500 active:bg-gray-100 active:scale-90 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#5D5FEF]" />
          <span className="text-sm font-black text-gray-900 tracking-tight">Arcellite Chat</span>
        </div>
        <div className="w-9 h-9 rounded-2xl bg-[#5D5FEF] flex items-center justify-center">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <span className="text-white font-black text-xs">
              {user?.firstName?.[0]?.toUpperCase() || 'A'}
            </span>
          )}
        </div>
      </header>

      {/* Chat Body — full remaining height, no bottom nav */}
      <div className="flex-1 min-h-0">
        <ChatView
          selectedModel={selectedModel}
          user={user}
          onRefreshFiles={onRefreshFiles}
          onNavigateToDatabase={onNavigateToDatabase}
          onNavigateToFile={onNavigateToFile}
        />
      </div>
    </div>
  );
};

export default MobileChat;
