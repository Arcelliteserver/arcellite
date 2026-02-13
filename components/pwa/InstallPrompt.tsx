import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
      return;
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a delay (don't be too aggressive)
      const hasSeenPrompt = localStorage.getItem('pwa-install-prompt-seen');
      if (!hasSeenPrompt) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // For iOS, show instructions
      if (isIOS) {
        alert('To install this app on iOS:\n\n1. Tap the Share button\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add"');
        return;
      }
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user response
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      // User accepted
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
    localStorage.setItem('pwa-install-prompt-seen', 'true');
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-prompt-seen', 'true');
  };

  // Don't show if already installed or no prompt available
  if (isStandalone || !showPrompt || (!deferredPrompt && !isIOS)) {
    return null;
  }

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 md:left-auto md:right-4 md:w-96 z-[400] animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 md:p-6 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#5D5FEF]/10 to-transparent rounded-full blur-2xl" />
        
        <div className="relative z-10">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4 pr-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5D5FEF] to-[#4D4FCF] flex items-center justify-center flex-shrink-0 shadow-lg">
              {isIOS ? (
                <Smartphone className="w-6 h-6 text-white" />
              ) : (
                <Download className="w-6 h-6 text-white" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-black text-gray-900 mb-1">
                Install Arcellite
              </h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                {isIOS
                  ? 'Add Arcellite to your home screen for quick access and a better experience.'
                  : 'Install Arcellite as an app for faster access and offline support.'}
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 px-4 py-2.5 bg-[#5D5FEF] text-white rounded-xl font-bold text-sm hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 active:scale-95"
                >
                  {isIOS ? 'Show Instructions' : 'Install App'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2.5 bg-gray-50 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all active:scale-95"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;

