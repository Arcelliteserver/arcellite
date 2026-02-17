
import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Info,
  Share2,
  Download,
  Trash2,
  MoreHorizontal,
  FileText,
  Calendar,
  HardDrive,
  Monitor,
  Tv,
  Cast,
  Check,
  Copy,
  Type,
  Sparkles,
  Loader2,
  Play,
  Pause,
} from 'lucide-react';
import { FileItem } from '../../types';
import FileIcon from './FileIcon';

const NestDisplayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className={className} fill="currentColor">
    <path d="M480-200q-99 0-169.5-13.5T240-246v-34h-73q-35 0-59-26t-21-61l27-320q2-31 25-52t55-21h572q32 0 55 21t25 52l27 320q3 35-21 61t-59 26h-73v34q0 19-70.5 32.5T480-200ZM167-360h626l-27-320H194l-27 320Zm313-160Z"/>
  </svg>
);

const CAST_DEVICES = [
  { key: 'gaming_tv', label: 'GamingTV TV', icon: Tv },
  { key: 'smart_tv', label: 'SmartTV 4K', icon: Monitor },
  { key: 'my_room', label: 'My Room Display', subtitle: 'Nest Hub', icon: NestDisplayIcon },
  { key: 'space_tv', label: 'Space TV', subtitle: 'Chromecast', icon: Cast, isDefault: true },
] as const;

type CastDeviceKey = typeof CAST_DEVICES[number]['key'];

interface FileDetailsProps {
  file: FileItem | null;
  onClose: () => void;
  onDelete?: (file: FileItem) => void;
  onFileRenamed?: () => void;
}

