import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Shield } from 'lucide-react';

/* ── Background image pool (Pexels — rotates randomly each lock) ──────────── */
const BACKGROUNDS = [
  { url: 'https://images.pexels.com/photos/1072179/pexels-photo-1072179.jpeg?auto=compress&cs=tinysrgb&w=1920', credit: 'Cátia Matos', link: 'https://www.pexels.com/photo/green-leaves-1072179/' },
  { url: 'https://images.pexels.com/photos/1903702/pexels-photo-1903702.jpeg?auto=compress&cs=tinysrgb&w=1920', credit: 'Roberto Shumski', link: 'https://www.pexels.com/photo/scenic-photo-of-lake-surrounded-by-trees-1903702/' },
  { url: 'https://images.pexels.com/photos/34245721/pexels-photo-34245721.jpeg?auto=compress&cs=tinysrgb&w=1920', credit: 'Wyxina Tresse', link: 'https://www.pexels.com/photo/lush-green-coniferous-branches-texture-34245721/' },
  { url: 'https://images.pexels.com/photos/29905154/pexels-photo-29905154.jpeg?auto=compress&cs=tinysrgb&w=1920', credit: 'Wyxina Tresse', link: 'https://www.pexels.com/photo/close-up-of-yew-tree-branch-in-dark-green-setting-29905154/' },
  { url: 'https://images.pexels.com/photos/13775655/pexels-photo-13775655.jpeg?auto=compress&cs=tinysrgb&w=1920', credit: 'Wyxina Tresse', link: 'https://www.pexels.com/photo/dark-green-leaves-of-tree-13775655/' },
  { url: 'https://images.pexels.com/photos/531321/pexels-photo-531321.jpeg?auto=compress&cs=tinysrgb&w=1920', credit: 'Pixabay', link: 'https://www.pexels.com/photo/gray-asphalt-road-surrounded-by-tall-trees-531321/' },
  { url: 'https://images.pexels.com/photos/30803978/pexels-photo-30803978.jpeg?auto=compress&cs=tinysrgb&w=1920', credit: 'Mike Norris', link: 'https://www.pexels.com/photo/foggy-forest-path-in-milwaukee-30803978/' },
  { url: 'https://images.pexels.com/photos/10728751/pexels-photo-10728751.jpeg?auto=compress&cs=tinysrgb&w=1920', credit: 'Atahan Demir', link: 'https://www.pexels.com/photo/an-empty-road-between-green-trees-10728751/' },
  { url: 'https://images.pexels.com/photos/2387793/pexels-photo-2387793.jpeg?auto=compress&cs=tinysrgb&w=1920', credit: 'Adrien Olichon', link: 'https://www.pexels.com/photo/black-sand-dunes-2387793/' },
  { url: 'https://images.pexels.com/photos/247431/pexels-photo-247431.jpeg?auto=compress&cs=tinysrgb&w=1920', credit: 'Pixabay', link: 'https://www.pexels.com/photo/view-of-elephant-in-water-247431/' },
  { url: 'https://images.pexels.com/photos/20469733/pexels-photo-20469733.jpeg?auto=compress&cs=tinysrgb&w=1920', credit: 'Caleb Falkenhagen', link: 'https://www.pexels.com/photo/wolf-in-forest-20469733/' },
];

