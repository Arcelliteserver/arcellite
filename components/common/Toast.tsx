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

  // Border color based on type — error gets red, rest use the app's purple
  const borderColor = toast.type === 'error'
    ? 'border-red-400'
    : 'border-[#5D5FEF]';

  const positionClasses = position === 'bottom-center'
    ? 'fixed bottom-20 left-4 right-4 z-[1000] flex justify-center'
    : 'fixed bottom-6 right-6 z-[1000]';

  return (
    <div className={positionClasses}>
      <div
        className={`
          bg-white backdrop-blur-sm
          border ${borderColor}
          rounded-lg
          shadow-md
          px-4 py-2.5
          transition-all duration-300 ease-out
          cursor-pointer
          ${isVisible && !isExiting
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-3'
          }
        `}
        onClick={handleDismiss}
        role="alert"
      >
        <p className={`text-[13px] font-medium leading-snug ${
          toast.type === 'error' ? 'text-red-600' : 'text-gray-700'
        }`}>
          {toast.message}
        </p>
      </div>
    </div>
  );
};

export default Toast;
