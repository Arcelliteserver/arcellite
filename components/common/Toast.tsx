import React, { useEffect, useState } from 'react';

export interface ToastData {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  icon?: 'usb' | 'folder' | 'upload' | 'trash' | 'rename' | 'move' | 'ai' | 'copy' | 'download' | 'settings' | 'database' | 'key';
}

interface ToastProps {
  toast: ToastData;
  onDismiss: () => void;
  position?: 'bottom-center' | 'bottom-right';
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss, position = 'bottom-right' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onDismiss, 300);
    }, 3700);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  };

  const positionClasses = position === 'bottom-center'
    ? 'fixed bottom-20 left-4 right-4 z-[1000] flex justify-center'
    : 'fixed bottom-6 right-6 z-[1000]';

  return (
    <div className={positionClasses}>
      <div
        className={`
          bg-[#1f1f1f] 
          rounded-lg
          shadow-2xl
          flex items-center gap-4
          pl-5 pr-2 py-3.5
          min-w-[320px] max-w-[440px]
          transition-all duration-300 ease-out
          ${isVisible && !isExiting
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
          }
        `}
        role="alert"
      >
        {/* Message */}
        <p className="text-white text-[14px] font-normal leading-snug flex-1">
          {toast.message}
        </p>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="text-white/70 hover:text-white text-[13px] font-medium px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors flex-shrink-0"
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default Toast;
