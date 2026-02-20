import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, Users, Check, MessageSquare } from 'lucide-react';
import type { FileItem } from '../../types';

interface ShareableUser {
  id: number;
  name: string;
  avatarUrl: string | null;
}

interface ShareDialogProps {
  isOpen: boolean;
  file: FileItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ isOpen, file, onClose, onSuccess, onError }) => {
  const [users, setUsers] = useState<ShareableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedUserId(null);
    setMessage('');
    setLoading(true);
    fetch('/api/share/users', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data.ok) setUsers(data.users || []);
        else setUsers([]);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen || !file) return null;

  const handleShare = async () => {
    if (!selectedUserId || !file) return;
    setSharing(true);
    try {
      const cat = file.category || 'general';
      const prefix = `server-${cat}-`;
      const filePath = file.id.startsWith(prefix) ? file.id.slice(prefix.length) : file.name;
      // Build the full relative path including category folder
      const categoryFolderMap: Record<string, string> = {
        general: 'files',
        media: 'photos',
        video_vault: 'videos',
        music: 'music',
      };
      const folder = categoryFolderMap[cat] || 'files';
      const fullPath = `${folder}/${filePath}`;

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'heic'];
      const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm'];
      const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
      let fileType = 'document';
      if (imageExts.includes(ext)) fileType = 'image';
      else if (videoExts.includes(ext)) fileType = 'video';
      else if (audioExts.includes(ext)) fileType = 'audio';
      else if (ext === 'pdf') fileType = 'pdf';

      const res = await fetch('/api/share', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          sharedWith: selectedUserId,
          filePath: fullPath,
          fileName: file.name,
          fileType,
          category: cat,
          sizeBytes: file.sizeBytes || 0,
          message: message.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const userName = users.find(u => u.id === selectedUserId)?.name || 'user';
        onSuccess(`"${file.name}" shared with ${userName}!`);
        onClose();
      } else {
        onError(data.error || 'Failed to share file');
      }
    } catch (e) {
      onError((e as Error).message || 'Share failed');
    } finally {
      setSharing(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[600] animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#5D5FEF]/10 to-[#5D5FEF]/5 px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-gray-900">Share File</h3>
              <p className="text-xs text-gray-500 mt-1 truncate max-w-[280px]">
                Share <span className="font-bold text-gray-700">{file.name}</span> with family
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* User selection */}
            <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-3 block">
              Share with
            </label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-[#5D5FEF] animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-400">No family members found</p>
                <p className="text-xs text-gray-400 mt-1">Add family members to start sharing</p>
              </div>
            ) : (
              <div className="space-y-2 mb-5">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id === selectedUserId ? null : user.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                      selectedUserId === user.id
                        ? 'border-[#5D5FEF] bg-[#5D5FEF]/5'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5D5FEF] to-[#4D4FCF] flex items-center justify-center text-white text-xs font-black">
                        {getInitials(user.name)}
                      </div>
                    )}
                    <span className="text-sm font-bold text-gray-800 flex-1 text-left">{user.name}</span>
                    {selectedUserId === user.id && (
                      <div className="w-6 h-6 rounded-full bg-[#5D5FEF] flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Optional message */}
            {users.length > 0 && (
              <div>
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" />
                  Message (optional)
                </label>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && selectedUserId) handleShare(); if (e.key === 'Escape') onClose(); }}
                  placeholder="Add a note..."
                  maxLength={200}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#5D5FEF] focus:ring-2 focus:ring-[#5D5FEF]/20 text-sm font-medium"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleShare}
              disabled={!selectedUserId || sharing}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#5D5FEF] to-[#4D4FCF] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:from-[#4D4FCF] hover:to-[#3D3FBF] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sharing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Share
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ShareDialog;
