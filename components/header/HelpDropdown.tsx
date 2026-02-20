import React, { useRef, useEffect, useState, useCallback } from 'react';
import { HelpCircle, MessageSquare, Server, Cpu, HardDrive, Book } from 'lucide-react';

interface SystemInfo {
  version: string;
  hostname: string;
  platform: string;
  uptime: string;
  cpuModel: string;
  cpuCores: number;
  totalMemory: string;
  nodeVersion: string;
}

interface HelpDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

const HelpDropdown: React.FC<HelpDropdownProps> = ({ isOpen, onClose, onNavigate }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSystemInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/system/info');
      if (res.ok) {
        const data = await res.json();
        setSystemInfo(data);
      }
    } catch (e) {
      // Silent — system info is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchSystemInfo();
    }
  }, [isOpen, fetchSystemInfo]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleNavigate = (tab: string) => {
    onNavigate(tab);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-auto sm:mt-3 w-[calc(100vw-1rem)] sm:w-80 max-w-sm sm:max-w-none bg-white rounded-2xl sm:rounded-[2rem] shadow-2xl shadow-gray-200 border border-gray-100 py-3 z-[500] animate-in fade-in zoom-in duration-200 origin-top-right overflow-hidden" ref={dropdownRef}>
      <div className="px-6 py-4 bg-[#F5F5F7]/50 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5D5FEF]/10 rounded-2xl flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-[#5D5FEF]" />
          </div>
          <div>
            <p className="text-[15px] font-black text-gray-900">Help & Support</p>
            <p className="text-[11px] font-bold text-gray-400">System Information</p>
          </div>
        </div>
      </div>

      {/* System Info */}
      {!loading && systemInfo && (
        <div className="px-4 py-4 space-y-3 border-b border-gray-50">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium text-gray-600">Hostname</span>
            </div>
            <span className="font-bold text-gray-900 text-[11px]">{systemInfo.hostname}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium text-gray-600">CPU</span>
            </div>
            <span className="font-bold text-gray-900 text-[11px]">{systemInfo.cpuCores} cores</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium text-gray-600">Memory</span>
            </div>
            <span className="font-bold text-gray-900 text-[11px]">{systemInfo.totalMemory}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-600">Uptime</span>
            <span className="font-bold text-gray-900 text-[11px]">{systemInfo.uptime}</span>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 text-center">
              {systemInfo.version}
            </p>
          </div>
        </div>
      )}

      <div className="px-2 py-2 space-y-1">
        <button
          onClick={() => handleNavigate('documentation')}
          className="flex items-center gap-3 sm:gap-4 w-full px-4 sm:px-5 py-3 hover:bg-[#F5F5F7] transition-all text-left group rounded-xl sm:rounded-2xl min-h-[44px]"
        >
          <Book className="w-4 h-4 sm:w-4 sm:h-4 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
          <span className="text-sm sm:text-[14px] font-bold text-gray-700 group-hover:text-[#5D5FEF]">Documentation</span>
        </button>
        <button
          onClick={() => handleNavigate('help')}
          className="flex items-center gap-3 sm:gap-4 w-full px-4 sm:px-5 py-3 hover:bg-[#F5F5F7] transition-all text-left group rounded-xl sm:rounded-2xl min-h-[44px]"
        >
          <MessageSquare className="w-4 h-4 sm:w-4 sm:h-4 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
          <span className="text-sm sm:text-[14px] font-bold text-gray-700 group-hover:text-[#5D5FEF]">Contact Support</span>
        </button>
        <button
          onClick={() => handleNavigate('server')}
          className="flex items-center gap-3 sm:gap-4 w-full px-4 sm:px-5 py-3 hover:bg-[#F5F5F7] transition-all text-left group rounded-xl sm:rounded-2xl min-h-[44px]"
        >
          <Server className="w-4 h-4 sm:w-4 sm:h-4 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
          <span className="text-sm sm:text-[14px] font-bold text-gray-700 group-hover:text-[#5D5FEF]">Server Status</span>
        </button>
      </div>
    </div>
  );
};

export default HelpDropdown;