interface LockScreenProps {
  correctPin: string;
  onUnlock: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ correctPin, onUnlock }) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  // Pick a random background on each mount
  const bg = useMemo(() => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)], []);

  // Preload the background image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = bg.url;
  }, [bg.url]);

  const focusInput = useCallback(() => {
    hiddenInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(focusInput, 100);
    return () => clearTimeout(timer);
  }, [focusInput]);

  // Auto-check when 6 digits entered
  useEffect(() => {
    if (enteredPin.length === 6) {
      if (enteredPin === correctPin) {
        setIsSuccess(true);
        setTimeout(onUnlock, 500);
      } else {
        setIsWrong(true);
        setIsShaking(true);
        setTimeout(() => {
          setEnteredPin('');
          setIsShaking(false);
          setTimeout(() => setIsWrong(false), 150);
          focusInput();
        }, 600);
      }
    }
  }, [enteredPin, correctPin, onUnlock, focusInput]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setEnteredPin(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key.length === 1 && !/\d/.test(e.key)) e.preventDefault();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setEnteredPin(pasted);
    e.preventDefault();
  };

  // Clock
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = time.getHours() % 12 || 12;
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const ampm = time.getHours() >= 12 ? 'PM' : 'AM';
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden select-none"
      onClick={focusInput}
    >
      {/* ── Background image ────────────────────────────────────────────── */}
      <div className="absolute inset-0">
        {/* Dark base while image loads */}
        <div className="absolute inset-0 bg-[#080810]" />
        {/* Photo background with slow Ken Burns zoom */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1.5s]"
          style={{
            backgroundImage: `url("${bg.url}")`,
            opacity: bgLoaded ? 1 : 0,
            animation: bgLoaded ? 'lockZoom 30s ease-in-out infinite alternate' : undefined,
          }}
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.12) 35%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0.6) 100%)',
        }} />
        {/* Vignette */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.45) 100%)',
        }} />
      </div>

      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-10px)} 40%{transform:translateX(10px)} 60%{transform:translateX(-7px)} 80%{transform:translateX(7px)} }
        @keyframes dotPop { 0%{transform:scale(0.3);opacity:0.2} 50%{transform:scale(1.3)} 100%{transform:scale(1);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lockZoom { from{transform:scale(1)} to{transform:scale(1.06)} }
        .dot-pop { animation: dotPop 0.22s ease-out forwards; }
        .lock-fade-up { animation: fadeUp 0.9s ease-out both; }
        .lock-fade-up-d1 { animation: fadeUp 0.9s 0.15s ease-out both; }
        .lock-fade-up-d2 { animation: fadeUp 0.9s 0.3s ease-out both; }
      `}</style>

      {/* Hidden input */}
      <input
        ref={hiddenInputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={enteredPin}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="sr-only"
        aria-label="Enter PIN"
        autoFocus
      />

      {/* ── Content layout ──────────────────────────────────────────────── */}
      <div className="relative z-10 h-full flex flex-col items-center justify-between py-20">

        {/* ── Top: Clock ──────────────────────────────────────────────── */}
        <div className="text-center lock-fade-up">
          <div className="text-[6.5rem] font-[200] text-white tracking-tight tabular-nums leading-none"
            style={{ textShadow: '0 4px 60px rgba(0,0,0,0.35)' }}>
            {hours}:{minutes}
            <span className="text-3xl font-light text-white/45 ml-3 align-top mt-4 inline-block">{ampm}</span>
          </div>
          <div className="text-[15px] text-white/45 font-light mt-3 tracking-wide" style={{ textShadow: '0 1px 10px rgba(0,0,0,0.3)' }}>
            {dateStr}
          </div>
        </div>

        {/* ── Center: Lock Card ─────────────────────────────────────── */}
        <div className="lock-fade-up-d1"
          style={isShaking ? { animation: 'shake 0.45s ease-in-out' } : undefined}>
          <div className="flex flex-col items-center">
            {/* Glass card */}
            <div className="rounded-[28px] px-16 py-12 flex flex-col items-center"
              style={{
                background: 'rgba(0,0,0,0.38)',
                backdropFilter: 'blur(64px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(64px) saturate(1.4)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 12px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}>

              {/* Shield icon */}
              <div className="mb-7">
                <div className={`w-20 h-20 rounded-[20px] flex items-center justify-center transition-all duration-400 ${
                  isSuccess
                    ? 'bg-emerald-500/20 border border-emerald-400/25 shadow-[0_0_40px_rgba(52,211,153,0.12)]'
                    : isWrong
                    ? 'bg-red-500/15 border border-red-400/20'
                    : 'bg-white/[0.05] border border-white/[0.08]'
                }`} style={{ backdropFilter: 'blur(20px)' }}>
                  <Shield className={`w-10 h-10 transition-colors duration-300 ${
                    isSuccess ? 'text-emerald-400' :
                    isWrong ? 'text-red-400' :
                    'text-white/65'
                  }`} />
                </div>
              </div>

              {/* Title */}
              <h1 className="text-[22px] font-semibold text-white mb-1.5 tracking-tight">Session Locked</h1>
              <p className={`text-sm mb-9 transition-colors duration-200 ${
                isWrong ? 'text-red-400' : 'text-white/35'
              }`}>
                {isWrong ? 'Incorrect PIN — try again' : 'Enter your 6-digit PIN to continue'}
              </p>

              {/* PIN Dots */}
              <div className="flex gap-[22px] mb-10 cursor-text" onClick={focusInput}>
                {Array.from({ length: 6 }).map((_, i) => {
                  const isFilled = i < enteredPin.length;
                  const isActive = i === enteredPin.length;
                  return (
                    <div key={i} className="relative flex items-center justify-center w-[22px] h-[22px]">
                      <div className={`rounded-full transition-all duration-200 ${
                        isSuccess
                          ? 'w-[18px] h-[18px] bg-emerald-400'
                          : isWrong
                          ? 'w-[18px] h-[18px] bg-red-400'
                          : isFilled
                          ? 'w-[18px] h-[18px] bg-white dot-pop'
                          : isActive
                          ? 'w-[14px] h-[14px] bg-white/15 ring-[2.5px] ring-white/25'
                          : 'w-[14px] h-[14px] bg-white/10'
                      }`} />
                    </div>
                  );
                })}
              </div>

              {/* Brand */}
              <div className="flex items-center gap-2 opacity-20">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="text-xs text-white font-medium tracking-[0.2em] uppercase">Arcellite</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom: Photo credit ────────────────────────────────────── */}
        <div className="lock-fade-up-d2">
          <a
            href={bg.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-white/20 hover:text-white/35 transition-colors duration-300 tracking-wide"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            Photo by {bg.credit} · Pexels
          </a>
        </div>
      </div>
    </div>
  );
};

export default LockScreen;