const FileDetails: React.FC<FileDetailsProps> = ({ file, onClose, onDelete, onFileRenamed }) => {
  const [casting, setCasting] = useState(false);
  const [castMenuOpen, setCastMenuOpen] = useState(false);
  const [castSuccess, setCastSuccess] = useState<string | null>(null);
  const [titleCopied, setTitleCopied] = useState(false);
  const [aiRenaming, setAiRenaming] = useState(false);
  const [aiRenameResult, setAiRenameResult] = useState<{ success: boolean; message: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const castMenuRef = useRef<HTMLDivElement>(null);

  // Media Session API — notification-area controls for audio playback
  useEffect(() => {
    if (!file || file.type !== 'audio' || !('mediaSession' in navigator)) return;
    const title = file.name.replace(/^\d{13}_/, '').replace(/_/g, ' ');
    const artworkUrl = `${window.location.origin}/images/music_placeholder.png`;

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: 'Arcellite',
      album: 'My Music',
      artwork: [
        { src: artworkUrl, sizes: '512x512', type: 'image/png' },
        { src: artworkUrl, sizes: '256x256', type: 'image/png' },
        { src: artworkUrl, sizes: '128x128', type: 'image/png' },
        { src: artworkUrl, sizes: '96x96', type: 'image/png' },
      ],
    });

    navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler('stop', () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    });
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    });
    navigator.mediaSession.setActionHandler('seekforward', () => {
      if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 10);
    });

    return () => {
      navigator.mediaSession.metadata = null;
      ['play', 'pause', 'stop', 'seekbackward', 'seekforward'].forEach(a =>
        navigator.mediaSession.setActionHandler(a as MediaSessionAction, null)
      );
    };
  }, [file?.id, file?.type, file?.name]);

  // Update media session playback state
  useEffect(() => {
    if (!file || file.type !== 'audio' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = audioPlaying ? 'playing' : 'paused';
  }, [file?.type, audioPlaying]);

  // Close cast menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (castMenuRef.current && !castMenuRef.current.contains(e.target as Node)) {
        setCastMenuOpen(false);
      }
    };
    if (castMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [castMenuOpen]);

  if (!file) return null;

  /** Strip download-source tags from display names */
  const cleanDisplayName = (name: string): string => {
    return name
      .replace(/\s*\(z-?lib(?:\.org|\.rs)?\)/gi, '')
      .replace(/\s*\(z-?library\)/gi, '')
      .replace(/\s*\(libgen(?:\.\w+)?\)/gi, '')
      .replace(/\s*\(anna'?s?\s*archive\)/gi, '')
      .replace(/\s*\(sci-hub\)/gi, '')
      .replace(/\s*\(pdfdrive(?:\.com)?\)/gi, '')
      .replace(/\s*\(www\.ebook\w*\.\w+\)/gi, '')
      .replace(/\s*\(b-ok\.\w+\)/gi, '')
      .replace(/\s*\(\d+lib\.\w+\)/gi, '')
      .trim();
  };

  const cleanTitle = cleanDisplayName(file.name);

  const handleCopyTitle = async () => {
    try {
      await navigator.clipboard.writeText(cleanTitle);
      setTitleCopied(true);
      setTimeout(() => setTitleCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = cleanTitle;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setTitleCopied(true);
      setTimeout(() => setTitleCopied(false), 2000);
    }
  };

  const handleDelete = () => {
    if (onDelete && confirm(`Are you sure you want to delete "${file.name}"?`)) {
      onDelete(file);
    }
  };

  const handleAiRename = async () => {
    if (aiRenaming || !file) return;
    // Extract category and relative path from file ID: server-<category>-<path>
    const category = file.category || 'general';
    const idPrefix = `server-${category}-`;
    const relPath = file.id.startsWith(idPrefix) ? file.id.slice(idPrefix.length) : file.name;

    setAiRenaming(true);
    setAiRenameResult(null);
    try {
      const response = await fetch('/api/ai/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, filePath: relPath }),
      });
      const result = await response.json();
      if (result.ok && result.renamed) {
        setAiRenameResult({ success: true, message: `Renamed to "${result.newFileName}"` });
        onFileRenamed?.();
      } else if (result.ok && !result.renamed) {
        setAiRenameResult({ success: false, message: `Suggested "${result.title}" but rename failed` });
      } else {
        setAiRenameResult({ success: false, message: result.error || 'Analysis failed' });
      }
    } catch (e) {
      setAiRenameResult({ success: false, message: (e as Error).message });
    } finally {
      setAiRenaming(false);
      setTimeout(() => setAiRenameResult(null), 4000);
    }
  };

  const isImage = file.type === 'image';
  const isVideo = file.type === 'video';
  const isAudio = file.type === 'audio';
  const canCast = isImage || isVideo;

  // Get the publicly accessible file URL for casting
  const getFileUrl = () => {
    if (file.url) {
      // Convert relative API URL to full URL accessible from outside
      const fullUrl = window.location.origin + file.url;
      return fullUrl;
    }
    return '';
  };

  const handleCast = async (deviceKey: CastDeviceKey = 'space_tv') => {
    if (!canCast) return;

    const device = CAST_DEVICES.find(d => d.key === deviceKey);
    try {
      setCasting(true);
      setCastMenuOpen(false);
      const fileUrl = getFileUrl();

      const response = await fetch('https://n8n.arcelliteserver.com/webhook/castc35483a5', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileUrl: fileUrl,
          mimeType: isImage ? 'image/jpeg' : 'video/mp4',
          device: deviceKey,
        }),
      });

      if (response.ok) {
        setCastSuccess(device?.label || deviceKey);
        setTimeout(() => setCastSuccess(null), 3000);
      } else {
        throw new Error('Cast failed');
      }
    } catch (error) {
      alert('Unable to cast. Make sure your Cast device is connected.');
    } finally {
      setCasting(false);
    }
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    // Try modern clipboard API first (requires secure context)
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch {}
    }
    // Fallback: textarea + execCommand (works on HTTP)
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  const handleShare = async () => {
    if (!file.url) return;

    const shareUrl = window.location.origin + file.url;

    if (navigator.share) {
      try {
        await navigator.share({
          title: file.name,
          url: shareUrl,
        });
        return;
      } catch {
        // Share cancelled or not supported — fall through to copy
      }
    }
    // Copy link to clipboard
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!file.url) return;

    // Create download link
    const downloadUrl = file.url.replace('/serve?', '/download?');
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Truncate filename if too long
  const truncateFilename = (name: string, maxLength = 30) => {
    if (name.length <= maxLength) return name;
    const ext = name.split('.').pop();
    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
    const truncated = nameWithoutExt.substring(0, maxLength - ext!.length - 4);
    return `${truncated}...${ext}`;
  };

  // Get file extension for display
  const getFileExtension = () => {
    if (file.isFolder) return 'Folder';
    const ext = file.name.split('.').pop()?.toUpperCase();
    return ext || file.type.toUpperCase();
  };

  return (
    <div className="h-full bg-white flex flex-col overflow-hidden border-l border-gray-100 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-between p-6 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#5D5FEF]" />
          <h2 className="font-bold text-gray-800 text-sm">File Details</h2>
        </div>
        <div className="flex items-center gap-1">
          {canCast && (
            <div className="relative" ref={castMenuRef}>
              <button
                onClick={() => setCastMenuOpen(!castMenuOpen)}
                disabled={casting}
                className={`p-1.5 hover:bg-[#5D5FEF]/10 rounded-full transition-all flex items-center justify-center active:scale-90 disabled:opacity-50 ${
                  casting || castMenuOpen ? 'bg-[#5D5FEF]/10' : ''
                }`}
                title="Cast to device"
              >
                {casting ? (
                  <svg className="w-5 h-5 text-[#5D5FEF] animate-pulse" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-[#5D5FEF]" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                  </svg>
                )}
              </button>

              {/* Cast Device Dropdown */}
              {castMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl shadow-black/15 border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 pt-4 pb-2">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Cast to Device</p>
                  </div>
                  <div className="p-2">
                    {CAST_DEVICES.map((device) => {
                      const DeviceIcon = device.icon;
                      return (
                        <button
                          key={device.key}
                          onClick={() => handleCast(device.key)}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#5D5FEF]/5 transition-all group text-left"
                        >
                          <div className="w-9 h-9 rounded-xl bg-[#F0F0FF] border border-[#5D5FEF]/10 flex items-center justify-center group-hover:bg-[#5D5FEF]/10 transition-colors">
                            <DeviceIcon className="w-4 h-4 text-[#5D5FEF]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{device.label}</p>
                            {'subtitle' in device && device.subtitle && (
                              <p className="text-[11px] text-gray-400 font-medium">{device.subtitle}</p>
                            )}
                          </div>
                          {'isDefault' in device && device.isDefault && (
                            <span className="text-[9px] font-black text-[#5D5FEF] bg-[#F0F0FF] px-2 py-0.5 rounded-full uppercase tracking-wider">Default</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-8">
          <div className="mb-10">
            {isImage ? (
              <div className="relative group overflow-hidden rounded-[2.5rem] shadow-2xl shadow-[#5D5FEF]/10 border border-gray-100">
                <img
                  src={file.url || '/images/photo_placeholder.png'}
                  alt={file.name}
                  className="w-full aspect-square object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/photo_placeholder.png';
                  }}
                />
              </div>
            ) : isVideo ? (
              <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl shadow-[#5D5FEF]/10 bg-black border border-gray-100 aspect-video flex items-center justify-center">
                {file.url ? (
                  <video
                    src={file.url}
                    controls
                    className="w-full h-full object-cover"
                    preload="metadata"
                  />
                ) : (
                  <FileIcon type={file.type} className="w-20 h-20 text-gray-400" />
                )}
              </div>
            ) : isAudio ? (
              <div className="flex flex-col items-center">
                {/* Music artwork / placeholder */}
                <div className="relative w-48 h-48 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-violet-500/15 border border-gray-100 mb-6 group">
                  <img
                    src="/images/music_placeholder.png"
                    alt="Music"
                    className="w-full h-full object-cover"
                  />
                  {/* Play/Pause overlay button */}
                  {file.url && (
                    <button
                      onClick={() => {
                        if (!audioRef.current) return;
                        if (audioPlaying) {
                          audioRef.current.pause();
                        } else {
                          audioRef.current.play();
                        }
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-xl">
                        {audioPlaying ? (
                          <Pause className="w-7 h-7 text-violet-600" />
                        ) : (
                          <Play className="w-7 h-7 text-violet-600 ml-1" />
                        )}
                      </div>
                    </button>
                  )}
                </div>
                {/* Hidden audio element */}
                {file.url && (
                  <audio
                    ref={audioRef}
                    src={file.url}
                    preload="metadata"
                    onPlay={() => setAudioPlaying(true)}
                    onPause={() => setAudioPlaying(false)}
                    onEnded={() => setAudioPlaying(false)}
                    controls
                    className="w-full max-w-xs"
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className={`w-32 h-32 mb-8 flex items-center justify-center rounded-[2.5rem] shadow-xl shadow-[#5D5FEF]/10 relative transition-transform hover:scale-105 duration-300 ${file.isFolder ? 'bg-[#F0F0FF]' : 'bg-[#F8F9FA]'}`}>
                  <div className={`absolute inset-0 opacity-20 blur-2xl rounded-full ${file.isFolder ? 'bg-[#5D5FEF]' : 'bg-gray-400'}`} />
                  <FileIcon type={file.type} className={`w-16 h-16 relative z-10 ${file.isFolder ? 'text-[#5D5FEF]'
                    : file.type === 'code' ? 'text-emerald-500'
                    : file.type === 'data' ? 'text-amber-500'
                    : file.type === 'config' ? 'text-slate-500'
                    : file.type === 'pdf' ? 'text-red-500'
                    : file.type === 'audio' ? 'text-violet-500'
                    : file.type === 'archive' ? 'text-orange-500'
                    : file.type === 'spreadsheet' ? 'text-green-500'
                    : file.type === 'book' ? 'text-indigo-500'
                    : 'text-gray-600'}`} fileName={file.name} />
                </div>
              </div>
            )}

            <div className="mt-8 text-center">
              <h3 className="text-xl font-bold text-gray-800 px-4 leading-tight mb-3" title={cleanTitle}>
                {truncateFilename(cleanTitle, 25)}
              </h3>
              <div className="flex items-center justify-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${
                  file.isFolder ? 'bg-[#F0F0FF] text-[#5D5FEF]' : 'bg-gray-100 text-gray-400'
                }`}>
                  {getFileExtension()}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons - Side by side with icon and text */}
          <div className="flex items-center gap-3 mb-10">
            <button
              onClick={handleShare}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl transition-all shadow-lg group active:scale-95 ${
                linkCopied
                  ? 'bg-green-500 text-white shadow-green-500/20'
                  : 'bg-[#5D5FEF] text-white shadow-[#5D5FEF]/20 hover:bg-[#4D4FCF]'
              }`}
            >
              {linkCopied ? (
                <><Check className="w-4 h-4" /><span className="text-sm font-bold">Link Copied!</span></>
              ) : (
                <><Share2 className="w-4 h-4 group-hover:scale-110 transition-transform" /><span className="text-sm font-bold">Share</span></>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 bg-[#F0F0FF] text-[#5D5FEF] px-4 py-3 rounded-2xl hover:bg-[#E8E8FF] transition-all group active:scale-95 border border-[#5D5FEF]/10"
            >
              <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold">Download</span>
            </button>
          </div>

          {/* File Properties */}
          <div className="space-y-8">
            <div>
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] mb-6">File Properties</p>
              <div className="space-y-6">
                <div className="flex items-center gap-4 group">
                  <div className="w-11 h-11 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-[#5D5FEF]/5 group-hover:text-[#5D5FEF] transition-all">
                    <Type className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wide mb-0.5">Title</p>
                    <p className="text-[14px] font-bold text-gray-700 truncate" title={cleanTitle}>{cleanTitle}</p>
                  </div>
                  {isImage && (
                    <button
                      onClick={handleAiRename}
                      disabled={aiRenaming}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0 ${
                        aiRenaming
                          ? 'bg-[#5D5FEF]/10 text-[#5D5FEF]'
                          : aiRenameResult?.success
                          ? 'bg-emerald-50 text-emerald-500'
                          : 'text-gray-300 hover:bg-[#5D5FEF]/10 hover:text-[#5D5FEF]'
                      }`}
                      title={aiRenaming ? 'Analyzing...' : 'AI rename with Gemini'}
                    >
                      {aiRenaming ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : aiRenameResult?.success ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={handleCopyTitle}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-300 hover:bg-[#5D5FEF]/10 hover:text-[#5D5FEF] transition-all active:scale-90 flex-shrink-0"
                    title="Copy title"
                  >
                    {titleCopied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {aiRenameResult && (
                  <div className={`mt-2 ml-15 text-xs font-medium px-3 py-1.5 rounded-xl ${
                    aiRenameResult.success
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-red-50 text-red-500'
                  }`}>
                    {aiRenameResult.message}
                  </div>
                )}
                <div className="flex items-center gap-4 group">
                  <div className="w-11 h-11 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-[#5D5FEF]/5 group-hover:text-[#5D5FEF] transition-all">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wide mb-0.5">Size</p>
                    <p className="text-[14px] font-bold text-gray-700">{file.size || (file.isFolder ? 'Folder' : 'Unknown')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 group">
                  <div className="w-11 h-11 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-[#5D5FEF]/5 group-hover:text-[#5D5FEF] transition-all">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wide mb-0.5">Last Modified</p>
                    <p className="text-[14px] font-bold text-gray-700">{file.modified}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 group">
                  <div className="w-11 h-11 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-[#5D5FEF]/5 group-hover:text-[#5D5FEF] transition-all">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wide mb-0.5">Location</p>
                    <p className="text-[14px] font-bold text-gray-700">
                      {file.category === 'media' ? 'Photos' : file.category === 'video_vault' ? 'Videos' : 'Files'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-[#FDFDFD] border-t border-gray-50">
        {/* Cast success toast */}
        {castSuccess && (
          <div className="mb-3 flex items-center gap-2 bg-[#F0F0FF] border border-[#5D5FEF]/20 text-[#5D5FEF] px-4 py-3 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-bold">Casting to {castSuccess}</span>
          </div>
        )}
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 bg-white border border-red-100 text-red-500 py-3.5 rounded-2xl hover:bg-red-50 hover:border-red-200 transition-all font-bold text-sm shadow-sm active:scale-95"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete File</span>
        </button>
      </div>
    </div>
  );
};

export default FileDetails;
