import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { FileItem } from '@/types';

const SEEK_SEC = 10;

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface GlobalMusicPlayerProps {
  file: FileItem;
  onClose: () => void;
}

const GlobalMusicPlayer: React.FC<GlobalMusicPlayerProps> = ({ file, onClose }) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const title = file.name.replace(/^\d{13}_/, '').replace(/_/g, ' ');

  useEffect(() => {
    if (!file?.url) return;
    const el = audioRef.current;
    if (!el) return;

    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onDurationChange = () => {
      setDuration(el.duration);
      setReady(true);
    };
    const onEnded = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [file?.id, file?.url]);

  // Auto-play when mounted (user already clicked play in File Details)
  useEffect(() => {
    if (!file?.url) return;
    const el = audioRef.current;
    if (el) el.play().catch(() => {});
  }, [file?.id]);

  // Media Session API
  useEffect(() => {
    if (!file || !file.url || !('mediaSession' in navigator)) return;
    const artworkUrl = `${window.location.origin}/images/music_placeholder.png`;
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: 'Arcellite',
      album: 'My Music',
      artwork: [
        { src: artworkUrl, sizes: '512x512', type: 'image/png' },
        { src: artworkUrl, sizes: '256x256', type: 'image/png' },
      ],
    });
    navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - SEEK_SEC);
    });
    navigator.mediaSession.setActionHandler('seekforward', () => {
      if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + SEEK_SEC);
    });
    return () => {
      navigator.mediaSession.metadata = null;
      ['play', 'pause', 'seekbackward', 'seekforward'].forEach(a =>
        (navigator.mediaSession as any).setActionHandler(a, null)
      );
    };
  }, [file?.id, title]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, [playing]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play();
  };

  const seekBack = () => {
    if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - SEEK_SEC);
  };

  const seekForward = () => {
    if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + SEEK_SEC);
  };

  const onProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    el.currentTime = p * el.duration;
  };

  if (!file.url) return null;

  const playerEl = (
    <>
      <audio ref={audioRef} src={file.url} preload="metadata" />
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9000] flex items-center gap-4 px-5 py-3 rounded-2xl bg-[#1d1d1f] border border-[#3a3a3d] shadow-xl shadow-black/30 max-w-lg w-[calc(100%-2rem)] animate-in slide-in-from-bottom duration-300"
        role="region"
        aria-label="Music player"
      >
        {/* Artwork */}
        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
          <img src="/images/music_placeholder.png" alt="" className="w-full h-full object-cover" />
        </div>

        {/* Title + progress */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{title}</p>
          <div
            className="mt-1.5 h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer"
            onClick={onProgressClick}
          >
            <div
              className="h-full bg-[#5D5FEF] rounded-full transition-all"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between mt-0.5 text-[10px] text-white/50 font-medium">
            <span>{formatTime(currentTime)}</span>
            <span>{ready ? formatTime(duration) : '--:--'}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={seekBack}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Seek back 10 seconds"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="p-3 rounded-full bg-[#5D5FEF] text-white hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/30"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={seekForward}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Seek forward 10 seconds"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
          aria-label="Close player"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(playerEl, document.body) : null;
};

export default GlobalMusicPlayer;
