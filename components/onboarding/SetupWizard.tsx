import React, { useState, useRef, useEffect } from 'react';
import { HardDrive, FolderPlus, CheckCircle, Mail, Lock, User, Cloud, ArrowRight, AlertCircle, Loader2, Check, X, Eye, EyeOff, Usb, Server, ArrowRightLeft, Monitor } from 'lucide-react';
import { authApi } from '../../services/api.client';
import type { RemovableDeviceInfo } from '../../types';

interface TransferDevice {
  device: string;
  mountpoint: string;
  model: string;
  sizeHuman: string;
  manifest: {
    version: string;
    application: string;
    createdAt: string;
    sourceHostname: string;
    totalFiles: number;
    userName: string;
    userEmail: string;
  };
}

interface SetupWizardProps {
  onComplete: () => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [storagePath, setStoragePath] = useState('~/arcellite-data');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [storageType, setStorageType] = useState<'builtin' | 'external'>('builtin');
  const [externalDrives, setExternalDrives] = useState<RemovableDeviceInfo[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<RemovableDeviceInfo | null>(null);
  const [detectingDrives, setDetectingDrives] = useState(false);

  // ── Transfer Import state ─────────────────────────────────────────────────
  const [transferDevices, setTransferDevices] = useState<TransferDevice[]>([]);
  const [transferDetecting, setTransferDetecting] = useState(true);
  const [showTransferImport, setShowTransferImport] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferDevice | null>(null);
  const [transferPassword, setTransferPassword] = useState('');
  const [showTransferPassword, setShowTransferPassword] = useState(false);
  const [transferImporting, setTransferImporting] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferMessage, setTransferMessage] = useState('');
  const [transferComplete, setTransferComplete] = useState(false);

  // ── Detect transfer data on connected USBs when wizard loads ──────────────
  useEffect(() => {
    const detectTransfer = async () => {
      setTransferDetecting(true);
      try {
        const res = await fetch('/api/transfer/detect');
        const data = await res.json();
        if (data.found && data.devices?.length > 0) {
          setTransferDevices(data.devices);
          setSelectedTransfer(data.devices[0]);
          setShowTransferImport(true);
        }
      } catch {
        // No transfer data or API unavailable
      } finally {
        setTransferDetecting(false);
      }
    };
    detectTransfer();
  }, []);

  // Detect external drives when entering storage step
  useEffect(() => {
    if (step !== 4) return;
    const detectDrives = async () => {
      setDetectingDrives(true);
      try {
        const res = await fetch('/api/system/storage');
        const data = await res.json();
        if (data.removable && data.removable.length > 0) {
          setExternalDrives(data.removable);
        }
      } catch {
        // No external drives or API unavailable
      } finally {
        setDetectingDrives(false);
      }
    };
    detectDrives();
  }, [step]);

