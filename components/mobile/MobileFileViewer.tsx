import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Share2,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Tv,
  Cast,
  Check,
  Info,
  Loader2,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { FileItem } from '../../types';
import FileIcon from '../files/FileIcon';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/* ─── Inline PDF Reader Component ─── */
const MobilePdfReader: React.FC<{ url: string; title: string }> = ({ url, title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const renderPdf = async () => {
      try {
        setLoadingPdf(true);
        setError(null);
        const pdf = await pdfjsLib.getDocument({ url, disableAutoFetch: false, disableStream: false }).promise;
        if (cancelled) return;
        setTotalPages(pdf.numPages);

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        // Render all pages sequentially
        const containerWidth = container.clientWidth;

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) break;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          // Scale to fit container width with some padding
          const scale = (containerWidth - 16) / viewport.width;
          const scaledViewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = scaledViewport.width * window.devicePixelRatio;
          canvas.height = scaledViewport.height * window.devicePixelRatio;
          canvas.style.width = `${scaledViewport.width}px`;
          canvas.style.height = `${scaledViewport.height}px`;
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto 12px auto';
          canvas.style.borderRadius = '4px';
          canvas.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';

          const ctx = canvas.getContext('2d')!;
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

          // Page number label
          const label = document.createElement('div');
          label.textContent = `Page ${i} of ${pdf.numPages}`;
          label.style.cssText = 'text-align:center;font-size:10px;font-weight:700;color:#aaa;margin-bottom:8px;letter-spacing:0.05em;';

          container.appendChild(canvas);
          container.appendChild(label);

          await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        }
      } catch (e) {
        if (!cancelled) {
          setError('Could not load PDF');
          console.error('[PDF Reader]', e);
        }
      } finally {
        if (!cancelled) setLoadingPdf(false);
      }
    };

    renderPdf();
    return () => { cancelled = true; };
  }, [url]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-white/50 text-sm font-bold">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-100 rounded-t-2xl overflow-hidden">
      {loadingPdf && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-[#5D5FEF] animate-spin" />
          <span className="text-gray-500 text-xs font-bold ml-2">Loading PDF...</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-2 py-4"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      />
    </div>
  );
};

const CAST_DEVICES = [
  { key: 'gaming_tv', label: 'GamingTV TV', icon: Tv },
  { key: 'smart_tv', label: 'SmartTV 4K', icon: Monitor },
  { key: 'my_room', label: 'My Room Display', subtitle: 'Nest Hub', iconSvg: true },
  { key: 'space_tv', label: 'Space TV', subtitle: 'Chromecast', icon: Cast, isDefault: true },
];

interface MobileFileViewerProps {
  file: FileItem;
  files: FileItem[]; // all files in current view for swiping
  onClose: () => void;
  onDelete: (file: FileItem) => void;
  onFileChange: (file: FileItem) => void; // navigate to adjacent file
}

