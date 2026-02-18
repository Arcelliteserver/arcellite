import React, { useEffect, useState } from 'react';
import { ShieldX, Cloud } from 'lucide-react';

export default function MobileAccessDeniedView() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-[#5D5FEF]/10 via-white to-[#5D5FEF]/5 overflow-hidden relative flex items-center justify-center p-5 safe-area-pb">
      {/* Soft clouds */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-56 h-20 rounded-full bg-white/40 blur-2xl"
          style={{
            top: '15%',
            left: '5%',
            transform: mounted ? 'translate(0, 0) scale(1)' : 'translate(-15px, -8px) scale(0.95)',
            opacity: mounted ? 1 : 0,
            transition: 'transform 1.5s ease-out, opacity 1s',
          }}
        />
        <div
          className="absolute w-40 h-16 rounded-full bg-[#5D5FEF]/12 blur-xl"
          style={{
            top: '55%',
            right: '8%',
            transform: mounted ? 'translate(0, 0) scale(1)' : 'translate(12px, 6px) scale(0.95)',
            opacity: mounted ? 1 : 0,
            transition: 'transform 1.4s ease-out 0.1s, opacity 1s',
          }}
        />
        <Cloud
          className="absolute w-14 h-14 text-white/40"
          style={{ top: '20%', right: '12%', transition: 'transform 1s ease-out, opacity 0.8s' }}
        />
        <Cloud
          className="absolute w-10 h-10 text-[#5D5FEF]/15"
          style={{ bottom: '28%', left: '10%', transition: 'transform 1.1s ease-out 0.15s, opacity 0.8s' }}
        />
      </div>

      <div
        className={`relative z-10 w-full max-w-sm transition-all duration-600 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-[1.75rem] border border-gray-100/80 shadow-xl shadow-[#5D5FEF]/10 p-7 sm:p-8 text-center">
          <div
            className={`mx-auto rounded-2xl bg-gradient-to-br from-[#5D5FEF]/15 to-[#5D5FEF]/5 border border-[#5D5FEF]/20 flex items-center justify-center mb-5 transition-all duration-500 ${mounted ? 'scale-100' : 'scale-90'}`}
            style={{ width: 72, height: 72 }}
          >
            <ShieldX className="w-9 h-9 text-[#5D5FEF]" strokeWidth={2} />
          </div>

          <h1 className="text-lg sm:text-xl font-black text-gray-900 mb-2 tracking-tight">
            You can&apos;t access this page
          </h1>
          <p className="text-[13px] sm:text-sm text-gray-500 font-medium mx-auto leading-relaxed">
            Your current network or device isn&apos;t authorized. Contact your administrator if this is an error.
          </p>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-4 font-medium">
          Restricted by IP allowlist (Strict Isolation)
        </p>
      </div>
    </div>
  );
}