  // If user already registered but didn't finish setup, resume from step 2
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { user } = await authApi.getCurrentUser();
        if (user && !user.isSetupComplete) {
          // User registered but didn't finish — skip account creation
          setEmail(user.email || '');
          setFirstName(user.firstName || '');
          setLastName(user.lastName || '');
          setStep(user.emailVerified ? 3 : 2);
        }
      } catch {
        // No valid session — start from step 1
      }
    };
    checkExistingSession();
  }, []);

  const handleCodeDigitChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...codeDigits];
    newDigits[index] = digit;
    setCodeDigits(newDigits);
    setVerificationCode(newDigits.join(''));

    // Auto-focus next input
    if (digit && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = [...codeDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setCodeDigits(newDigits);
    setVerificationCode(newDigits.join(''));
    // Focus the next empty input or the last one
    const nextEmpty = newDigits.findIndex(d => !d);
    const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
    codeInputRefs.current[focusIndex]?.focus();
  };

  const handleCreateAccount = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    if (!firstName || !lastName) {
      setError('Please enter your first and last name');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authApi.register(email, password, firstName, lastName);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authApi.verifyEmail(verificationCode);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSetup = async () => {
    setLoading(true);
    setError('');

    try {
      await authApi.updateProfile({
        firstName,
        lastName,
        avatarUrl: avatarUrl || undefined,
      });
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleStorageSetup = async () => {
    setLoading(true);
    setError('');

    try {
      const finalPath = storageType === 'external' && selectedDrive
        ? selectedDrive.mountpoint + '/arcellite-data'
        : storagePath;
      await authApi.updateProfile({ storagePath: finalPath });
      setStep(5);
    } catch (err: any) {
      setError(err.message || 'Failed to set storage location');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSetup = async () => {
    setLoading(true);
    setError('');

    try {
      await authApi.completeSetup();
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  // ── Transfer Import handler ───────────────────────────────────────────────
  const handleTransferImport = async () => {
    if (!selectedTransfer || !transferPassword) {
      setError('Please set a password for your new account');
      return;
    }
    if (transferPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setError('');
    setTransferImporting(true);
    setTransferProgress(0);
    setTransferMessage('Starting import...');

    try {
      await fetch('/api/transfer/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mountpoint: selectedTransfer.mountpoint,
          password: transferPassword,
        }),
      });

      // Poll progress
      const poll = setInterval(async () => {
        try {
          const res = await fetch('/api/transfer/status');
          const status = await res.json();
          setTransferProgress(status.percent || 0);
          setTransferMessage(status.message || '');

          if (status.phase === 'done') {
            clearInterval(poll);
            setTransferComplete(true);
            setTransferImporting(false);
          } else if (status.phase === 'error') {
            clearInterval(poll);
            setTransferImporting(false);
            setError(status.error || 'Import failed');
          }
        } catch {
          clearInterval(poll);
          setTransferImporting(false);
          setError('Lost connection to server');
        }
      }, 800);
    } catch (e: any) {
      setTransferImporting(false);
      setError(e.message || 'Failed to start import');
    }
  };

  const handleTransferComplete = async () => {
    // Log into the imported account
    try {
      const manifest = selectedTransfer?.manifest;
      if (manifest?.userEmail && transferPassword) {
        await authApi.login(manifest.userEmail, transferPassword);
      }
    } catch {
      // Will redirect to login if auto-login fails
    }
    onComplete();
  };

  const stepTitles = ['Account', 'Verify', 'Profile', 'Storage', 'Complete'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5D5FEF]/5 via-white to-[#5D5FEF]/5 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        {/* App Logo/Name */}
        <div className="flex items-center justify-center gap-2 mb-6 sm:mb-8">
          <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">
            <Cloud className="w-full h-full text-[#5D5FEF] fill-[#5D5FEF]/10" strokeWidth={2.5} />
          </div>
          <h1 className="font-bold text-xl sm:text-2xl tracking-tight text-[#111111]">
            Arcellite<span className="text-[#5D5FEF]">.</span>
          </h1>
        </div>

        {/* Subtitle */}
        <p className="text-center text-gray-400 text-xs sm:text-sm font-medium mb-6 sm:mb-8">
          {showTransferImport ? 'Transfer data detected on a connected device' : 'Welcome! Let\'s set up your cloud workspace'}
        </p>

        {/* ── Transfer Import Flow ──────────────────────────────────────── */}
        {showTransferImport && !transferComplete && (
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-[#5D5FEF]/20 shadow-2xl shadow-[#5D5FEF]/10 p-6 sm:p-8 md:p-10 mb-6">
            {!transferImporting ? (
              <div className="space-y-5">
                <div className="text-center mb-2">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#5D5FEF]/10 mb-4">
                    <ArrowRightLeft className="w-7 h-7 text-[#5D5FEF]" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-[#111111] mb-1">Restore from Transfer</h2>
                  <p className="text-gray-400 text-xs sm:text-sm font-medium">
                    We found an Arcellite transfer package. Import your data?
                  </p>
                </div>

                {/* Transfer source info */}
                {selectedTransfer && (
                  <div className="bg-[#F5F5F7] rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#5D5FEF] rounded-xl flex items-center justify-center">
                        <Usb className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-gray-900">{selectedTransfer.model || selectedTransfer.device}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{selectedTransfer.sizeHuman}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-xl p-3">
                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Account</p>
                        <p className="text-xs font-bold text-gray-900 truncate">{selectedTransfer.manifest.userName}</p>
                        <p className="text-[10px] text-gray-400 truncate">{selectedTransfer.manifest.userEmail}</p>
                      </div>
                      <div className="bg-white rounded-xl p-3">
                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Contents</p>
                        <p className="text-xs font-bold text-gray-900">{selectedTransfer.manifest.totalFiles.toLocaleString()} files</p>
                        <p className="text-[10px] text-gray-400">from {selectedTransfer.manifest.sourceHostname}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Multiple transfer sources */}
                {transferDevices.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Select Source</p>
                    {transferDevices.map((td) => (
                      <button
                        key={td.mountpoint}
                        onClick={() => setSelectedTransfer(td)}
                        className={`w-full text-left rounded-xl p-3 border-2 transition-all ${
                          selectedTransfer?.mountpoint === td.mountpoint
                            ? 'border-[#5D5FEF] bg-[#5D5FEF]/5'
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Usb className="w-4 h-4 text-[#5D5FEF]" />
                          <span className="text-sm font-bold text-gray-900">{td.model || td.device}</span>
                          <span className="text-[10px] text-gray-400 ml-auto">{td.manifest.userName}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* New password */}
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">
                    Set New Password
                  </label>
                  <p className="text-[10px] text-gray-400 mb-2">Your account will be restored with a new password on this device.</p>
                  <div className="relative">
                    <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type={showTransferPassword ? 'text' : 'password'}
                      placeholder="Min 8 characters"
                      value={transferPassword}
                      onChange={(e) => setTransferPassword(e.target.value)}
                      className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTransferPassword(!showTransferPassword)}
                      className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showTransferPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-600 text-xs sm:text-sm font-medium">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleTransferImport}
                  disabled={!transferPassword || transferPassword.length < 8}
                  className="w-full px-6 py-3 sm:py-4 bg-[#5D5FEF] text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  Import & Restore
                </button>

                <button
                  onClick={() => { setShowTransferImport(false); setError(''); }}
                  className="w-full px-6 py-3 bg-[#F5F5F7] text-gray-500 rounded-xl sm:rounded-2xl font-bold text-xs hover:bg-gray-200 transition-all"
                >
                  Skip — Set up fresh account instead
                </button>
              </div>
            ) : (
              /* Importing progress */
              <div className="space-y-5 py-4">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 text-[#5D5FEF] animate-spin mx-auto mb-4" />
                  <h2 className="text-lg font-black text-[#111111] mb-1">Importing Data...</h2>
                  <p className="text-gray-400 text-xs font-medium">Please don't disconnect the USB drive</p>
                </div>
                <div className="w-full h-3 bg-[#F5F5F7] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#5D5FEF] to-[#7C6FF7] rounded-full transition-all duration-500"
                    style={{ width: `${transferProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-gray-400 font-medium truncate max-w-[70%]">{transferMessage}</p>
                  <span className="text-[11px] font-black text-[#5D5FEF]">{transferProgress}%</span>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-600 text-xs font-medium">{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Transfer Complete */}
        {transferComplete && (
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-green-100 shadow-2xl shadow-green-200/30 p-6 sm:p-8 md:p-10 mb-6">
            <div className="text-center space-y-4">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
              <h2 className="text-xl font-black text-[#111111]">Transfer Complete!</h2>
              <p className="text-gray-400 text-sm font-medium max-w-sm mx-auto">
                Your account, files, and settings have been restored. You can safely remove the USB drive.
              </p>
              {selectedTransfer && (
                <div className="bg-[#F5F5F7] rounded-2xl p-4 inline-flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-[#5D5FEF]" />
                  <div className="text-left">
                    <p className="text-sm font-black text-gray-900">{selectedTransfer.manifest.userName}</p>
                    <p className="text-[10px] text-gray-400">{selectedTransfer.manifest.userEmail}</p>
                  </div>
                </div>
              )}
              <button
                onClick={handleTransferComplete}
                className="w-full px-6 py-4 bg-green-500 text-white rounded-xl sm:rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-green-600 transition-all shadow-lg shadow-green-500/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Get Started
              </button>
            </div>
          </div>
        )}

        {/* ── Normal Setup Flow (hidden during transfer import) ──────── */}
        {!showTransferImport && !transferComplete && (
        <>
        {/* Progress Indicator */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between px-2">
            {[1, 2, 3, 4, 5].map((s, idx) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all ${
                      s < step
                        ? 'bg-green-500 text-white'
                        : s === step
                        ? 'bg-[#5D5FEF] text-white shadow-lg shadow-[#5D5FEF]/20'
                        : 'bg-[#F5F5F7] text-gray-400'
                    }`}
                  >
                    {s < step ? <CheckCircle size={18} /> : s}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-black uppercase tracking-widest ${
                    s === step ? 'text-[#5D5FEF]' : s < step ? 'text-green-500' : 'text-gray-300'
                  }`}>
                    {stepTitles[s - 1]}
                  </span>
                </div>
                {idx < 4 && (
                  <div className={`flex-1 h-0.5 mx-1.5 sm:mx-2 rounded-full transition-all ${
                    s < step ? 'bg-green-500' : 'bg-[#F5F5F7]'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50 p-6 sm:p-8 md:p-10">
          {/* Step 1: Create Account */}
          {step === 1 && (
            <div className="space-y-4 sm:space-y-5">
              <div className="text-center mb-2">
                <h2 className="text-lg sm:text-xl font-black text-[#111111] mb-1">Create Your Account</h2>
                <p className="text-gray-400 text-xs sm:text-sm font-medium">Set up your admin credentials to get started</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 text-xs sm:text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>

                {/* Password Requirements */}
                {password.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      {password.length >= 8 ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-gray-300" />
                      )}
                      <span className={`text-[11px] font-medium ${password.length >= 8 ? 'text-green-500' : 'text-gray-400'}`}>
                        At least 8 characters
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/[A-Z]/.test(password) ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-gray-300" />
                      )}
                      <span className={`text-[11px] font-medium ${/[A-Z]/.test(password) ? 'text-green-500' : 'text-gray-400'}`}>
                        One uppercase letter
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/[0-9]/.test(password) ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-gray-300" />
                      )}
                      <span className={`text-[11px] font-medium ${/[0-9]/.test(password) ? 'text-green-500' : 'text-gray-400'}`}>
                        One number
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>

                {/* Password Match Indicator */}
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-2 mt-2.5">
                    {password === confirmPassword ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-[11px] font-medium text-green-500">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-[11px] font-medium text-red-400">Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateAccount}
                disabled={loading}
                className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-[#5D5FEF] text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          )}

          {/* Step 2: Email Verification */}
          {step === 2 && (
            <div className="space-y-4 sm:space-y-5">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#5D5FEF]/10 mb-4">
                  <Mail className="w-7 h-7 text-[#5D5FEF]" />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-[#111111] mb-1">Verify Your Email</h2>
                <p className="text-gray-400 text-xs sm:text-sm font-medium">
                  We sent a 6-digit code to <span className="text-[#111111] font-semibold">{email}</span>
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 text-xs sm:text-sm font-medium">{error}</p>
                </div>
              )}

              <div>
                <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-3 block text-center">
                  Verification Code
                </label>
                <div className="flex items-center justify-center gap-1.5 sm:gap-2" onPaste={handleCodePaste}>
                  {/* First 3 digits */}
                  {[0, 1, 2].map((i) => (
                    <input
                      key={i}
                      ref={(el) => { codeInputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={codeDigits[i]}
                      onChange={(e) => handleCodeDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      className={`w-11 h-[3.25rem] sm:w-[3.25rem] sm:h-[3.75rem] bg-[#F5F5F7] rounded-xl border-2 text-center text-xl sm:text-2xl font-mono font-bold outline-none transition-all ${
                        codeDigits[i]
                          ? 'border-[#5D5FEF] bg-white text-[#5D5FEF]'
                          : 'border-transparent text-gray-800 focus:border-[#5D5FEF]/30 focus:bg-white'
                      }`}
                    />
                  ))}

                  {/* Dash separator */}
                  <span className="text-gray-300 font-bold text-xl sm:text-2xl mx-1 sm:mx-2 select-none">&#8211;</span>

                  {/* Last 3 digits */}
                  {[3, 4, 5].map((i) => (
                    <input
                      key={i}
                      ref={(el) => { codeInputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={codeDigits[i]}
                      onChange={(e) => handleCodeDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      className={`w-11 h-[3.25rem] sm:w-[3.25rem] sm:h-[3.75rem] bg-[#F5F5F7] rounded-xl border-2 text-center text-xl sm:text-2xl font-mono font-bold outline-none transition-all ${
                        codeDigits[i]
                          ? 'border-[#5D5FEF] bg-white text-[#5D5FEF]'
                          : 'border-transparent text-gray-800 focus:border-[#5D5FEF]/30 focus:bg-white'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleVerifyEmail}
                disabled={loading}
                className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-[#5D5FEF] text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Email'
                )}
              </button>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={async () => {
                    try {
                      await authApi.resendCode();
                      alert('Verification code sent!');
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                  className="text-[#5D5FEF] text-xs sm:text-sm font-semibold hover:text-[#4D4FCF] transition-colors"
                >
                  Resend Code
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="text-gray-400 text-xs sm:text-sm font-medium hover:text-gray-600 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Profile Setup */}
          {step === 3 && (
            <div className="space-y-4 sm:space-y-5">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#5D5FEF] mb-4">
                  <span className="text-white text-2xl font-bold">{firstName?.[0]?.toUpperCase() || 'A'}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-[#111111] mb-1">Set Up Your Profile</h2>
                <p className="text-gray-400 text-xs sm:text-sm font-medium">Personalize your Arcellite experience</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 text-xs sm:text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">
                  Avatar URL (optional)
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-4 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                />
              </div>

              <button
                onClick={handleProfileSetup}
                disabled={loading}
                className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-[#5D5FEF] text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          )}

          {/* Step 4: Storage Setup */}
          {step === 4 && (
            <div className="space-y-4 sm:space-y-5">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#5D5FEF]/10 mb-4">
                  <HardDrive className="w-7 h-7 text-[#5D5FEF]" />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-[#111111] mb-1">Choose Storage Location</h2>
                <p className="text-gray-400 text-xs sm:text-sm font-medium">Where should we store your files?</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 text-xs sm:text-sm font-medium">{error}</p>
                </div>
              )}

              {/* Built-in Server Storage */}
              <button
                type="button"
                onClick={() => { setStorageType('builtin'); setSelectedDrive(null); }}
                className={`w-full text-left rounded-2xl p-5 sm:p-6 border-2 transition-all ${
                  storageType === 'builtin'
                    ? 'border-[#5D5FEF] bg-[#5D5FEF]/5'
                    : 'border-gray-100 bg-[#F5F5F7] hover:border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    storageType === 'builtin' ? 'bg-[#5D5FEF]' : 'bg-gray-300'
                  }`}>
                    <Server className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-[#111111] text-sm mb-0.5">Server Storage</h3>
                    <p className="text-xs text-gray-400 font-medium mb-3">Store files directly on this server</p>
                    {storageType === 'builtin' && (
                      <input
                        type="text"
                        value={storagePath}
                        onChange={(e) => setStoragePath(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-4 py-3 bg-white rounded-xl border border-transparent focus:border-[#5D5FEF]/30 outline-none font-mono text-sm transition-all"
                        placeholder="~/arcellite-data"
                      />
                    )}
                  </div>
                </div>
              </button>

              {/* External Storage Drives */}
              {detectingDrives && (
                <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-medium">Detecting external storage...</span>
                </div>
              )}

              {externalDrives.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest">
                    External Storage Detected
                  </p>
                  {externalDrives.map((drive) => (
                    <button
                      key={drive.mountpoint}
                      type="button"
                      onClick={() => { setStorageType('external'); setSelectedDrive(drive); }}
                      className={`w-full text-left rounded-2xl p-5 sm:p-6 border-2 transition-all ${
                        storageType === 'external' && selectedDrive?.mountpoint === drive.mountpoint
                          ? 'border-[#5D5FEF] bg-[#5D5FEF]/5'
                          : 'border-gray-100 bg-[#F5F5F7] hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          storageType === 'external' && selectedDrive?.mountpoint === drive.mountpoint
                            ? 'bg-[#5D5FEF]' : 'bg-gray-300'
                        }`}>
                          <Usb className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-[#111111] text-sm mb-0.5">{drive.model || drive.name}</h3>
                          <p className="text-xs text-gray-400 font-medium">{drive.sizeHuman} &middot; {drive.mountpoint}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!detectingDrives && externalDrives.length === 0 && (
                <p className="text-center text-xs text-gray-300 font-medium py-1">
                  No external storage detected
                </p>
              )}

              <button
                onClick={handleStorageSetup}
                disabled={loading}
                className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-[#5D5FEF] text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          )}

          {/* Step 5: Complete Setup */}
          {step === 5 && (
            <div className="space-y-4 sm:space-y-5">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/10 mb-4">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-[#111111] mb-1">Almost There!</h2>
                <p className="text-gray-400 text-xs sm:text-sm font-medium">We'll create these folders to organize your files</p>
              </div>

              <div className="space-y-2.5">
                {['Files', 'Photos', 'Videos', 'Music', 'Shared'].map((folder) => (
                  <div key={folder} className="flex items-center gap-3 p-3 sm:p-4 bg-[#F5F5F7] rounded-xl">
                    <FolderPlus className="w-4 h-4 sm:w-5 sm:h-5 text-[#5D5FEF]" />
                    <span className="font-semibold text-[#111111] text-sm">{folder}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCompleteSetup}
                disabled={loading}
                className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-green-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-green-600 transition-all shadow-lg shadow-green-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    Finalizing...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        </>
        )}

        {/* Footer */}
        <p className="text-center text-gray-400 text-[10px] sm:text-xs font-medium mt-6 sm:mt-8 px-4">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default SetupWizard;
