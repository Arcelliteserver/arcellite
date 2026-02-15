import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send,
  Loader2,
  ArrowRight,
  RotateCcw,
  CheckCircle,
  XCircle,
  FolderPlus,
  Trash2,
  Database,
  FileText,
  Sparkles,
  Folder,
  File,
  ExternalLink,
  Image as ImageIcon,
  Film,
  Music,
  BookOpen,
  FileArchive,
  Table,
  Settings,
  FileCode,
  Mail,
  MessageSquare,
  Plus,
  Clock,
  ChevronLeft,
  ChevronDown,
  X,
  Menu,
  Copy,
  RefreshCw,
  MoreVertical,
  Cloud,
} from 'lucide-react';
import DrawIcon from '../DrawIcon';
import { usePdfThumbnail } from '../files/usePdfThumbnail';

// ── Types ──
interface ContentBlock {
  type: 'text' | 'action';
  text?: string;
  actionResult?: ActionResult;
}
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionResult[];
  blocks?: ContentBlock[];
  timestamp: number;
}
interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}
interface ConversationSummary {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface MobileChatProps {
  selectedModel: string;
  user: { firstName: string | null; lastName: string | null; avatarUrl: string | null; email: string } | null;
  onRefreshFiles: () => void;
  onNavigateToDatabase: () => void;
  onNavigateToFile: (category: string, itemPath: string, isFolder: boolean) => void;
  onBack: () => void;
}

// ── Utility ──
function cleanDisplayName(name: string): string {
  return name
    .replace(/\s*\(z-?lib(?:\.org|\.rs)?\)/gi, '')
    .replace(/\s*\(z-?library\)/gi, '')
    .replace(/\s*\(libgen(?:\.\w+)?\)/gi, '')
    .replace(/\s*\(anna'?s?\s*archive\)/gi, '')
    .replace(/\s*\(sci-hub\)/gi, '')
    .replace(/\s*\(pdfdrive(?:\.com)?\)/gi, '')
    .trim();
}

// ── PDF Thumbnail ──
const ChatPdfThumbnail: React.FC<{ url: string; fileName: string; onClick?: () => void }> = ({ url, fileName, onClick }) => {
  const thumb = usePdfThumbnail(url, true);
  const displayName = cleanDisplayName(fileName);
  return (
    <div onClick={onClick} className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm max-w-[280px] cursor-pointer active:scale-[0.98] transition-all">
      <div className="bg-gray-50 flex items-center justify-center min-h-[180px] max-h-[280px]">
        {thumb ? (
          <img src={thumb} alt={displayName} className="w-full h-auto object-contain max-h-[280px]" loading="lazy" />
        ) : (
          <div className="flex flex-col items-center gap-2 py-10">
            <BookOpen className="w-10 h-10 text-red-400 animate-pulse" />
            <span className="text-[10px] font-bold text-gray-300">Loading preview...</span>
          </div>
        )}
      </div>
      <div className="px-3 py-2 bg-white border-t border-gray-50">
        <p className="text-[13px] font-bold text-gray-800 truncate">{displayName}</p>
        <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">PDF</span>
      </div>
    </div>
  );
};

// ── Thinking Dots (CSS animation matching Arcnota) ──
const ThinkingDots: React.FC = () => (
  <div className="flex items-center gap-1.5 h-6 px-1">
    <span className="w-[6px] h-[6px] rounded-full bg-[#5D5FEF] animate-bounce" style={{ animationDelay: '0ms', animationDuration: '800ms' }} />
    <span className="w-[6px] h-[6px] rounded-full bg-[#5D5FEF] animate-bounce" style={{ animationDelay: '200ms', animationDuration: '800ms' }} />
    <span className="w-[6px] h-[6px] rounded-full bg-[#5D5FEF] animate-bounce" style={{ animationDelay: '400ms', animationDuration: '800ms' }} />
  </div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ── Main Component ──
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MobileChat: React.FC<MobileChatProps> = ({
  selectedModel: _selectedModel,
  user,
  onRefreshFiles,
  onNavigateToDatabase,
  onNavigateToFile,
  onBack,
}) => {
  // Force DeepSeek for mobile chat — Gemini free tier quota exhausted
  const selectedModel = 'deepseek-chat';
  // ── Chat State ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // ── History State ──
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Refs ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Load Conversations ──
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setConversations(data.conversations);
      }
    } catch {}
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Load a Conversation ──
  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.messages)) {
          setMessages(data.messages);
          setCurrentConversationId(id);
          setSidebarOpen(false);
        } else {
          console.warn('[Chat] Failed to load conversation:', data);
        }
      } else {
        console.warn('[Chat] Conversation fetch failed:', res.status);
      }
    } catch (err) {
      console.error('[Chat] Error loading conversation:', err);
    }
  }, []);

  // ── Create Conversation ──
  const createConversation = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setCurrentConversationId(data.conversation.id);
          return data.conversation.id;
        }
      }
    } catch {}
    return null;
  }, [selectedModel]);

  // ── Save Message ──
  const saveMessage = useCallback(async (convoId: string, msg: ChatMessage) => {
    try {
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convoId,
          role: msg.role,
          content: msg.content,
          actions: msg.actions || null,
          blocks: msg.blocks || null,
        }),
      });
    } catch {}
  }, []);

  // ── Delete Conversation ──
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/chat/conversations/${id}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setMessages([]);
      }
    } catch {}
  }, [currentConversationId]);

  // ── Auto-scroll ──
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // ── New Chat ──
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setCurrentConversationId(null);
    setSidebarOpen(false);
  }, []);

  // ── Send Message ──
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Auto-resize input back
    if (inputRef.current) inputRef.current.style.height = '44px';

    let convoId = currentConversationId;
    if (!convoId) convoId = await createConversation();
    if (convoId) saveMessage(convoId, userMsg);

    const assistantTs = Date.now() + 1;

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, model: selectedModel, userEmail: user?.email }),
      });

      if (!response.ok || !response.body) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Check your API key in Settings → AI Models.', timestamp: assistantTs }]);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accContent = '';
      let accActions: ActionResult[] = [];
      let accBlocks: ContentBlock[] = [];
      let messageAdded = false;

      const addOrUpdate = () => {
        const payload: ChatMessage = {
          role: 'assistant',
          content: accContent || '',
          actions: accActions.length > 0 ? [...accActions] : undefined,
          blocks: [...accBlocks],
          timestamp: assistantTs,
        };
        if (!messageAdded) {
          messageAdded = true;
          setMessages(prev => [...prev, payload]);
        } else {
          setMessages(prev => prev.map(m => m.timestamp === assistantTs ? payload : m));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop()!;

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split('\n');
          let eventType = '', eventData = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7);
            if (line.startsWith('data: ')) eventData = line.slice(6);
          }
          if (eventType === 'text' && eventData) {
            try {
              const { content } = JSON.parse(eventData);
              if (content) {
                if (!messageAdded) setIsStreaming(true);
                if (accContent) accContent += '\n\n';
                accContent += content;
                accBlocks.push({ type: 'text', text: content });
                addOrUpdate();
              }
            } catch {}
          } else if (eventType === 'action' && eventData) {
            try {
              const actionResult = JSON.parse(eventData);
              accActions = [...accActions, actionResult];
              accBlocks.push({ type: 'action', actionResult });
              addOrUpdate();
              onRefreshFiles?.();
            } catch {}
          } else if (eventType === 'error' && eventData) {
            try {
              const { error } = JSON.parse(eventData);
              accContent = error || 'Something went wrong.';
              accBlocks = [{ type: 'text', text: accContent }];
              addOrUpdate();
            } catch {}
          }
        }
      }

      if (!messageAdded) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: accContent || 'Done.',
          actions: accActions.length > 0 ? accActions : undefined,
          blocks: accBlocks.length > 0 ? accBlocks : [{ type: 'text', text: accContent || 'Done.' }],
          timestamp: assistantTs,
        }]);
      }

      if (convoId) {
        saveMessage(convoId, {
          role: 'assistant',
          content: accContent || 'Done.',
          actions: accActions.length > 0 ? accActions : undefined,
          blocks: accBlocks.length > 0 ? accBlocks : [{ type: 'text', text: accContent || 'Done.' }],
          timestamp: assistantTs,
        });
        loadConversations();
      }
    } catch {
      const errorMsg: ChatMessage = { role: 'assistant', content: 'Failed to connect. Make sure the server is running.', timestamp: Date.now() };
      setMessages(prev => [...prev, errorMsg]);
      if (convoId) saveMessage(convoId, errorMsg);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  };

  // ── Copy to clipboard ──
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  }, []);

  // ── File helpers ──
  const getFileType = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['jpg','jpeg','png','gif','webp','bmp','svg','heic','raw','ico'].includes(ext)) return 'image';
    if (['mp4','mkv','mov','avi','webm','flv'].includes(ext)) return 'video';
    if (['mp3','wav','flac','aac','ogg','m4a'].includes(ext)) return 'audio';
    if (['epub','mobi','azw','azw3','djvu','cbr','cbz'].includes(ext)) return 'book';
    if (ext === 'pdf') return 'pdf';
    if (['zip','rar','7z','tar','gz','bz2','xz','iso','dmg'].includes(ext)) return 'archive';
    if (['csv','xls','xlsx','ods','tsv'].includes(ext)) return 'spreadsheet';
    if (['json','xml','sql','db','sqlite'].includes(ext)) return 'data';
    if (['js','ts','tsx','jsx','py','java','cpp','c','cs','go','rs','html','css','yaml','yml','sh','rb','php','swift','kt','dart'].includes(ext)) return 'code';
    return 'document';
  };

  const getFileIcon = (name: string, isFolder: boolean) => {
    if (isFolder) return <Folder className="w-5 h-5 text-[#5D5FEF]" fill="#5D5FEF" />;
    const type = getFileType(name);
    switch (type) {
      case 'image': return <ImageIcon className="w-5 h-5 text-blue-500" />;
      case 'video': return <Film className="w-5 h-5 text-purple-500" />;
      case 'audio': return <Music className="w-5 h-5 text-pink-500" />;
      case 'code': return <FileCode className="w-5 h-5 text-emerald-500" />;
      case 'book': return <BookOpen className="w-5 h-5 text-indigo-500" />;
      case 'pdf': return <BookOpen className="w-5 h-5 text-red-500" />;
      case 'archive': return <FileArchive className="w-5 h-5 text-orange-500" />;
      case 'spreadsheet': return <Table className="w-5 h-5 text-green-600" />;
      case 'data': return <Database className="w-5 h-5 text-amber-500" />;
      default: return <File className="w-5 h-5 text-gray-400" />;
    }
  };

  const getFileTypeLabel = (name: string, isFolder: boolean): string => {
    if (isFolder) return 'FOLDER';
    return name.split('.').pop()?.toUpperCase() || 'FILE';
  };

  // ── Markdown-lite renderer ──
  const renderContent = (text: string) => {
    if (!text) return null;
    const codeBlocks: { lang: string; code: string }[] = [];
    const withPlaceholders = text.replace(/```(\w*)?\n([\s\S]*?)```/g, (_m, lang, code) => {
      codeBlocks.push({ lang: lang || '', code: code.trimEnd() });
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });
    const lines = withPlaceholders.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      const cbMatch = line.match(/^__CODE_BLOCK_(\d+)__$/);
      if (cbMatch) {
        const block = codeBlocks[parseInt(cbMatch[1])];
        elements.push(
          <div key={idx} className="my-2 rounded-xl overflow-hidden border border-gray-200">
            {block.lang && <div className="px-3 py-1 bg-gray-100 text-[9px] font-black text-gray-400 uppercase tracking-widest">{block.lang}</div>}
            <pre className="px-3 py-2.5 bg-gray-50 text-[12px] font-mono text-gray-700 overflow-x-auto leading-relaxed"><code>{block.code}</code></pre>
          </div>
        );
        return;
      }
      if (line.startsWith('### ')) elements.push(<h4 key={idx} className="text-[14px] font-black text-gray-900 mt-3 mb-1">{line.slice(4)}</h4>);
      else if (line.startsWith('## ')) elements.push(<h3 key={idx} className="text-[15px] font-black text-gray-900 mt-3 mb-1">{line.slice(3)}</h3>);
      else if (line.startsWith('# ')) elements.push(<h2 key={idx} className="text-[16px] font-black text-gray-900 mt-3 mb-1">{line.slice(2)}</h2>);
      else if (line.match(/^[-*•]\s/)) {
        elements.push(
          <div key={idx} className="flex gap-2 ml-2">
            <span className="text-[#5D5FEF] mt-0.5">•</span>
            <span>{renderInline(line.replace(/^[-*•]\s/, ''))}</span>
          </div>
        );
      } else if (line.match(/^\d+\.\s/)) {
        const m = line.match(/^(\d+)\.\s(.*)/);
        if (m) elements.push(
          <div key={idx} className="flex gap-2 ml-2">
            <span className="text-[#5D5FEF] font-bold text-[12px] mt-0.5 w-4 flex-shrink-0">{m[1]}.</span>
            <span>{renderInline(m[2])}</span>
          </div>
        );
      } else if (!line.trim()) elements.push(<div key={idx} className="h-2" />);
      else elements.push(<p key={idx} className="leading-relaxed">{renderInline(line)}</p>);
    });
    return <div className="space-y-1">{elements}</div>;
  };

  const renderInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let rem = text;
    let k = 0;
    while (rem.length > 0) {
      const bold = rem.match(/\*\*(.*?)\*\*/);
      const code = rem.match(/`(.*?)`/);
      const italic = rem.match(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/);
      const matches = [
        bold ? { type: 'bold', match: bold, idx: rem.indexOf(bold[0]) } : null,
        code ? { type: 'code', match: code, idx: rem.indexOf(code[0]) } : null,
        italic ? { type: 'italic', match: italic, idx: rem.indexOf(italic[0]) } : null,
      ].filter(Boolean).sort((a, b) => a!.idx - b!.idx);
      if (!matches.length) { parts.push(rem); break; }
      const first = matches[0]!;
      if (first.idx > 0) parts.push(rem.slice(0, first.idx));
      if (first.type === 'bold') parts.push(<strong key={k++} className="font-black text-gray-900">{first.match![1]}</strong>);
      else if (first.type === 'code') parts.push(<code key={k++} className="px-1 py-0.5 bg-gray-100 rounded text-[11px] font-mono text-[#5D5FEF]">{first.match![1]}</code>);
      else if (first.type === 'italic') parts.push(<em key={k++}>{first.match![1]}</em>);
      rem = rem.slice(first.idx + first.match![0].length);
    }
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
  };

  // ── Action Card Renderer ──
  const renderAction = (action: ActionResult, idx: number) => (
    <React.Fragment key={`a-${idx}`}>
      {action.success && action.data?.type === 'image' && (
        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm max-w-[260px]">
          <img src={action.data.url} alt={cleanDisplayName(action.data.fileName || 'Image')} className="w-full h-auto object-contain max-h-72 bg-gray-50" loading="lazy" />
          <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-400 truncate">{cleanDisplayName(action.data.fileName || 'Image')}</div>
        </div>
      )}
      {action.success && action.data?.type === 'file_preview' && (() => {
        const isPdf = (action.data.fileName || '').toLowerCase().endsWith('.pdf');
        const cat = action.data.category || 'general';
        const fp = action.data.path || action.data.fileName;
        if (isPdf) return <ChatPdfThumbnail url={action.data.url} fileName={action.data.fileName} onClick={() => onNavigateToFile?.(cat, fp, false)} />;
        return (
          <div onClick={() => onNavigateToFile?.(cat, fp, false)} className="p-3 bg-white border border-gray-100 rounded-2xl flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer max-w-[280px]">
            <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">{getFileIcon(action.data.fileName, false)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-gray-800 truncate">{cleanDisplayName(action.data.fileName)}</p>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{getFileTypeLabel(action.data.fileName, false)}</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          </div>
        );
      })()}
      {action.success && action.data?.type === 'file_list' && (
        <div className="space-y-2">
          {action.data.isEmpty ? (
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-center">
              <Folder className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-[12px] font-bold text-gray-400">Empty folder</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Attached Files</p>
              {action.data.items.slice(0, 10).map((item: any, fi: number) => {
                const itemCat = action.data.category || 'general';
                const base = action.data.path || '';
                const itemPath = base ? `${base}/${item.name}` : item.name;
                return (
                  <div key={fi} onClick={() => onNavigateToFile?.(itemCat, itemPath, item.isFolder)} className="p-3 bg-white border border-gray-100 rounded-2xl flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">{getFileIcon(item.name, item.isFolder)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-800 truncate">{cleanDisplayName(item.name)}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{getFileTypeLabel(item.name, item.isFolder)}</span>
                        {item.size && <><span className="w-1 h-1 bg-gray-200 rounded-full" /><span className="text-[9px] font-bold text-gray-300">{item.size}</span></>}
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  </div>
                );
              })}
              {action.data.remainingCount > 0 && <p className="text-[10px] font-bold text-gray-400 text-center py-1">+ {action.data.remainingCount} more</p>}
            </>
          )}
        </div>
      )}
      {action.success && action.data?.type === 'file_created' && (
        <div onClick={() => onNavigateToFile?.(action.data.category, action.data.path, false)} className="p-3 bg-white border border-emerald-100 rounded-2xl flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-emerald-600" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-800 truncate">{action.data.fileName}</p>
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Created</span>
          </div>
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        </div>
      )}
      {action.success && action.data?.type === 'email_sent' && (
        <div className="p-3 bg-white border border-blue-100 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0"><Mail className="w-5 h-5 text-blue-500" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-800 truncate">{cleanDisplayName(action.data.fileName)}</p>
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Sent to {action.data.email}</span>
          </div>
          <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
        </div>
      )}
      {action.success && action.data?.type === 'database_created' && (
        <div onClick={() => onNavigateToDatabase?.()} className="p-3 bg-white border border-emerald-100 rounded-2xl flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0"><Database className="w-5 h-5 text-emerald-600" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-800 truncate">{action.data.name}</p>
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Database Created</span>
          </div>
          <ArrowRight className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        </div>
      )}
      {action.success && action.data?.type === 'database_deleted' && (
        <div className="p-3 bg-white border border-red-100 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0"><Database className="w-5 h-5 text-red-400" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-800 truncate">{action.data.name}</p>
            <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Database Deleted</span>
          </div>
          <Trash2 className="w-4 h-4 text-red-400 flex-shrink-0" />
        </div>
      )}
      {action.success && action.data?.type === 'table_created' && (
        <div onClick={() => onNavigateToDatabase?.()} className="p-3 bg-white border border-blue-100 rounded-2xl flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0"><Table className="w-5 h-5 text-blue-600" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-800 truncate">{action.data.tableName}</p>
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Table in {action.data.database}</span>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-400 flex-shrink-0" />
        </div>
      )}
      {action.success && action.data?.type === 'database_list' && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Databases</p>
          {action.data.items.map((db: any, di: number) => (
            <div key={di} onClick={() => onNavigateToDatabase?.()} className="p-3 bg-white border border-gray-100 rounded-2xl flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0"><Database className="w-5 h-5 text-emerald-600" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-800 truncate">{db.name}</p>
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{db.type} · {db.status}</span>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${db.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
            </div>
          ))}
        </div>
      )}
      {action.success && action.data?.type === 'trash_list' && action.data.items?.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Trash Items</p>
          {action.data.items.slice(0, 10).map((item: any, ti: number) => (
            <div key={ti} className="p-3 bg-white border border-gray-100 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0"><Trash2 className="w-5 h-5 text-red-400" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-800 truncate">{item.name}</p>
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{item.size}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {action.success && action.data?.type === 'organize_result' && action.data.moved?.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Files Organized</p>
          {action.data.moved.map((item: string, oi: number) => {
            const [fileName, targetFolder] = item.split(' → ');
            return (
              <div key={oi} className="p-3 bg-white border border-gray-100 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0"><ArrowRight className="w-4 h-4 text-emerald-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-800 truncate">{fileName}</p>
                  <p className="text-[10px] font-bold text-emerald-500">→ {targetFolder}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {action.success && action.data?.type === 'query_result' && (
        <div className="space-y-2">
          {action.data.sql && (
            <div className="px-3 py-2 bg-gray-900 rounded-xl"><code className="text-[11px] text-emerald-400 font-mono">{action.data.sql}</code></div>
          )}
          {action.data.rows && action.data.rows.length > 0 ? (
            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr className="bg-gray-50 border-b border-gray-100">{action.data.columns?.map((col: string, ci: number) => <th key={ci} className="px-3 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{col}</th>)}</tr></thead>
                  <tbody>{action.data.rows.slice(0, 15).map((row: any, ri: number) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>{action.data.columns?.map((col: string, ci: number) => <td key={ci} className="px-3 py-1.5 text-[11px] font-medium text-gray-700 whitespace-nowrap max-w-[150px] truncate">{row[col] === null ? <span className="text-gray-300 italic">null</span> : String(row[col])}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 text-[10px] font-bold text-gray-400">{action.data.rowCount} row{action.data.rowCount === 1 ? '' : 's'}</div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <p className="text-[12px] font-bold text-emerald-600">{action.data.command || 'Query'} executed</p>
            </div>
          )}
        </div>
      )}
      {/* Fallback action card */}
      {(() => {
        const special = ['image','file_list','file_list_all','file_created','file_preview','email_sent','database_created','database_deleted','table_created','database_list','trash_list','organize_result','query_result'];
        if (!action.success || (action.data?.type && special.includes(action.data.type))) return null;
        return (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl text-[12px] font-bold bg-gray-50 text-gray-500 border border-gray-100">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{action.message}</span>
          </div>
        );
      })()}
    </React.Fragment>
  );

  // ── Render interleaved blocks ──
  const renderBlocks = (blocks: ContentBlock[]) => (
    <div className="space-y-3">
      {blocks.map((block, idx) => {
        if (block.type === 'text' && block.text) return <div key={idx}>{renderContent(block.text)}</div>;
        if (block.type === 'action' && block.actionResult) return <div key={idx}>{renderAction(block.actionResult, idx)}</div>;
        return null;
      })}
    </div>
  );

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Suggestions ──
  const suggestions = [
    { text: 'Create a new folder called "Projects"', icon: FolderPlus, color: '#5D5FEF', bg: 'bg-[#5D5FEF]/10' },
    { text: 'What files do I have?', icon: FileText, color: '#F59E0B', bg: 'bg-amber-50' },
    { text: 'Organize my Files', icon: ArrowRight, color: '#10B981', bg: 'bg-emerald-50' },
    { text: 'Clean up my trash', icon: Trash2, color: '#EF4444', bg: 'bg-red-50' },
  ];

  // ── Auto-resize textarea ──
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = '44px';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── RENDER — Arcnota-style layout ──
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden relative">

      {/* ── Header (matches Arcnota chat-header) ── */}
      <header className="flex items-center justify-between px-4 py-3 flex-shrink-0 z-30 safe-area-top">
        {/* Left: Hamburger → sidebar */}
        <button
          onClick={() => { setSidebarOpen(true); loadConversations(); }}
          className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-gray-100 transition-all touch-manipulation"
        >
          <Menu className="w-[22px] h-[22px] text-gray-800" />
        </button>

        {/* Center: Icon + Title (like Arcnota) */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <Cloud className="w-full h-full text-[#5D5FEF] fill-[#5D5FEF]/10" strokeWidth={2.5} />
          </div>
          <span className="text-[16px] font-semibold text-gray-900">Arcellite Chat</span>
        </div>

        {/* Right: Back pill (gradient, like Arcnota) */}
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-[#4B4DD4] flex items-center justify-center shadow-md shadow-[#5D5FEF]/20 active:scale-90 transition-all touch-manipulation"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      </header>

      {/* ── Chat Messages / Empty State ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="px-4 py-4 pb-40 space-y-6">
          {messages.length === 0 ? (
            /* ── Empty State (matches Arcnota chat-empty-state) ── */
            <div className="flex flex-col items-center justify-center min-h-[65vh] text-center">
              <div className="w-20 h-20 rounded-full bg-white border border-gray-100 flex items-center justify-center mb-6 shadow-lg shadow-black/5">
                <Cloud className="w-12 h-12 text-[#5D5FEF] fill-[#5D5FEF]/10" strokeWidth={2} />
              </div>
              <h2 className="text-[24px] font-bold text-[#5D5FEF] mb-3">Arcellite</h2>
              <p className="text-[15px] text-gray-400 leading-relaxed max-w-xs">
                Search, analyze, and automate. I can manage your files, databases, and more.
              </p>

              {/* Suggestion chips */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-8 px-2">
                {suggestions.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => setInput(item.text)}
                      className="flex flex-col items-start gap-3 p-4 bg-white border border-gray-100 rounded-2xl text-left active:scale-[0.96] active:border-[#5D5FEF]/30 transition-all touch-manipulation shadow-sm shadow-black/[0.03]"
                    >
                      <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center`}>
                        <Icon className="w-[18px] h-[18px]" style={{ color: item.color }} />
                      </div>
                      <span className="text-[13px] font-semibold text-gray-700 leading-snug">{item.text}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 mt-8 text-[10px] text-gray-300 font-bold">
                <Sparkles className="w-3 h-3" />
                <span>Arcellite Intelligence</span>
              </div>
            </div>
          ) : (
            /* ── Messages ── */
            messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              return (
                <div key={i} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* AI header (Arcnota style: icon + name) */}
                  {!isUser && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 flex items-center justify-center">
                        <Cloud className="w-5 h-5 text-[#5D5FEF] fill-[#5D5FEF]/10" strokeWidth={2.5} />
                      </div>
                      <span className="text-[13px] font-semibold text-gray-400">Arcellite</span>
                    </div>
                  )}

                  {/* Bubble */}
                  <div className={isUser ? 'flex justify-end' : ''}>
                    <div
                      className={
                        isUser
                          ? 'max-w-[85%] px-4 py-3 rounded-2xl rounded-br-[4px] bg-[#5D5FEF] text-white text-[15px] leading-relaxed font-medium'
                          : 'max-w-full text-[14px] leading-relaxed font-medium text-gray-700'
                      }
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : msg.blocks && msg.blocks.length > 0 ? (
                        renderBlocks(msg.blocks)
                      ) : (
                        <>
                          {renderContent(msg.content)}
                          {msg.actions && msg.actions.length > 0 && (
                            <div className="mt-3 space-y-2">{msg.actions.map((a, ai) => renderAction(a, ai))}</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action buttons for AI messages (Arcnota style) */}
                  {!isUser && msg.content && (
                    <div className="flex items-center gap-4 mt-1.5 px-1">
                      <button onClick={() => copyToClipboard(msg.content)} className="p-1 active:opacity-50 touch-manipulation">
                        <Copy className="w-[16px] h-[16px] text-gray-300" />
                      </button>
                      <button className="p-1 active:opacity-50 touch-manipulation">
                        <RefreshCw className="w-[16px] h-[16px] text-gray-300" />
                      </button>
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className={`text-[9px] font-bold text-gray-300 mt-1 ${isUser ? 'text-right' : ''}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              );
            })
          )}

          {/* Loading indicator (Arcnota ThinkingDots style) */}
          {isLoading && !isStreaming && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-[#5D5FEF] fill-[#5D5FEF]/10" strokeWidth={2.5} />
                </div>
                <span className="text-[13px] font-semibold text-gray-400">Arcellite</span>
              </div>
              <ThinkingDots />
            </div>
          )}
        </div>
      </div>

      {/* ── Input Bar (matches Arcnota chat-input) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-2 pb-6 bg-gradient-to-t from-white via-white to-white/0">
        <div className="flex items-end gap-2 bg-[#F7F7F7] rounded-[28px] px-2 py-2 min-h-[56px]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask Arcellite anything..."
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-gray-800 placeholder:text-gray-400 font-medium text-[15px] leading-relaxed px-3 py-2.5 max-h-[120px]"
            style={{ height: '44px' }}
            disabled={isLoading}
          />
          {isLoading ? (
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 mb-0.5">
              <Loader2 className="w-5 h-5 text-[#5D5FEF] animate-spin" />
            </div>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 transition-all active:scale-90 touch-manipulation ${
                input.trim()
                  ? 'bg-[#5D5FEF] text-white shadow-lg shadow-[#5D5FEF]/30'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              <Send className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
      </div>

      {/* ── Sidebar (matches Arcnota chat-sidebar) ── */}
      {sidebarOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 z-[60] animate-in fade-in duration-200"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Panel — slides from left, 80% width */}
          <div className="fixed top-0 left-0 bottom-0 w-[80%] max-w-[320px] bg-white z-[70] shadow-2xl rounded-r-3xl animate-in slide-in-from-left duration-300 flex flex-col safe-area-top">
            {/* Sidebar Header */}
            <div className="px-4 pt-4 pb-2">
              <button onClick={() => setSidebarOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-gray-100 touch-manipulation">
                <Menu className="w-[22px] h-[22px] text-gray-800" />
              </button>
            </div>

            {/* New Chat button */}
            <div className="px-4 mb-4">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#5D5FEF] text-white rounded-full font-semibold text-[14px] active:scale-[0.97] transition-all shadow-lg shadow-[#5D5FEF]/20 touch-manipulation"
              >
                <Plus className="w-5 h-5" />
                New Chat
              </button>
            </div>

            {/* Recent label */}
            <p className="px-5 text-[12px] font-semibold text-gray-400 mb-2">Recent</p>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto px-2">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="w-8 h-8 text-gray-200 mb-3" />
                  <p className="text-[12px] font-bold text-gray-400">No conversations yet</p>
                  <p className="text-[10px] text-gray-300 mt-1">Start chatting to see history here</p>
                </div>
              ) : (
                conversations.map((convo) => (
                  <div
                    key={convo.id}
                    className={`rounded-2xl mb-2 transition-all border ${
                      currentConversationId === convo.id
                        ? 'bg-[#5D5FEF]/5 border-[#5D5FEF]/20'
                        : 'bg-white border-gray-100 active:bg-gray-50'
                    }`}
                    onClick={() => loadConversation(convo.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center gap-3 px-3 py-3 h-[60px] touch-manipulation">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        currentConversationId === convo.id ? 'bg-[#5D5FEF]/10' : 'bg-gray-50'
                      }`}>
                        <MessageSquare className={`w-4 h-4 ${currentConversationId === convo.id ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-semibold truncate max-w-full ${currentConversationId === convo.id ? 'text-[#5D5FEF]' : 'text-gray-700'}`}>
                          {convo.title || 'Untitled Chat'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-bold text-gray-300">
                            {new Date(convo.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-[9px] text-gray-300">·</span>
                          <span className="text-[9px] font-bold text-gray-300">{convo.message_count} msg{convo.message_count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="px-4 py-4 border-t border-gray-100 mt-auto">
              <div className="flex items-center gap-3 px-3 py-2 text-gray-500">
                <Settings className="w-[18px] h-[18px]" />
                <span className="text-[14px] font-medium">Settings</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MobileChat;
