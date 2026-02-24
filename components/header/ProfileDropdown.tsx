import React, { useRef, useEffect, useState } from 'react';
import {
  User,
  LogOut,
  HardDrive,
  Wand2,
  Fingerprint,
  Monitor,
  Brain,
  ShieldCheck,
  Globe,
  Download,
  History,
  ArrowUpCircle,
} from 'lucide-react';
import type { UserData } from '@/types';

interface ProfileDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAccountSettings: () => void;
  onSecurityVault: () => void;
  onNavigate?: (tab: string) => void;
  onSignOut?: () => void;
  user?: UserData | null;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  isOpen,
  onToggle,
  onClose,
  onAccountSettings,
  onSecurityVault,
  onNavigate,
  onSignOut,
  user,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [storageText, setStorageText] = useState<string>('');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem('sessionToken');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Storage info
    fetch('/api/system/storage', { headers })
      .then(r => r.json())
      .then(data => {
        if (data.familyMemberStorage) {
          const { usedHuman, quotaHuman } = data.familyMemberStorage;
          setStorageText(`${usedHuman} / ${quotaHuman} used`);
        } else if (data.rootStorage) {
          const { usedHuman, totalHuman } = data.rootStorage;
          setStorageText(`${usedHuman} / ${totalHuman} used`);
        }
      })
      .catch(() => {});

    // Update check (uses 1hr server cache — fast)
    fetch('/api/update/check', { headers })
      .then(r => r.json())
      .then(data => {
        setUpdateVersion(data.updateAvailable ? data.latestVersion : null);
      })
      .catch(() => {});
  }, [isOpen]);

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

  const handleMenuItemClick = (action: () => void) => {
    action();
    onClose();
  };

  const handleTabNavigate = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
      onClose();
    }
  };

  if (!isOpen) return null;

  const isFamilyMember = user?.isFamilyMember === true;

  return (
    <>
      {/* Unified Dropdown - Fixed on mobile, absolute on desktop */}
      <div className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-auto sm:mt-3 w-[320px] sm:w-[360px] max-w-[calc(100vw-1rem)] sm:max-w-none bg-white rounded-2xl sm:rounded-[2rem] border border-gray-200 shadow-md shadow-gray-900/5 py-3 z-[9999] animate-in fade-in zoom-in duration-200 origin-top-right overflow-hidden" ref={dropdownRef}>
        <div className="px-6 py-5 bg-[#F5F5F7]/50 border-b border-gray-50 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-sm flex-shrink-0" alt="User" />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-[#5D5FEF] flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0">
                <span className="text-white font-black text-lg">{user?.firstName?.[0]?.toUpperCase() || 'A'}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-black text-gray-900 truncate">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || 'User'}
              </p>
              <p className="text-[11px] font-bold text-gray-400 truncate">
                {user?.email || ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 sm:hidden"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-2 space-y-0.5 max-h-[min(340px,52vh)] overflow-y-auto overflow-x-hidden overscroll-contain">
          {/* Account */}
          <div className="py-1 px-1">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Account</p>
            <div className="space-y-0.5">
              <button
                onClick={() => handleMenuItemClick(onAccountSettings)}
                className="flex items-center gap-4 w-full px-5 py-3 hover:bg-[#F5F5F7] active:bg-gray-200 transition-all text-left group rounded-2xl"
              >
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
                <span className="text-[14px] sm:text-[15px] font-bold text-gray-700">Account Settings</span>
              </button>
              <button
                onClick={() => handleMenuItemClick(onSecurityVault)}
                className="flex items-center gap-4 w-full px-5 py-3 hover:bg-[#F5F5F7] active:bg-gray-200 transition-all text-left group rounded-2xl"
              >
                <Fingerprint className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
                <span className="text-[14px] sm:text-[15px] font-bold text-gray-700">Security Vault</span>
              </button>
              {!isFamilyMember && (
                <button
                  onClick={() => handleTabNavigate('sessions')}
                  className="flex items-center gap-4 w-full px-5 py-3 hover:bg-[#F5F5F7] active:bg-gray-200 transition-all text-left group rounded-2xl"
                >
                  <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
                  <span className="text-[14px] sm:text-[15px] font-bold text-gray-700">Sessions</span>
                </button>
              )}
              <button
                onClick={() => handleTabNavigate('manage-storage')}
                className="flex items-center gap-4 w-full px-5 py-3 hover:bg-[#F5F5F7] active:bg-gray-200 transition-all text-left group rounded-2xl"
              >
                <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[14px] sm:text-[15px] font-bold text-gray-700 block">Storage & Usage</span>
                  {storageText && (
                    <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">{storageText}</p>
                  )}
                </div>
              </button>
            </div>
          </div>

          <div className="my-2 border-t border-gray-100" />

          {/* Preferences */}
          <div className="py-1 px-1">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Preferences</p>
            <div className="space-y-0.5">
              <button
                onClick={() => handleTabNavigate('appearance')}
                className="flex items-center gap-4 w-full px-5 py-3 hover:bg-[#F5F5F7] active:bg-gray-200 transition-all text-left group rounded-2xl"
              >
                <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
                <span className="text-[14px] sm:text-[15px] font-bold text-gray-700">Smart Features</span>
              </button>
              <button
                onClick={() => handleTabNavigate('activity')}
                className="flex items-center gap-4 w-full px-5 py-3 hover:bg-[#F5F5F7] active:bg-gray-200 transition-all text-left group rounded-2xl"
              >
                <History className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
                <span className="text-[14px] sm:text-[15px] font-bold text-gray-700">Activity Log</span>
              </button>
            </div>
          </div>

          {!isFamilyMember && (
            <>
              <div className="my-2 border-t border-gray-100" />
              {/* AI Settings */}
              <div className="py-1 px-1">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">AI Settings</p>
                <div className="space-y-0.5">
                  <button
                    onClick={() => handleTabNavigate('aimodels')}
                    className="flex items-center gap-4 w-full px-5 py-3 hover:bg-[#F5F5F7] active:bg-gray-200 transition-all text-left group rounded-2xl"
                  >
                    <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
                    <span className="text-[14px] sm:text-[15px] font-bold text-gray-700">AI Models</span>
                  </button>
                  <button
                    onClick={() => handleTabNavigate('aisecurity')}
                    className="flex items-center gap-4 w-full px-5 py-3 hover:bg-[#F5F5F7] active:bg-gray-200 transition-all text-left group rounded-2xl"
                  >
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
                    <span className="text-[14px] sm:text-[15px] font-bold text-gray-700">AI Security</span>
                  </button>
                </div>
              </div>
              <div className="my-2 border-t border-gray-100" />
              {/* Advanced */}
              <div className="py-1 px-1">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Advanced</p>
                <div className="space-y-0.5">
                  <button
                    onClick={() => handleTabNavigate('domain')}
                    className="flex items-center gap-4 w-full px-5 py-3 hover:bg-[#F5F5F7] active:bg-gray-200 transition-all text-left group rounded-2xl"
                  >
                    <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
                    <span className="text-[14px] sm:text-[15px] font-bold text-gray-700">Domain</span>
                  </button>
                  <button
                    onClick={() => handleTabNavigate('export')}
                    className="flex items-center gap-4 w-full px-5 py-3 hover:bg-[#F5F5F7] active:bg-gray-200 transition-all text-left group rounded-2xl"
                  >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#5D5FEF] flex-shrink-0" />
                    <span className="text-[14px] sm:text-[15px] font-bold text-gray-700">Export Data</span>
                  </button>
                  <button
                    onClick={() => handleTabNavigate('updates')}
                    className="flex items-center gap-4 w-full px-5 py-3 hover:bg-[#F5F5F7] active:bg-gray-200 transition-all text-left group rounded-2xl"
                  >
                    <ArrowUpCircle className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${updateVersion ? 'text-amber-500' : 'text-gray-400 group-hover:text-[#5D5FEF]'}`} />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-[14px] sm:text-[15px] font-bold text-gray-700">
                        {updateVersion ? 'Update Available' : 'Check for Updates'}
                      </span>
                      {updateVersion && (
                        <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                          v{updateVersion}
                        </span>
                      )}
                    </div>
                    {updateVersion && <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="my-3 border-t border-gray-50" />
        <div className="px-2">
          <button
            onClick={() => {
              if (onSignOut) {
                onSignOut();
              }
              onClose();
            }}
            className="flex items-center gap-4 w-full px-5 py-3 hover:bg-red-50 active:bg-red-100 transition-all text-left group rounded-2xl"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-red-500 flex-shrink-0" />
            <span className="text-[14px] sm:text-[15px] font-bold text-red-500">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed sm:hidden inset-0 bg-transparent z-[450]"
          onClick={onClose}
        />
      )}
    </>
  );
};

export default ProfileDropdown;
