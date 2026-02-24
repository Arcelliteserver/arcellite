
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, ArrowRight, RotateCcw, CheckCircle, XCircle, FolderPlus, Trash2, Database, FileText, Sparkles, Folder, File, ExternalLink, Image as ImageIcon, Film, Music, BookOpen, FileArchive, Table, Settings, FileCode, Mail, MessageSquare, Plus, Clock, ChevronLeft, X, Cloud, Copy, RefreshCw, Volume2, Square, Check, Mic, ChevronDown, ArrowUp } from 'lucide-react';
import { usePdfThumbnail } from '../../files/usePdfThumbnail';
import { AI_MODELS } from '@/constants';

/** Strip download-site tags like "(z-lib.org)", "(libgen)", "(Anna's Archive)" etc. from file names */
function cleanDisplayName(name: string): string {
  // Remove common library/source tags in parentheses from file names
  return name
    .replace(/\s*\(z-?lib(?:\.org|\.rs)?\)/gi, '')
    .replace(/\s*\(z-?library\)/gi, '')
    .replace(/\s*\(libgen(?:\.\w+)?\)/gi, '')
    .replace(/\s*\(anna'?s?\s*archive\)/gi, '')
    .replace(/\s*\(sci-hub\)/gi, '')
    .replace(/\s*\(pdfdrive(?:\.com)?\)/gi, '')
    .replace(/\s*\(www\.ebook\w*\.\w+\)/gi, '')
    .replace(/\s*\(b-ok\.\w+\)/gi, '')
    .replace(/\s*\(1lib\.\w+\)/gi, '')
    .replace(/\s*\(\d+lib\.\w+\)/gi, '')
    .trim();
}

/** Small component to render a PDF thumbnail using the shared hook */
const ChatPdfThumbnail: React.FC<{ url: string; fileName: string; onClick?: () => void }> = ({ url, fileName, onClick }) => {
  const thumb = usePdfThumbnail(url, true);
  const displayName = cleanDisplayName(fileName);
  return (
    <div
      onClick={onClick}
      className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm max-w-xs cursor-pointer hover:shadow-xl hover:shadow-[#5D5FEF]/10 hover:border-[#5D5FEF]/30 transition-all group"
    >
      <div className="bg-gray-50 flex items-center justify-center min-h-[200px] max-h-[320px]">
        {thumb ? (
          <img src={thumb} alt={displayName} className="w-full h-auto object-contain max-h-[320px]" />
        ) : (
          <div className="flex flex-col items-center gap-2 py-10">
            <BookOpen className="w-10 h-10 text-red-400 animate-pulse" />
            <span className="text-[10px] font-bold text-gray-300">Loading preview...</span>
          </div>
        )}
      </div>
      <div className="px-3 py-2 bg-white border-t border-gray-50">
        <p className="text-[13px] font-bold text-gray-800 truncate group-hover:text-[#5D5FEF] transition-colors">{displayName}</p>
        <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">PDF</span>
      </div>
    </div>
  );
};

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

interface ChatViewProps {
  selectedModel: string;
  onRefreshFiles?: () => void;
  onNavigateToFile?: (category: string, itemPath: string, isFolder: boolean) => void;
  onNavigateToDatabase?: () => void;
  user?: { firstName: string | null; lastName: string | null; avatarUrl: string | null; email: string } | null;
  isFamilyMember?: boolean;
}

const ChatView: React.FC<ChatViewProps> = ({ selectedModel, onRefreshFiles, onNavigateToFile, onNavigateToDatabase, user, isFamilyMember }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [ttsLoadingIndex, setTtsLoadingIndex] = useState<number | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const speakingAudioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localModel, setLocalModel] = useState(selectedModel);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  // Only show models whose provider has an API key configured
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const modelsWithApi = AI_MODELS.filter(m => configuredProviders.includes(m.provider));

  useEffect(() => {
    fetch('/api/ai/configured-providers')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.providers) setConfiguredProviders(data.providers);
      })
      .catch(() => {});
  }, []);

  // Keep localModel in sync with selectedModel; if current model has no API, switch to first configured
  useEffect(() => {
    const selectedHasApi = modelsWithApi.some(m => m.id === selectedModel);
    if (selectedHasApi) {
      setLocalModel(selectedModel);
      return;
    }
    setLocalModel(prev => {
      const current = AI_MODELS.find(m => m.id === prev);
      if (modelsWithApi.length === 0) return prev;
      if (!current || !configuredProviders.includes(current.provider)) {
        const first = modelsWithApi[0];
        return first ? first.id : prev;
      }
      return prev;
    });
  }, [selectedModel, configuredProviders.join(','), modelsWithApi.length]);

  // Chat history state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setConversations(data.conversations);
      }
    } catch {
      // Non-critical
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load a specific conversation
  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setMessages(data.messages);
          setCurrentConversationId(conversationId);
          setShowHistory(false);
        }
      }
    } catch {
      // Non-critical
    }
  }, []);

  // Create a new conversation
  const createConversation = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: localModel }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setCurrentConversationId(data.conversation.id);
          return data.conversation.id;
        }
      }
    } catch {
      // Non-critical
    }
    return null;
  }, [localModel]);

  // Save a message to the DB
  const saveMessage = useCallback(async (conversationId: string, msg: ChatMessage) => {
    try {
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          role: msg.role,
          content: msg.content,
          actions: msg.actions || null,
          blocks: msg.blocks || null,
        }),
      });
    } catch {
      // Non-critical — messages still show in UI
    }
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      await fetch(`/api/chat/conversations/${conversationId}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
    } catch {
      // Non-critical
    }
  }, [currentConversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleClearChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
  };

  // Retry: regenerate the AI response in-place using existing conversation history
  const handleRetry = async (aiMsgIndex: number) => {
    if (isLoading) return;
    // Build history from messages up to (but not including) this AI message
    const historyUpTo = messages.slice(0, aiMsgIndex).map(m => ({ role: m.role, content: m.content }));
    if (historyUpTo.length === 0) return;

    // Remove the AI message being retried
    setMessages(prev => prev.filter((_, idx) => idx !== aiMsgIndex));
    setIsLoading(true);

    const assistantTimestamp = Date.now() + 1;

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyUpTo,
          model: localModel,
          userEmail: user?.email,
        }),
      });

      if (!response.ok || !response.body) {
        setMessages(prev => [...prev, {
          role: 'assistant' as const,
          content: 'Failed to regenerate. Please try again.',
          timestamp: assistantTimestamp,
        }]);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accContent = '';
      let accActions: ActionResult[] = [];
      let accBlocks: ContentBlock[] = [];
      let messageAdded = false;

      const addOrUpdateMessage = () => {
        const payload: ChatMessage = {
          role: 'assistant' as const,
          content: accContent || '',
          actions: accActions.length > 0 ? [...accActions] : undefined,
          blocks: [...accBlocks],
          timestamp: assistantTimestamp,
        };
        if (!messageAdded) {
          messageAdded = true;
          setMessages(prev => [...prev, payload]);
        } else {
          setMessages(prev => prev.map(m => m.timestamp === assistantTimestamp ? payload : m));
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
                addOrUpdateMessage();
              }
            } catch {}
          } else if (eventType === 'action' && eventData) {
            try {
              const actionResult = JSON.parse(eventData);
              accActions = [...accActions, actionResult];
              accBlocks.push({ type: 'action', actionResult });
              addOrUpdateMessage();
              if (onRefreshFiles) onRefreshFiles();
            } catch {}
          } else if (eventType === 'error' && eventData) {
            try {
              const { error } = JSON.parse(eventData);
              accContent = error || 'Something went wrong.';
              accBlocks = [{ type: 'text', text: accContent }];
              addOrUpdateMessage();
            } catch {}
          }
        }
      }

      if (!messageAdded) {
        setMessages(prev => [...prev, {
          role: 'assistant' as const,
          content: accContent || 'Done.',
          actions: accActions.length > 0 ? accActions : undefined,
          blocks: accBlocks.length > 0 ? accBlocks : [{ type: 'text', text: accContent || 'Done.' }],
          timestamp: assistantTimestamp,
        }]);
      }

      // Save regenerated message to DB
      if (currentConversationId) {
        saveMessage(currentConversationId, {
          role: 'assistant',
          content: accContent || 'Done.',
          actions: accActions.length > 0 ? accActions : undefined,
          blocks: accBlocks.length > 0 ? accBlocks : [{ type: 'text', text: accContent || 'Done.' }],
          timestamp: assistantTimestamp,
        });
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant' as const,
        content: 'Failed to regenerate. Please try again.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  // TTS: speak an AI response using ElevenLabs
  const handleSpeak = async (text: string, msgIndex: number) => {
    // If already speaking or loading this message, stop
    if (speakingIndex === msgIndex || ttsLoadingIndex === msgIndex) {
      speakingAudioRef.current?.pause();
      speakingAudioRef.current = null;
      setSpeakingIndex(null);
      setTtsLoadingIndex(null);
      return;
    }
    // Stop any current playback
    if (speakingAudioRef.current) {
      speakingAudioRef.current.pause();
      speakingAudioRef.current = null;
      setSpeakingIndex(null);
    }
    setTtsLoadingIndex(msgIndex);
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'TTS failed' }));
        setTtsLoadingIndex(null);
        if (res.status === 400 && errData.error?.includes('not configured')) {
          setTtsError('ElevenLabs API key not configured. Go to Settings → API Keys to add it.');
          setTimeout(() => setTtsError(null), 5000);
        }
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      speakingAudioRef.current = audio;
      setTtsLoadingIndex(null);
      setSpeakingIndex(msgIndex);
      audio.onended = () => {
        setSpeakingIndex(null);
        speakingAudioRef.current = null;
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setSpeakingIndex(null);
        speakingAudioRef.current = null;
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch {
      setTtsLoadingIndex(null);
      setSpeakingIndex(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const newUserMsg: ChatMessage = { role: 'user', content: userMessage, timestamp: Date.now() };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsLoading(true);

    // Ensure we have a conversation ID (create one if needed)
    let convoId = currentConversationId;
    const isFirstExchange = !convoId;
    if (!convoId) {
      convoId = await createConversation();
    }

    // Save user message to DB
    if (convoId) {
      saveMessage(convoId, newUserMsg);
    }

    const assistantTimestamp = Date.now() + 1;

    try {
      // Build conversation history for context
      const history = [...messages, newUserMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          model: localModel,
          userEmail: user?.email,
        }),
      });

      if (!response.ok || !response.body) {
        setMessages(prev => [...prev, {
          role: 'assistant' as const,
          content: 'Something went wrong. Please check your API key in Settings → AI Models.',
          timestamp: assistantTimestamp,
        }]);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accContent = '';
      let accActions: ActionResult[] = [];
      let accBlocks: ContentBlock[] = [];
      let messageAdded = false;

      const addOrUpdateMessage = () => {
        if (!messageAdded) {
          messageAdded = true;
          setMessages(prev => [...prev, {
            role: 'assistant' as const,
            content: accContent || '',
            actions: accActions.length > 0 ? [...accActions] : undefined,
            blocks: [...accBlocks],
            timestamp: assistantTimestamp,
          }]);
        } else {
          setMessages(prev => prev.map(m =>
            m.timestamp === assistantTimestamp
              ? { ...m, content: accContent, actions: accActions.length > 0 ? [...accActions] : undefined, blocks: [...accBlocks] }
              : m
          ));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events (split by double newline)
        const parts = buffer.split('\n\n');
        buffer = parts.pop()!; // Keep last incomplete part

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split('\n');
          let eventType = '';
          let eventData = '';
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
                addOrUpdateMessage();
              }
            } catch (e) { console.error('[Chat] SSE text parse error:', e); }
          } else if (eventType === 'action' && eventData) {
            try {
              const actionResult = JSON.parse(eventData);
              accActions = [...accActions, actionResult];
              accBlocks.push({ type: 'action', actionResult });
              addOrUpdateMessage();
              if (onRefreshFiles) onRefreshFiles();
            } catch (e) { console.error('[Chat] SSE action parse error:', e); }
          } else if (eventType === 'error' && eventData) {
            try {
              const { error } = JSON.parse(eventData);
              accContent = error || 'Something went wrong. Please check your API key in Settings → AI Models.';
              accBlocks = [{ type: 'text', text: accContent }];
              addOrUpdateMessage();
            } catch (e) { console.error('[Chat] SSE error parse error:', e); }
          }
        }
      }

      // Ensure message exists with final content
      if (!messageAdded) {
        setMessages(prev => [...prev, {
          role: 'assistant' as const,
          content: accContent || 'Done.',
          actions: accActions.length > 0 ? accActions : undefined,
          blocks: accBlocks.length > 0 ? accBlocks : [{ type: 'text', text: accContent || 'Done.' }],
          timestamp: assistantTimestamp,
        }]);
      }

      // Save assistant message to DB
      if (convoId) {
        saveMessage(convoId, {
          role: 'assistant',
          content: accContent || 'Done.',
          actions: accActions.length > 0 ? accActions : undefined,
          blocks: accBlocks.length > 0 ? accBlocks : [{ type: 'text', text: accContent || 'Done.' }],
          timestamp: assistantTimestamp,
        });
        loadConversations(); // Refresh sidebar list

        // Backend auto-generates AI title for first exchange; refresh after a delay to pick it up
        if (isFirstExchange && accContent) {
          setTimeout(() => loadConversations(), 3000);
          setTimeout(() => loadConversations(), 6000);
        }
      }
    } catch (error) {
      const modelInfo = AI_MODELS.find(m => m.id === localModel);
      const providerHint = modelInfo ? `your ${modelInfo.provider} API key is configured` : 'your API key is configured';
      const errorMsg: ChatMessage = {
        role: 'assistant' as const,
        content: `Failed to connect to the AI service. Make sure the server is running and ${providerHint} in Settings → AI Models.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
      if (convoId) saveMessage(convoId, errorMsg);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  };

  const suggestions = isFamilyMember ? [
    { text: 'Organize my files into folders', icon: FolderPlus },
    { text: 'Find all my photos', icon: ImageIcon },
    { text: 'Show me my music collection', icon: Music },
    { text: 'Find all PDF documents in my files', icon: FileText },
  ] : [
    { text: 'Create a new database for my app', icon: Database },
    { text: 'Organize my files into folders', icon: FolderPlus },
    { text: 'Send my latest photos to Discord', icon: Send },
    { text: 'Find all PDF documents in my files', icon: FileText },
  ];

  /** Color presets for clickable option text — purple by default, unique colors only for database engines */
  const optionColorMap: Record<string, string> = {
    postgresql: 'text-emerald-600',
    postgres: 'text-emerald-600',
    mysql: 'text-emerald-600',
    sqlite: 'text-emerald-600',
  };

  const dbKeywords = new Set(['postgresql', 'postgres', 'mysql', 'sqlite']);
  const castKeywords = new Set(['gamingtv tv', 'smarttv 4k', 'my room display', 'space tv', 'chromecast', 'nest hub']);

  const isDbOption = (label: string) => dbKeywords.has(label.toLowerCase().trim());
  const isCastOption = (label: string) => {
    const key = label.toLowerCase().trim();
    return castKeywords.has(key) || key.includes('tv') || key.includes('display') || key.includes('chromecast');
  };

  const getOptionTextColor = (label: string) => {
    const key = label.toLowerCase().trim();
    if (optionColorMap[key]) return optionColorMap[key];
    return 'text-[#5D5FEF]';
  };

  const handleOptionClick = (option: string) => {
    if (isLoading) return;
    setInput(option);
    inputRef.current?.focus();
  };

  /** Render markdown-lite content: bold, code, lists */
  const renderContent = (text: string) => {
    if (!text) return null;

    // First, extract code blocks and replace with placeholders
    const codeBlocks: { lang: string; code: string }[] = [];
    const textWithPlaceholders = text.replace(/```(\w*)?\n([\s\S]*?)```/g, (_match, lang, code) => {
      codeBlocks.push({ lang: lang || '', code: code.trimEnd() });
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    const lines = textWithPlaceholders.split('\n');
    const elements: React.ReactNode[] = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      // Code block placeholder
      const codeBlockMatch = line.match(/^__CODE_BLOCK_(\d+)__$/);
      if (codeBlockMatch) {
        const block = codeBlocks[parseInt(codeBlockMatch[1])];
        elements.push(
          <div key={lineIdx} className="my-2 rounded-xl overflow-hidden border border-gray-200">
            {block.lang && (
              <div className="px-3 py-1 bg-gray-100 text-[9px] font-black text-gray-400 uppercase tracking-widest">{block.lang}</div>
            )}
            <pre className="px-4 py-3 bg-gray-50 text-[12px] font-mono text-gray-700 overflow-x-auto leading-relaxed">
              <code>{block.code}</code>
            </pre>
          </div>
        );
        continue;
      }
      // Markdown table: collect consecutive | lines
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines: string[] = [line];
        while (lineIdx + 1 < lines.length && lines[lineIdx + 1].trim().startsWith('|') && lines[lineIdx + 1].trim().endsWith('|')) {
          lineIdx++;
          tableLines.push(lines[lineIdx]);
        }
        if (tableLines.length >= 2) {
          const parseRow = (r: string) => r.split('|').slice(1, -1).map(c => c.trim());
          const isSeparator = (r: string) => /^\|[\s:?-]+\|/.test(r.trim()) && r.includes('-');
          const headerCells = parseRow(tableLines[0]);
          const startRow = isSeparator(tableLines[1]) ? 2 : 1;
          const dataRows = tableLines.slice(startRow).filter(r => !isSeparator(r)).map(parseRow);
          elements.push(
            <div key={lineIdx} className="my-2 rounded-xl overflow-hidden border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {headerCells.map((h, hi) => (
                        <th key={hi} className="px-4 py-2.5 text-left text-[11px] font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">{renderInline(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.map((row, ri) => (
                      <tr key={ri} className={`border-b border-gray-100 last:border-0 ${ri % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-4 py-2 text-gray-700 whitespace-nowrap">{renderInline(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
          continue;
        }
      }
      // Heading
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={lineIdx} className="text-[14px] font-black text-gray-900 mt-3 mb-1">{line.slice(4)}</h4>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h3 key={lineIdx} className="text-[15px] font-black text-gray-900 mt-3 mb-1">{line.slice(3)}</h3>
        );
      } else if (line.startsWith('# ')) {
        elements.push(
          <h2 key={lineIdx} className="text-[16px] font-black text-gray-900 mt-3 mb-1">{line.slice(2)}</h2>
        );
      }
      // List items
      else if (line.match(/^[-*•]\s/)) {
        elements.push(
          <div key={lineIdx} className="flex gap-2 ml-2">
            <span className="text-[#5D5FEF] mt-0.5">•</span>
            <span>{renderInline(line.replace(/^[-*•]\s/, ''))}</span>
          </div>
        );
      }
      // Numbered list
      else if (line.match(/^\d+\.\s/)) {
        const match = line.match(/^(\d+)\.\s(.*)/);
        if (match) {
          elements.push(
            <div key={lineIdx} className="flex gap-2 ml-2">
              <span className="text-[#5D5FEF] font-bold text-[12px] mt-0.5 w-4 flex-shrink-0">{match[1]}.</span>
              <span>{renderInline(match[2])}</span>
            </div>
          );
        }
      }
      // Clickable options: [options: A | B | C]
      else if (line.match(/^\[options:\s*.+\]$/)) {
        const inner = line.replace(/^\[options:\s*/, '').replace(/\]$/, '');
        const opts = inner.split('|').map(o => o.trim()).filter(Boolean);
        if (opts.length > 0) {
          elements.push(
            <div key={lineIdx} className="flex flex-col gap-1.5 mt-3 mb-1 ml-4 px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 w-fit min-w-[180px]">
              {opts.map((opt, oi) => {
                const color = getOptionTextColor(opt);
                const isDb = isDbOption(opt);
                const isCast = isCastOption(opt);
                return (
                  <button
                    key={oi}
                    onClick={() => handleOptionClick(opt)}
                    disabled={isLoading}
                    className={`flex items-center gap-2 ${color} text-[14px] font-bold transition-all hover:opacity-70 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer w-fit`}
                  >
                    {isDb ? (
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z"/></svg>
                    ) : isCast ? (
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-480Zm320 320H600q0-20-1.5-40t-4.5-40h206v-480H160v46q-20-3-40-4.5T80-680v-40q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160Zm-720 0v-120q50 0 85 35t35 85H80Zm200 0q0-83-58.5-141.5T80-360v-80q117 0 198.5 81.5T360-160h-80Zm160 0q0-75-28.5-140.5t-77-114q-48.5-48.5-114-77T80-520v-80q91 0 171 34.5T391-471q60 60 94.5 140T520-160h-80Z"/></svg>
                    ) : (
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 -960 960 960" fill="currentColor"><path d="M468-240q-96-5-162-74t-66-166q0-100 70-170t170-70q97 0 166 66t74 162l-84-25q-13-54-56-88.5T480-640q-66 0-113 47t-47 113q0 57 34.5 100t88.5 56l25 84Zm48 158q-9 2-18 2h-18q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480v18q0 9-2 18l-78-24v-12q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93h12l24 78Zm305 22L650-231 600-80 480-480l400 120-151 50 171 171-79 79Z"/></svg>
                    )}
                    {opt}
                  </button>
                );
              })}
            </div>
          );
          return;
        }
      }
      // Empty line
      else if (!line.trim()) {
        elements.push(<div key={lineIdx} className="h-2" />);
      }
      // Normal paragraph
      else {
        elements.push(
          <p key={lineIdx} className="leading-relaxed">{renderInline(line)}</p>
        );
      }
    }

    return <div className="space-y-1">{elements}</div>;
  };

  /** Render inline formatting: **bold**, `code`, *italic*, #channel */
  const renderInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Bold **text**
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      // Code `text`
      const codeMatch = remaining.match(/`(.*?)`/);
      // Italic *text* (not preceded by *)
      const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/);
      // #channel-name
      const channelMatch = remaining.match(/#([a-zA-Z][a-zA-Z0-9_-]*)/);
      // User's first name — highlight in purple
      const nameMatch = user?.firstName ? remaining.match(new RegExp(`\\b(${user.firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i')) : null;

      // Find earliest match
      const matches = [
        boldMatch ? { type: 'bold', match: boldMatch, idx: remaining.indexOf(boldMatch[0]) } : null,
        codeMatch ? { type: 'code', match: codeMatch, idx: remaining.indexOf(codeMatch[0]) } : null,
        italicMatch ? { type: 'italic', match: italicMatch, idx: remaining.indexOf(italicMatch[0]) } : null,
        channelMatch ? { type: 'channel', match: channelMatch, idx: remaining.indexOf(channelMatch[0]) } : null,
        nameMatch ? { type: 'name', match: nameMatch, idx: nameMatch.index! } : null,
      ].filter(Boolean).sort((a, b) => a!.idx - b!.idx);

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = matches[0]!;
      
      // Push text before match
      if (first.idx > 0) {
        parts.push(remaining.slice(0, first.idx));
      }

      if (first.type === 'bold') {
        parts.push(<strong key={keyIdx++} className="font-black text-[#5D5FEF]">{first.match![1]}</strong>);
      } else if (first.type === 'code') {
        parts.push(
          <code key={keyIdx++} className="px-1.5 py-0.5 bg-gray-100 rounded-md text-[12px] font-mono text-[#5D5FEF]">
            {first.match![1]}
          </code>
        );
      } else if (first.type === 'italic') {
        parts.push(<em key={keyIdx++} className="italic">{first.match![1]}</em>);
      } else if (first.type === 'channel') {
        parts.push(
          <span key={keyIdx++} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#5D5FEF]/10 text-[#5D5FEF] rounded-md text-[12px] font-bold">
            <span className="opacity-60">#</span>{first.match![1]}
          </span>
        );
      } else if (first.type === 'name') {
        parts.push(<span key={keyIdx++} className="text-[#5D5FEF] font-semibold">{first.match![1]}</span>);
      }

      remaining = remaining.slice(first.idx + first.match![0].length);
    }

    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
  };

  /** Detect file type from extension for icon rendering */
  const getFileType = (name: string): 'image' | 'video' | 'audio' | 'document' | 'code' | 'folder' | 'book' | 'pdf' | 'archive' | 'spreadsheet' | 'data' | 'config' => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'raw', 'ico'].includes(ext)) return 'image';
    if (['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) return 'audio';
    if (['epub', 'mobi', 'azw', 'azw3', 'djvu', 'cbr', 'cbz'].includes(ext)) return 'book';
    if (ext === 'pdf') return 'pdf';
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg'].includes(ext)) return 'archive';
    if (['csv', 'xls', 'xlsx', 'ods', 'tsv'].includes(ext)) return 'spreadsheet';
    if (['json', 'xml', 'sql', 'db', 'sqlite'].includes(ext)) return 'data';
    if (['env', 'ini', 'cfg', 'conf', 'toml', 'properties', 'gitignore', 'dockerignore', 'editorconfig'].includes(ext)) return 'config';
    if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'html', 'css', 'yaml', 'yml', 'sh', 'rb', 'php', 'swift', 'kt', 'dart', 'lua', 'r', 'scala', 'zig'].includes(ext)) return 'code';
    return 'document';
  };

  const getFileIcon = (name: string, isFolder: boolean) => {
    if (isFolder) return <Folder className="w-6 h-6 text-[#5D5FEF]" fill="#5D5FEF" />;
    const type = getFileType(name);
    switch (type) {
      case 'image': return <ImageIcon className="w-6 h-6 text-blue-500" />;
      case 'video': return <Film className="w-6 h-6 text-purple-500" />;
      case 'audio': return <Music className="w-6 h-6 text-pink-500" />;
      case 'code': return <FileCode className="w-6 h-6 text-emerald-500" />;
      case 'book': return <BookOpen className="w-6 h-6 text-indigo-500" />;
      case 'pdf': return <BookOpen className="w-6 h-6 text-red-500" />;
      case 'archive': return <FileArchive className="w-6 h-6 text-orange-500" />;
      case 'spreadsheet': return <Table className="w-6 h-6 text-green-600" />;
      case 'data': return <Database className="w-6 h-6 text-amber-500" />;
      case 'config': return <Settings className="w-6 h-6 text-slate-500" />;
      default: return <File className="w-6 h-6 text-gray-400" />;
    }
  };

  const getFileTypeLabel = (name: string, isFolder: boolean): string => {
    if (isFolder) return 'FOLDER';
    const type = getFileType(name);
    const ext = name.split('.').pop()?.toUpperCase() || '';
    switch (type) {
      case 'image': return ext;
      case 'video': return ext;
      case 'audio': return ext;
      default: return ext || 'FILE';
    }
  };

  /** Render a single action result card */
  const renderSingleAction = (action: ActionResult, idx: number) => {
    return (
      <React.Fragment key={`action-${idx}`}>
        {/* Inline image preview */}
        {action.success && action.data?.type === 'image' && (
          <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm max-w-sm">
            <img
              src={action.data.url}
              alt={cleanDisplayName(action.data.fileName || 'Image')}
              className="w-full h-auto object-contain max-h-80 bg-gray-50"
              loading="lazy"
            />
            <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-400 truncate">
              {cleanDisplayName(action.data.fileName || 'Image')}
            </div>
          </div>
        )}

        {/* PDF / document file preview with thumbnail */}
        {action.success && action.data?.type === 'file_preview' && (
          (() => {
            const isPdf = (action.data.fileName || '').toLowerCase().endsWith('.pdf');
            const category = action.data.category || 'general';
            const filePath = action.data.path || action.data.fileName;
            if (isPdf) {
              return (
                <ChatPdfThumbnail
                  url={action.data.url}
                  fileName={action.data.fileName}
                  onClick={() => onNavigateToFile?.(category, filePath, false)}
                />
              );
            }
            // Non-PDF file card
            const fileType = getFileType(action.data.fileName || '');
            return (
              <div
                onClick={() => onNavigateToFile?.(category, filePath, false)}
                className="p-3 bg-white border border-gray-100 rounded-2xl flex items-center gap-4 hover:shadow-xl hover:shadow-[#5D5FEF]/10 hover:border-[#5D5FEF]/30 transition-all cursor-pointer group max-w-sm"
              >
                <div className={`w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center border border-gray-50 ${
                  fileType === 'book' ? 'bg-indigo-50' : fileType === 'audio' ? 'bg-pink-50' : fileType === 'video' ? 'bg-purple-50' : 'bg-gray-50'
                }`}>
                  {getFileIcon(action.data.fileName, false)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-gray-800 truncate leading-tight group-hover:text-[#5D5FEF] transition-colors">
                    {cleanDisplayName(action.data.fileName)}
                  </p>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{getFileTypeLabel(action.data.fileName, false)}</span>
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 group-hover:bg-[#5D5FEF] group-hover:text-white text-gray-300 transition-all flex-shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })()
        )}

        {/* Styled file/folder list */}
        {action.success && action.data?.type === 'file_list' && (
          <div className="space-y-2">
            {action.data.isEmpty ? (
              <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Folder className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-[13px] font-bold text-gray-400">This folder is empty</p>
                <p className="text-[11px] text-gray-300 mt-1">Upload files to get started</p>
              </div>
            ) : (
            <>
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Attached Files</p>
            {action.data.items.map((item: any, fi: number) => {
              const itemCategory = action.data.category || 'general';
              const basePath = action.data.path || '';
              const itemPath = basePath ? `${basePath}/${item.name}` : item.name;
              return (
              <div
                key={fi}
                onClick={() => onNavigateToFile?.(itemCategory, itemPath, item.isFolder)}
                className="p-3 bg-white border border-gray-100 rounded-2xl flex items-center gap-4 hover:shadow-xl hover:shadow-[#5D5FEF]/10 hover:border-[#5D5FEF]/30 transition-all cursor-pointer group"
              >
                <div className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-50 ${
                  item.isFolder ? 'bg-[#5D5FEF]/5' :
                  (() => { const t = getFileType(item.name); return t === 'book' ? 'bg-indigo-50' : t === 'pdf' ? 'bg-red-50' : t === 'image' ? 'bg-blue-50' : t === 'video' ? 'bg-purple-50' : t === 'audio' ? 'bg-pink-50' : t === 'code' ? 'bg-emerald-50' : t === 'archive' ? 'bg-orange-50' : t === 'spreadsheet' ? 'bg-green-50' : t === 'data' ? 'bg-amber-50' : t === 'config' ? 'bg-slate-50' : 'bg-gray-50'; })()
                }`}>
                  {getFileIcon(item.name, item.isFolder)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-gray-800 truncate leading-tight group-hover:text-[#5D5FEF] transition-colors">
                    {cleanDisplayName(item.name)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{getFileTypeLabel(item.name, item.isFolder)}</span>
                    {item.size && (
                      <>
                        <span className="w-1 h-1 bg-gray-200 rounded-full" />
                        <span className="text-[9px] font-bold text-gray-300">{item.size}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 group-hover:bg-[#5D5FEF] group-hover:text-white text-gray-300 transition-all flex-shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </div>
              );
            })}
            {action.data.remainingCount > 0 && (
              <p className="text-[10px] font-bold text-gray-400 text-center py-1">
                + {action.data.remainingCount} more item{action.data.remainingCount === 1 ? '' : 's'}
              </p>
            )}
            </>
            )}
          </div>
        )}

        {/* Genre/topic search scanned all files */}
        {action.success && action.data?.type === 'file_list_all' && (
          <div className="mt-1">
            <p className="text-[10px] font-bold text-gray-400 italic">
              Scanned {action.data.totalCount} file{action.data.totalCount === 1 ? '' : 's'} in {action.data.path || action.data.category}
            </p>
          </div>
        )}

        {/* File created card */}
        {action.success && action.data?.type === 'file_created' && (
          <div
            onClick={() => onNavigateToFile?.(action.data.category, action.data.path, false)}
            className="p-3 bg-white border border-emerald-100 rounded-2xl flex items-center gap-4 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-300 transition-all cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 border border-emerald-100/50">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-800 truncate leading-tight group-hover:text-emerald-600 transition-colors">
                {action.data.fileName}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Created</span>
                <span className="w-1 h-1 bg-gray-200 rounded-full" />
                <span className="text-[9px] font-bold text-gray-300">{action.data.size}</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-50 group-hover:bg-emerald-500 group-hover:text-white text-emerald-400 transition-all flex-shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Email sent card */}
        {action.success && action.data?.type === 'email_sent' && (
          <div
            className="p-3 bg-white border border-blue-100 rounded-2xl flex items-center gap-4 shadow-sm"
          >
            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 border border-blue-100/50">
              <Mail className="w-6 h-6 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-800 truncate leading-tight">
                {cleanDisplayName(action.data.fileName)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Sent</span>
                <span className="w-1 h-1 bg-gray-200 rounded-full" />
                <span className="text-[10px] font-medium text-gray-400 truncate">{action.data.email}</span>
                {action.data.size && (
                  <>
                    <span className="w-1 h-1 bg-gray-200 rounded-full" />
                    <span className="text-[9px] font-bold text-gray-300">{action.data.size}</span>
                  </>
                )}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-50 text-blue-400 flex-shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Discord sent card */}
        {action.success && action.data?.type === 'discord_sent' && (
          <div className="p-3 bg-white border border-[#5865F2]/20 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-xl bg-[#5865F2]/10 flex items-center justify-center flex-shrink-0 border border-[#5865F2]/20">
              <MessageSquare className="w-6 h-6 text-[#5865F2]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-800 leading-tight">
                #{action.data.channel}
              </p>
              <p className="text-[12px] text-gray-500 truncate mt-0.5">{action.data.message}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-black text-[#5865F2] uppercase tracking-widest">Discord</span>
                <span className="w-1 h-1 bg-gray-200 rounded-full" />
                <span className="text-[10px] font-medium text-gray-400">Message Sent</span>
                {action.data.fileUrl && (
                  <>
                    <span className="w-1 h-1 bg-gray-200 rounded-full" />
                    <span className="text-[9px] font-bold text-gray-300">+ File</span>
                  </>
                )}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#5865F2]/10 text-[#5865F2] flex-shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Database deleted card */}
        {action.success && action.data?.type === 'database_deleted' && (
          <div
            className="p-3 bg-white border border-red-100 rounded-2xl flex items-center gap-4 shadow-sm"
          >
            <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 border border-red-100/50">
              <Database className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-800 truncate leading-tight">
                {action.data.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Database Deleted</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-50 text-red-400 flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Database created card */}
        {action.success && action.data?.type === 'database_created' && (
          <div
            onClick={() => onNavigateToDatabase?.()}
            className="p-3 bg-white border border-emerald-100 rounded-2xl flex items-center gap-4 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-300 transition-all cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 border border-emerald-100/50">
              <Database className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-800 truncate leading-tight group-hover:text-emerald-600 transition-colors">
                {action.data.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Database Created</span>
                <span className="w-1 h-1 bg-gray-200 rounded-full" />
                <span className="text-[9px] font-bold text-gray-300">{action.data.dbType}</span>
                {action.data.size && (
                  <>
                    <span className="w-1 h-1 bg-gray-200 rounded-full" />
                    <span className="text-[9px] font-bold text-gray-300">{action.data.size}</span>
                  </>
                )}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-50 group-hover:bg-emerald-500 group-hover:text-white text-emerald-400 transition-all flex-shrink-0">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Table created card */}
        {action.success && action.data?.type === 'table_created' && (
          <div
            onClick={() => onNavigateToDatabase?.()}
            className="p-3 bg-white border border-blue-100 rounded-2xl flex items-center gap-4 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-300 transition-all cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 border border-blue-100/50">
              <Table className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-800 truncate leading-tight group-hover:text-blue-600 transition-colors">
                {action.data.tableName}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Table Created</span>
                <span className="w-1 h-1 bg-gray-200 rounded-full" />
                <span className="text-[9px] font-bold text-gray-300">in {action.data.database}</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-50 group-hover:bg-blue-500 group-hover:text-white text-blue-400 transition-all flex-shrink-0">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Styled database list */}
        {action.success && action.data?.type === 'database_list' && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Databases</p>
            {action.data.items.map((db: any, di: number) => (
              <div
                key={di}
                onClick={() => onNavigateToDatabase?.()}
                className="p-3 bg-white border border-gray-100 rounded-2xl flex items-center gap-4 hover:shadow-xl hover:shadow-[#5D5FEF]/10 hover:border-[#5D5FEF]/30 transition-all cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 border border-emerald-100/50">
                  <Database className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-gray-800 truncate leading-tight group-hover:text-[#5D5FEF] transition-colors">
                    {db.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{db.type}</span>
                    <span className="w-1 h-1 bg-gray-200 rounded-full" />
                    <span className="text-[9px] font-bold text-gray-300">{db.status === 'running' ? 'Running' : 'Stopped'}</span>
                    {db.size && (
                      <>
                        <span className="w-1 h-1 bg-gray-200 rounded-full" />
                        <span className="text-[9px] font-bold text-gray-300">{db.size}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  db.status === 'running' ? 'bg-emerald-50' : 'bg-gray-50'
                }`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    db.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Styled trash list */}
        {action.success && action.data?.type === 'trash_list' && action.data.items.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Trash Items</p>
            {action.data.items.map((item: any, ti: number) => (
              <div
                key={ti}
                className="p-3 bg-white border border-gray-100 rounded-2xl flex items-center gap-4 hover:shadow-xl hover:shadow-[#5D5FEF]/10 hover:border-[#5D5FEF]/30 transition-all cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 border border-red-100/50">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-gray-800 truncate leading-tight group-hover:text-[#5D5FEF] transition-colors">
                    {item.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{item.category === 'media' ? 'PHOTO' : item.category === 'video_vault' ? 'VIDEO' : 'FILE'}</span>
                    {item.size && (
                      <>
                        <span className="w-1 h-1 bg-gray-200 rounded-full" />
                        <span className="text-[9px] font-bold text-gray-300">{item.size}</span>
                      </>
                    )}
                    <span className="w-1 h-1 bg-gray-200 rounded-full" />
                    <span className="text-[9px] font-bold text-gray-300">
                      {new Date(item.trashedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Organize result with moved files */}
        {action.success && action.data?.type === 'organize_result' && action.data.moved?.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Files Organized</p>
            {action.data.moved.map((item: string, oi: number) => {
              const [fileName, targetFolder] = item.split(' → ');
              return (
                <div
                  key={oi}
                  className="p-3 bg-white border border-gray-100 rounded-2xl flex items-center gap-4 hover:shadow-xl hover:shadow-[#5D5FEF]/10 hover:border-[#5D5FEF]/30 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 border border-emerald-100/50">
                    <ArrowRight className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-800 truncate leading-tight">
                      {fileName}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-500 mt-0.5">
                      → {targetFolder}
                    </p>
                  </div>
                </div>
              );
            })}
            {action.data.foldersCreated?.length > 0 && (
              <p className="text-[10px] text-gray-400 mt-1 pl-1">
                Created folder{action.data.foldersCreated.length > 1 ? 's' : ''}: {action.data.foldersCreated.join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Query result table */}
        {action.success && action.data?.type === 'query_result' && (
          <div className="space-y-2">
            {action.data.sql && (
              <div className="px-3 py-2 bg-gray-900 rounded-xl">
                <code className="text-[11px] text-emerald-400 font-mono">{action.data.sql}</code>
              </div>
            )}
            {action.data.rows && action.data.rows.length > 0 ? (
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {action.data.columns?.map((col: string, ci: number) => (
                          <th key={ci} className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {action.data.rows.slice(0, 20).map((row: any, ri: number) => (
                        <tr key={ri} className={`border-b border-gray-50 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          {action.data.columns?.map((col: string, ci: number) => (
                            <td key={ci} className="px-3 py-2 text-[12px] font-medium text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                              {row[col] === null ? <span className="text-gray-300 italic">null</span> : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400">
                    {action.data.rowCount} row{action.data.rowCount === 1 ? '' : 's'} returned
                  </span>
                  {action.data.rows.length > 20 && (
                    <span className="text-[10px] font-bold text-gray-300">Showing first 20</span>
                  )}
                  <span className="text-[9px] font-bold text-gray-300 uppercase">{action.data.command}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <p className="text-[12px] font-bold text-emerald-600">
                  {action.data.command === 'INSERT' || action.data.command === 'UPDATE' || action.data.command === 'DELETE'
                    ? `${action.data.command} affected ${action.data.rowCount} row${action.data.rowCount === 1 ? '' : 's'}`
                    : action.data.command === 'SELECT'
                    ? 'Query returned 0 rows'
                    : `${action.data.command || 'Query'} executed successfully`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Standard action result card — only show if no specialized card rendered above */}
        {(() => {
          const hasSpecialCard = action.data?.type && [
            'image', 'file_list', 'file_list_all', 'file_created', 'file_preview', 'email_sent', 'discord_sent',
            'database_created', 'database_deleted', 'table_created', 'database_list',
            'trash_list', 'organize_result', 'query_result',
          ].includes(action.data.type);
          if (!action.success) return null;
          if (hasSpecialCard) return null;
          return (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl text-[12px] font-bold bg-gray-50 text-gray-500 border border-gray-100">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{action.message}</span>
            </div>
          );
        })()}
      </React.Fragment>
    );
  };

  /** Render action results (legacy — used for messages without blocks) */
  const renderActions = (actions: ActionResult[]) => {
    return (
      <div className="mt-3 space-y-2">
        {actions.map((action, idx) => renderSingleAction(action, idx))}
      </div>
    );
  };

  /** Render interleaved content blocks (text segments + action cards in order) */
  const renderBlocks = (blocks: ContentBlock[]) => {
    return (
      <div className="space-y-3">
        {blocks.map((block, idx) => {
          if (block.type === 'text' && block.text) {
            return (
              <div key={`block-${idx}`} className="text-[14px] sm:text-[15px] leading-relaxed font-medium text-gray-700">
                {renderContent(block.text)}
              </div>
            );
          }
          if (block.type === 'action' && block.actionResult) {
            return (
              <div key={`block-${idx}`} className="ml-0">
                {renderSingleAction(block.actionResult, idx)}
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white w-full relative overflow-hidden">
      {/* History toggle button - Phone & Desktop */}
      <button
        onClick={() => { setShowHistory(prev => !prev); if (!showHistory) loadConversations(); }}
        className={`absolute top-20 sm:top-24 md:top-6 left-4 sm:left-8 z-30 flex items-center justify-center w-12 h-12 backdrop-blur-md rounded-2xl border transition-all ${showHistory ? 'bg-[#5D5FEF] border-[#5D5FEF] shadow-lg shadow-[#5D5FEF]/30' : 'bg-gray-50/50 border-gray-100 hover:border-[#5D5FEF]/30 hover:bg-[#5D5FEF]/5'}`}
        title="Chat History"
      >
        {showHistory ? <X className="w-5 h-5 text-white" /> : <MessageSquare className="w-5 h-5 text-[#5D5FEF]" />}
      </button>

      {/* Chat History Panel */}
      {showHistory && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-20" onClick={() => setShowHistory(false)} />
          <div className="absolute top-36 sm:top-40 md:top-20 left-4 sm:left-8 z-30 w-80 max-h-[70vh] bg-white/95 backdrop-blur-xl rounded-2xl border border-gray-100 shadow-2xl shadow-black/10 overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300">
          {/* Panel Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#5D5FEF]" />
              <h3 className="font-black text-sm text-gray-800">Chat History</h3>
            </div>
            <button
              onClick={() => { handleClearChat(); setShowHistory(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5D5FEF] hover:bg-[#4B4DD4] text-white rounded-xl transition-all text-[10px] font-black tracking-wide"
            >
              <Plus className="w-3 h-3" />
              New Chat
            </button>
          </div>

          {/* Conversations List */}
          <div className="overflow-y-auto max-h-[calc(70vh-60px)] py-2">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <MessageSquare className="w-8 h-8 text-gray-200 mb-3" />
                <p className="text-xs font-bold text-gray-400">No conversations yet</p>
                <p className="text-[10px] text-gray-300 mt-1">Start chatting to see history here</p>
              </div>
            ) : (
              conversations.map((convo) => (
                <div
                  key={convo.id}
                  className={`group mx-2 mb-1 rounded-xl transition-all cursor-pointer ${currentConversationId === convo.id ? 'bg-[#5D5FEF]/10 border border-[#5D5FEF]/20' : 'hover:bg-gray-50 border border-transparent'}`}
                >
                  <div className="flex items-start gap-3 px-3 py-3" onClick={() => loadConversation(convo.id)}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${currentConversationId === convo.id ? 'bg-[#5D5FEF] shadow-md shadow-[#5D5FEF]/20' : 'bg-gray-100'}`}>
                      <MessageSquare className={`w-3.5 h-3.5 ${currentConversationId === convo.id ? 'text-white' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-bold truncate ${currentConversationId === convo.id ? 'text-[#5D5FEF]' : 'text-gray-700'}`}>
                        {convo.title || 'Untitled Chat'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold text-gray-300">
                          {new Date(convo.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-[9px] font-bold text-gray-300">•</span>
                        <span className="text-[9px] font-bold text-gray-300">
                          {convo.message_count} msg{convo.message_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(convo.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3 h-3 text-gray-300 hover:text-red-500 transition-colors" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth min-h-0">
        <div className="w-full max-w-[95%] mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8 pb-32 sm:pb-44 pt-20 sm:pt-24 md:pt-0">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] sm:min-h-[65vh] text-center space-y-8 sm:space-y-10">
              <div className="max-w-xl px-2">
                <div className="w-16 sm:w-20 h-16 sm:h-20 bg-[#5D5FEF]/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 sm:mb-8 border border-[#5D5FEF]/20">
                  <Cloud className="w-10 h-10 text-[#5D5FEF] fill-[#5D5FEF]/10" strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2 sm:mb-3 tracking-tight">
                  Organic Assistance
                </h3>
                <p className="text-gray-400 font-semibold text-[10px] sm:text-xs uppercase tracking-[0.25em] leading-relaxed">
                  {isFamilyMember ? 'Your personal file assistant.' : 'Search, analyze, and automate.'}
                </p>
              </div>

              {/* Template cards — single brand color, in context */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full max-w-2xl px-2 sm:px-0">
                {suggestions.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => setInput(item.text)}
                      className="flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-3 bg-[#5D5FEF]/[0.06] border border-[#5D5FEF]/15 rounded-full text-left hover:border-[#5D5FEF]/30 hover:shadow-lg hover:shadow-[#5D5FEF]/10 transition-all group active:scale-[0.97] duration-200"
                    >
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#5D5FEF]/10 border border-[#5D5FEF]/20 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#5D5FEF]" />
                      </div>
                      <span className="text-[11px] sm:text-[13px] font-bold text-gray-700 leading-snug">
                        {item.text}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-2 text-[10px] text-gray-300 font-bold">
                <Sparkles className="w-3 h-3" />
                <span>Arcellite Intelligence • Configure in Settings → AI Models</span>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} className="animate-in fade-in slide-in-from-bottom-6 duration-700">
              {msg.role === 'user' ? (
                /* ── User message: keep original bubble design ── */
                <div className="flex gap-3 sm:gap-5 flex-row-reverse">
                  {/* Avatar */}
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[1rem] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm bg-white border border-gray-100">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="You" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#5D5FEF] to-[#5D5FEF]/70 flex items-center justify-center">
                        <span className="text-white font-black text-sm">{user?.firstName?.[0]?.toUpperCase() || 'U'}</span>
                      </div>
                    )}
                  </div>
                  <div className="max-w-[85%] sm:max-w-[80%]">
                    <div className="px-5 sm:px-7 py-4 sm:py-5 rounded-[2rem] rounded-tr-none text-[14px] sm:text-[15px] leading-relaxed font-medium shadow-sm border bg-[#5D5FEF] text-white border-transparent">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <p className="text-[9px] font-bold text-gray-300 mt-1.5 text-right">
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ) : (
                /* ── AI message: floating style, no container ── */
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 flex items-center justify-center">
                      <Cloud className="w-5 h-5 text-[#5D5FEF] fill-[#5D5FEF]/10" strokeWidth={2.5} />
                    </div>
                    <span className="text-[13px] font-semibold text-gray-400">Arcellite</span>
                  </div>
                  <div className="max-w-full text-[14px] sm:text-[15px] leading-relaxed font-medium text-gray-700">
                    {msg.blocks && msg.blocks.length > 0 ? (
                      renderBlocks(msg.blocks)
                    ) : (
                      <>
                        {renderContent(msg.content)}
                        {msg.actions && msg.actions.length > 0 && renderActions(msg.actions)}
                      </>
                    )}
                  </div>
                  {/* Action buttons for AI messages */}
                  <div className="flex items-center gap-3 mt-2 px-1">
                    <button
                      onClick={() => {
                        const text = msg.content;
                        if (navigator.clipboard && window.isSecureContext) {
                          navigator.clipboard.writeText(text);
                        } else {
                          const ta = document.createElement('textarea');
                          ta.value = text;
                          ta.style.position = 'fixed';
                          ta.style.left = '-9999px';
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand('copy');
                          document.body.removeChild(ta);
                        }
                        setCopiedIndex(i);
                        setTimeout(() => setCopiedIndex(prev => prev === i ? null : prev), 1500);
                      }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      title={copiedIndex === i ? 'Copied!' : 'Copy response'}
                    >
                      {copiedIndex === i ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRetry(i)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Regenerate response"
                    >
                      <RefreshCw className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleSpeak(msg.content, i)}
                      className="p-1.5 rounded-lg hover:bg-[#5D5FEF]/10 transition-colors"
                      title={ttsLoadingIndex === i ? 'Generating audio...' : speakingIndex === i ? 'Stop speaking' : 'Read aloud'}
                    >
                      {ttsLoadingIndex === i ? (
                        <Loader2 className="w-4 h-4 text-[#5D5FEF] animate-spin" />
                      ) : speakingIndex === i ? (
                        <Square className="w-4 h-4 text-[#5D5FEF]" />
                      ) : (
                        <img src="/assets/icons/select_to_speak_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="Speak" className="w-4 h-4 brightness-[0.55]" />
                      )}
                    </button>
                  </div>
                  <p className="text-[9px] font-bold text-gray-300 mt-1">
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex gap-3 sm:gap-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[1rem] flex items-center justify-center flex-shrink-0 bg-[#5D5FEF]/5 border border-[#5D5FEF]/10 animate-pulse">
                  <Cloud className="w-5 h-5 sm:w-6 sm:h-6 text-[#5D5FEF] fill-[#5D5FEF]/10" strokeWidth={2.5} />
                </div>
                <div>
                  <span className="text-[12px] font-semibold text-gray-400 mb-1.5 block">Arcellite</span>
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-[#5D5FEF] animate-spin" />
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">
                      {isStreaming ? 'Executing...' : 'Thinking...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Bar — original layout: input row with height + toolbar row (Plus, Model, Mic, Send) */}
      <div className="fixed md:absolute bottom-0 left-0 right-0 md:bottom-6 md:left-1/2 md:-translate-x-1/2 z-40 px-4 md:px-0 py-4 md:py-0 md:w-full md:max-w-3xl md:mx-auto">
        {(() => {
          const currentModel = modelsWithApi.find(m => m.id === localModel) ?? modelsWithApi[0];
          const currentModelName = currentModel?.name ?? 'Select Model';
          return (
            <div className="relative">
              {showAttachMenu && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 py-1 w-56">
                  <button onClick={() => setShowAttachMenu(false)} className="flex items-center gap-3 w-full px-5 py-3 hover:bg-gray-50 text-left">
                    <ImageIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-[13px] text-gray-700">Add photos or videos</span>
                  </button>
                  <button onClick={() => setShowAttachMenu(false)} className="flex items-center gap-3 w-full px-5 py-3 hover:bg-gray-50 text-left">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-[13px] text-gray-700">Add files (docs, PDF...)</span>
                  </button>
                </div>
              )}
              {/* Model selector dropdown — only models with API configured */}
              {showModelMenu && (
                <div className="absolute bottom-full mb-2 left-12 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 py-2 w-60 max-h-72 overflow-y-auto">
                  {modelsWithApi.length === 0 ? (
                    <div className="px-4 py-4 text-center">
                      <p className="text-[12px] font-semibold text-gray-500">No API key configured</p>
                      <p className="text-[11px] text-gray-400 mt-1">Go to Settings → AI Models to add a key</p>
                    </div>
                  ) : (
                    modelsWithApi.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setLocalModel(m.id); setShowModelMenu(false); }}
                        className={`flex items-center gap-2.5 w-full px-4 py-2.5 hover:bg-gray-50 text-left ${localModel === m.id ? 'bg-[#5D5FEF]/5' : ''}`}
                      >
                        <img src={m.icon} alt={m.provider} className="w-4 h-4 flex-shrink-0" />
                        <span className="text-[12px] text-gray-700 truncate flex-1">{m.name}</span>
                        {localModel === m.id && <Check className="w-3 h-3 text-[#5D5FEF] flex-shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              )}

              {ttsError && (
                <div className="flex items-center gap-2 mb-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  <span className="flex-1">{ttsError}</span>
                  <button onClick={() => setTtsError(null)} className="text-amber-400 hover:text-amber-600 text-lg leading-none">&times;</button>
                </div>
              )}

              <div className={`bg-white border rounded-2xl shadow-md overflow-hidden transition-all ${isLoading ? 'border-[#5D5FEF]/30' : 'border-gray-200 focus-within:border-[#5D5FEF]/30'}`}>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Ask Arcellite anything..."
                  className="w-full px-5 pt-4 pb-2 min-h-[3.25rem] bg-transparent outline-none text-gray-800 placeholder:text-gray-400 font-medium text-[15px]"
                  onClick={() => { setShowAttachMenu(false); setShowModelMenu(false); }}
                />
                <div className="flex items-center gap-1.5 px-3 pb-3 pt-0.5">
                  <button
                    type="button"
                    onClick={() => { setShowAttachMenu(!showAttachMenu); setShowModelMenu(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-all flex-shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModelMenu(!showModelMenu); setShowAttachMenu(false); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-200 text-gray-600 text-[11px] font-semibold hover:border-gray-300 transition-all flex-shrink-0 max-w-[160px]"
                  >
                    {currentModel?.icon ? (
                      <img src={currentModel.icon} alt={currentModel.provider} className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-[#5D5FEF] flex-shrink-0" />
                    )}
                    <span className="truncate">{currentModelName}</span>
                    <ChevronDown className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    title="Voice input"
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all flex-shrink-0"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    aria-label="Send message"
                    className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all flex-shrink-0 ${
                      input.trim() && !isLoading
                        ? 'bg-gray-900 text-white hover:bg-gray-800 active:scale-95'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isLoading ? <Square className="w-3.5 h-3.5" /> : <ArrowUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default ChatView;
