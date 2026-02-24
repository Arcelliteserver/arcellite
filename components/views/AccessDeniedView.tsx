import React, { useEffect, useState } from 'react';
import { ShieldX, Cloud } from 'lucide-react';

export default function AccessDeniedView() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5D5FEF]/8 via-white to-[#5D5FEF]/5 overflow-hidden relative flex items-center justify-center p-6 sm:p-8">
      {/* Soft clouds (decorative) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-64 h-24 sm:w-80 sm:h-28 rounded-full bg-white/40 blur-2xl transition-all duration-[2000ms] ease-out"
          style={{
            top: '12%',
            left: '8%',
            transform: mounted ? 'translate(0, 0) scale(1)' : 'translate(-20px, -10px) scale(0.95)',
            opacity: mounted ? 1 : 0,
          }}
        />
        <div
          className="absolute w-48 h-20 sm:w-56 sm:h-24 rounded-full bg-[#5D5FEF]/10 blur-xl transition-all duration-[2000ms] ease-out delay-150"
          style={{
            top: '60%',
            right: '10%',
            transform: mounted ? 'translate(0, 0) scale(1)' : 'translate(15px, 8px) scale(0.95)',
            opacity: mounted ? 1 : 0,
          }}
        />
        <div
          className="absolute w-40 h-16 sm:w-52 sm:h-20 rounded-full bg-white/30 blur-xl transition-all duration-[2000ms] ease-out delay-300"
          style={{
            bottom: '20%',
            left: '15%',
            transform: mounted ? 'translate(0, 0) scale(1)' : 'translate(10px, -5px) scale(0.95)',
            opacity: mounted ? 1 : 0,
          }}
        />
        {/* Subtle cloud icons */}
        <Cloud
          className="absolute w-16 h-16 sm:w-20 sm:h-20 text-white/50"
          style={{ top: '18%', right: '18%', transform: mounted ? 'translateY(0)' : 'translateY(-8px)', transition: 'transform 1.2s ease-out, opacity 0.8s' }}
        />
        <Cloud
          className="absolute w-12 h-12 sm:w-14 sm:h-14 text-[#5D5FEF]/20"
          style={{ bottom: '25%', right: '22%', transform: mounted ? 'translateY(0)' : 'translateY(6px)', transition: 'transform 1s ease-out 0.2s, opacity 0.8s' }}
        />
      </div>

      <div
        className={`relative z-10 w-full max-w-md transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      >
        <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100/80 shadow-2xl shadow-[#5D5FEF]/10 p-8 sm:p-10 md:p-12 text-center">
          {/* Icon */}
          <div
            className={`mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-[#5D5FEF]/15 to-[#5D5FEF]/5 border border-[#5D5FEF]/20 flex items-center justify-center mb-6 sm:mb-8 transition-all duration-500 ${mounted ? 'scale-100' : 'scale-90'}`}
          >
            <ShieldX className="w-10 h-10 sm:w-12 sm:h-12 text-[#5D5FEF]" strokeWidth={2} />
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-gray-900 mb-2 sm:mb-3 tracking-tight">
            You can&apos;t access this page
          </h1>
          <p className="text-sm sm:text-base text-gray-500 font-medium max-w-sm mx-auto leading-relaxed">
            Your current network or device isn&apos;t authorized to access Arcellite. If you believe this is an error, contact your administrator.
          </p>
        </div>

        <p className="text-center text-[11px] sm:text-xs text-gray-400 mt-6 font-medium">
          Access is restricted by IP allowlist (Strict Isolation)
        </p>
      </div>
    </div>
  );
}