const MobileFileViewer: React.FC<MobileFileViewerProps> = ({
  file,
  files,
  onClose,
  onDelete,
  onFileChange,
}) => {
  const [showControls, setShowControls] = useState(true);
  const [showCastMenu, setShowCastMenu] = useState(false);
  const [casting, setCasting] = useState(false);
  const [castSuccess, setCastSuccess] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Touch/swipe state
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchDeltaX = useRef(0);
  const isSwiping = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find current index among non-folder files
  const viewableFiles = files.filter(f => !f.isFolder);
  const currentIndex = viewableFiles.findIndex(f => f.id === file.id);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < viewableFiles.length - 1;

  const isImage = file.type === 'image';
  const isVideo = file.type === 'video';
  const isAudio = file.type === 'audio';
  const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'pdf';

  // Determine clean title
  const cleanTitle = file.name.replace(/^\d{13}_/, '').replace(/_/g, ' ');

  // Auto-hide controls after 3s
  useEffect(() => {
    if (!showControls) return;
    const timer = setTimeout(() => {
      if (!showCastMenu && !showDetails) {
        setShowControls(false);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [showControls, showCastMenu, showDetails]);

  // Handle swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDeltaX.current = 0;
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    touchDeltaX.current = dx;

    // Determine if horizontal swipe (lock once decided)
    if (!isSwiping.current && Math.abs(dx) > 10) {
      if (Math.abs(dx) > Math.abs(dy) * 1.5) {
        isSwiping.current = true;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return;

    const swipeThreshold = 60;
    if (touchDeltaX.current < -swipeThreshold && hasNext) {
      onFileChange(viewableFiles[currentIndex + 1]);
    } else if (touchDeltaX.current > swipeThreshold && hasPrev) {
      onFileChange(viewableFiles[currentIndex - 1]);
    }
    isSwiping.current = false;
    touchDeltaX.current = 0;
  }, [currentIndex, hasNext, hasPrev, viewableFiles, onFileChange]);

  // Toggle controls on tap
  const handleContentTap = useCallback(() => {
    if (isSwiping.current) return;
    setShowControls(prev => !prev);
    setShowCastMenu(false);
    setShowDetails(false);
  }, []);

  // Get file URL for serving — must be a full absolute URL for cast devices
  const getFileUrl = () => {
    if (file.url) {
      return window.location.origin + file.url;
    }
    return '';
  };
  const getMimeType = () => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
      mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
      mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', aac: 'audio/aac',
    };
    return mimeMap[ext || ''] || 'application/octet-stream';
  };

  // Cast — use webhook proxy to avoid CORS issues on phone
  const handleCast = async (deviceKey: string) => {
    setCasting(true);
    setShowCastMenu(false);
    try {
      const deviceLabel = CAST_DEVICES.find(d => d.key === deviceKey)?.label || deviceKey;
      const webhookUrl = 'https://n8n.arcelliteserver.com/webhook/castc35483a5';
      const payload = {
        fileName: file.name,
        fileType: file.type,
        fileUrl: getFileUrl(),
        mimeType: getMimeType(),
        device: deviceKey,
      };
      // Try direct first, fall back to proxy
      try {
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error('Direct failed');
      } catch {
        // Use server-side proxy
        await fetch('/api/apps/webhook-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl,
            method: 'POST',
            payload,
          }),
        });
      }
      setCastSuccess(deviceLabel);
      setTimeout(() => setCastSuccess(null), 3000);
    } catch (error) {
      // Cast failed silently
    } finally {
      setCasting(false);
    }
  };

  // Share
  const handleShare = async () => {
    const shareUrl = getFileUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: cleanTitle, url: shareUrl });
      } catch {
        // cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        // fallback failed
      }
    }
  };

  // Download
  const handleDownload = () => {
    if (!file.url) return;
    const downloadUrl = file.url.replace('/serve?', '/download?');
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete
  const handleDelete = () => {
    onDelete(file);
    onClose();
  };

  // Navigate with arrow buttons
  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPrev) onFileChange(viewableFiles[currentIndex - 1]);
  };
  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasNext) onFileChange(viewableFiles[currentIndex + 1]);
  };

  const canCast = isImage || isVideo;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[600] bg-black flex flex-col animate-in fade-in duration-200"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        <div className="bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-[env(safe-area-inset-top)] px-4 pb-8">
          <div className="flex items-center justify-between h-14">
            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center active:scale-90 transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* File counter */}
            {viewableFiles.length > 1 && (
              <div className="bg-white/10 backdrop-blur-xl px-3 py-1.5 rounded-full">
                <span className="text-white/90 text-xs font-bold">
                  {currentIndex + 1} / {viewableFiles.length}
                </span>
              </div>
            )}

            {/* Cast button */}
            <div className="relative">
              {canCast ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCastMenu(!showCastMenu); }}
                  disabled={casting}
                  className={`w-10 h-10 rounded-full backdrop-blur-xl flex items-center justify-center active:scale-90 transition-all ${
                    casting || showCastMenu ? 'bg-[#5D5FEF]' : 'bg-white/10'
                  }`}
                >
                  {casting ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                    </svg>
                  )}
                </button>
              ) : (
                <div className="w-10 h-10" /> // Spacer
              )}

              {/* Cast dropdown */}
              {showCastMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#1a1a2e]/95 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Cast to Device</p>
                  </div>
                  <div className="p-2">
                    {CAST_DEVICES.map((device) => {
                      const DeviceIcon = device.icon;
                      return (
                        <button
                          key={device.key}
                          onClick={(e) => { e.stopPropagation(); handleCast(device.key); }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 transition-all text-left active:scale-95"
                        >
                          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                            {'iconSvg' in device && device.iconSvg ? (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="w-5 h-5" fill="currentColor" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                <path d="M480-200q-99 0-169.5-13.5T240-246v-34h-73q-35 0-59-26t-21-61l27-320q2-31 25-52t55-21h572q32 0 55 21t25 52l27 320q3 35-21 61t-59 26h-73v34q0 19-70.5 32.5T480-200ZM167-360h626l-27-320H194l-27 320Zm313-160Z"/>
                              </svg>
                            ) : DeviceIcon ? (
                              <DeviceIcon className="w-4 h-4 text-white/70" />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{device.label}</p>
                            {'subtitle' in device && device.subtitle && (
                              <p className="text-[11px] text-white/40 font-medium">{device.subtitle}</p>
                            )}
                          </div>
                          {'isDefault' in device && device.isDefault && (
                            <span className="text-[9px] font-black text-[#5D5FEF] bg-[#5D5FEF]/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Default</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content — tappable area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden" onClick={handleContentTap}>
        {isImage ? (
          file.url ? (
            <img
              src={file.url}
              alt={cleanTitle}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <FileIcon type={file.type} className="w-24 h-24 text-white/30" />
              <p className="text-white/40 text-sm font-medium">Preview unavailable</p>
            </div>
          )
        ) : isVideo ? (
          file.url ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                src={file.url}
                controls
                playsInline
                autoPlay
                className="max-w-full max-h-full object-contain"
                preload="auto"
                onClick={(e) => e.stopPropagation()}
                onPlay={() => setShowControls(false)}
              />
              {/* Tap zones at top and bottom edges to bring back overlay controls */}
              {!showControls && (
                <>
                  <div
                    className="absolute top-0 left-0 right-0 h-12"
                    onClick={(e) => { e.stopPropagation(); setShowControls(true); }}
                  />
                  <div
                    className="absolute bottom-0 left-0 right-0 h-12"
                    onClick={(e) => { e.stopPropagation(); setShowControls(true); }}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <FileIcon type={file.type} className="w-24 h-24 text-white/30" />
              <p className="text-white/40 text-sm font-medium">Preview unavailable</p>
            </div>
          )
        ) : isAudio ? (
          <div className="flex flex-col items-center gap-6 px-8 w-full">
            <div className="w-40 h-40 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center">
              <FileIcon type={file.type} className="w-20 h-20 text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg mb-1">{cleanTitle}</p>
              <p className="text-white/40 text-sm">{file.size}</p>
            </div>
            {file.url && (
              <audio
                src={file.url}
                controls
                className="w-full max-w-sm"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        ) : isPdf && file.url ? (
          <MobilePdfReader url={file.url} title={cleanTitle} />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center">
              <FileIcon type={file.type} className="w-16 h-16 text-white/50" fileName={file.name} />
            </div>
            <p className="text-white font-bold text-lg text-center px-8">{cleanTitle}</p>
            <p className="text-white/40 text-sm">{file.size}</p>
          </div>
        )}

        {/* Swipe arrow indicators (edge taps) */}
        {hasPrev && (
          <button
            onClick={goPrev}
            className={`absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur flex items-center justify-center transition-opacity duration-300 ${
              showControls ? 'opacity-70' : 'opacity-0 pointer-events-none'
            }`}
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={goNext}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur flex items-center justify-center transition-opacity duration-300 ${
              showControls ? 'opacity-70' : 'opacity-0 pointer-events-none'
            }`}
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      {/* Bottom Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
        }`}
      >
        <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-8 pb-[env(safe-area-inset-bottom)]">
          {/* File info */}
          <div className="mb-4">
            <p className="text-white font-bold text-base truncate">{cleanTitle}</p>
            <p className="text-white/50 text-xs mt-0.5">{file.size} • {file.modified}</p>
          </div>

          {/* Cast success */}
          {castSuccess && (
            <div className="mb-3 flex items-center gap-2 bg-[#5D5FEF]/90 text-white px-4 py-2.5 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-bold">Casting to {castSuccess}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-around py-3">
            <button
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              className="flex flex-col items-center gap-1.5 active:scale-90 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-bold text-white/70">Share</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(); }}
              className="flex flex-col items-center gap-1.5 active:scale-90 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <Download className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-bold text-white/70">Download</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
              className="flex flex-col items-center gap-1.5 active:scale-90 transition-all"
            >
              <div className={`w-12 h-12 rounded-2xl backdrop-blur flex items-center justify-center ${showDetails ? 'bg-[#5D5FEF]' : 'bg-white/10'}`}>
                <Info className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-bold text-white/70">Details</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              className="flex flex-col items-center gap-1.5 active:scale-90 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-[10px] font-bold text-white/70">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Details panel (slides up) */}
      {showDetails && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 animate-in slide-in-from-bottom duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[#1a1a2e]/95 backdrop-blur-2xl rounded-t-3xl border-t border-white/10 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="text-white font-bold text-base">File Details</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Name</p>
                <p className="text-white font-medium text-sm">{file.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Size</p>
                <p className="text-white font-medium text-sm">{file.size || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Modified</p>
                <p className="text-white font-medium text-sm">{file.modified}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Location</p>
                <p className="text-white font-medium text-sm">
                  {file.category === 'media' ? 'Photos' : file.category === 'video_vault' ? 'Videos' : file.category === 'music' ? 'Music' : 'Files'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Type</p>
                <p className="text-white font-medium text-sm">{file.name.split('.').pop()?.toUpperCase() || file.type.toUpperCase()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileFileViewer;
