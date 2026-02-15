import React, { useEffect, useState } from 'react';

export interface ToastData {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  icon?: 'usb' | 'folder' | 'upload' | 'trash' | 'rename' | 'move' | 'ai' | 'copy' | 'download' | 'settings' | 'database' | 'key';
}

interface ToastProps {
  toast: ToastData;
  onDismiss: () => void;
  /** Position variant for mobile vs desktop */
  position?: 'bottom-center' | 'bottom-right';
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss, position = 'bottom-right' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
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

  // Color schemes per type — subtle, glassy
  const scheme = {
    success: {
      bg: 'bg-white/80',
      border: 'border-emerald-200/60',
      accent: 'bg-emerald-500',
      iconBg: 'bg-emerald-50 text-emerald-600',
      title: 'text-gray-800',
      message: 'text-gray-600',
      progressBar: 'bg-emerald-400/60',
      shadow: 'shadow-emerald-500/8',
    },
    error: {
      bg: 'bg-white/80',
      border: 'border-red-200/60',
      accent: 'bg-red-500',
      iconBg: 'bg-red-50 text-red-600',
      title: 'text-gray-800',
      message: 'text-gray-600',
      progressBar: 'bg-red-400/60',
      shadow: 'shadow-red-500/8',
    },
    info: {
      bg: 'bg-white/80',
      border: 'border-indigo-200/60',
      accent: 'bg-indigo-500',
      iconBg: 'bg-indigo-50 text-indigo-600',
      title: 'text-gray-800',
      message: 'text-gray-600',
      progressBar: 'bg-indigo-400/60',
      shadow: 'shadow-indigo-500/8',
    },
    warning: {
      bg: 'bg-white/80',
      border: 'border-amber-200/60',
      accent: 'bg-amber-500',
      iconBg: 'bg-amber-50 text-amber-600',
      title: 'text-gray-800',
      message: 'text-gray-600',
      progressBar: 'bg-amber-400/60',
      shadow: 'shadow-amber-500/8',
    },
  }[toast.type];

  const typeLabel = {
    success: 'Success',
    error: 'Error',
    info: 'Info',
    warning: 'Warning',
  }[toast.type];

  // Get icon based on explicit icon prop or fallback to type-based icon
  const renderIcon = () => {
    const iconClass = 'w-4.5 h-4.5';

    // Explicit contextual icons
    if (toast.icon === 'usb') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10m0 0l3-3m-3 3l-3-3M7 21h10a2 2 0 002-2v-3a2 2 0 00-2-2H7a2 2 0 00-2 2v3a2 2 0 002 2z" />
      </svg>
    );
    if (toast.icon === 'folder') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    );
    if (toast.icon === 'upload') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    );
    if (toast.icon === 'trash') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    );
    if (toast.icon === 'rename') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    );
    if (toast.icon === 'move') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    );
    if (toast.icon === 'ai') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    );
    if (toast.icon === 'copy') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
      </svg>
    );
    if (toast.icon === 'download') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    );
    if (toast.icon === 'settings') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
    if (toast.icon === 'database') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    );
    if (toast.icon === 'key') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    );

    // Fallback: type-based icons
    if (toast.type === 'success') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
    if (toast.type === 'error') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    );
    if (toast.type === 'warning') return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    );
    // info
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    );
  };

  const positionClasses = position === 'bottom-center'
    ? 'fixed bottom-20 left-4 right-4 z-[1000] flex justify-center'
    : 'fixed bottom-6 right-6 z-[1000]';

  return (
    <div className={positionClasses}>
      <div
        className={`
          relative overflow-hidden
          w-[340px] max-w-full
          ${scheme.bg} backdrop-blur-xl
          border ${scheme.border}
          rounded-xl
          shadow-lg ${scheme.shadow}
          transition-all duration-300 ease-out
          cursor-pointer
          ${isVisible && !isExiting
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-3 scale-95'
          }
        `}
        onClick={handleDismiss}
        role="alert"
      >
        {/* Left accent stripe */}
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${scheme.accent} rounded-l-xl`} />

        {/* Content */}
        <div className="flex items-start gap-3 pl-4 pr-3 py-3">
          {/* Icon */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${scheme.iconBg} flex items-center justify-center mt-0.5`}>
            {renderIcon()}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0 pr-1">
            <p className={`text-xs font-semibold ${scheme.title} tracking-wide uppercase opacity-60`}>
              {typeLabel}
            </p>
            <p className={`text-[13px] font-medium ${scheme.message} leading-snug mt-0.5 line-clamp-2`}>
              {toast.message}
            </p>
          </div>

          {/* Dismiss X */}
          <button
            onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
            className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 transition-colors mt-0.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Auto-dismiss progress bar */}
        <div className="h-[2px] bg-gray-100/50">
          <div
            className={`h-full ${scheme.progressBar} rounded-full`}
            style={{
              animation: 'toast-progress 3.7s linear forwards',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Toast;
