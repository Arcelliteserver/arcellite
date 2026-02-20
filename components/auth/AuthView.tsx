import React, { useState, useRef, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, Cloud, AlertCircle, Loader2, ShieldCheck, Users, HardDrive } from 'lucide-react';
import { authApi, setSessionToken } from '../../services/api.client';

interface AuthViewProps {
  onLogin: () => void;
  onAccessDenied?: () => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onLogin, onAccessDenied }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Invite acceptance state
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteInfo, setInviteInfo] = useState<{
    name: string; email: string; role: string;
    storageQuota: number; ownerName: string;
  } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', password: '', confirmPassword: '' });
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Detect invite token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite') || params.get('token');
    if (token && /^[0-9a-f]{64}$/.test(token)) {
      setInviteMode(true);
      setInviteToken(token);
      authApi.getInviteInfo(token)
        .then((data: any) => {
          if (data.error) {
            setInviteError(data.error);
          } else {
            setInviteInfo(data);
            const parts = (data.name as string).split(' ');
            setInviteForm(prev => ({
              ...prev,
              firstName: parts[0] || '',
              lastName: parts.slice(1).join(' ') || '',
            }));
          }
        })
        .catch(() => setInviteError('Failed to load invite details'));
    }
  }, []);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.firstName.trim() || !inviteForm.lastName.trim()) {
      setInviteError('First and last name are required'); return;
    }
    if (inviteForm.password.length < 8) {
      setInviteError('Password must be at least 8 characters'); return;
    }
    if (inviteForm.password !== inviteForm.confirmPassword) {
      setInviteError('Passwords do not match'); return;
    }
    setInviteLoading(true);
    setInviteError('');
    try {
      const data = await authApi.acceptInvite({
        token: inviteToken,
        firstName: inviteForm.firstName.trim(),
        lastName: inviteForm.lastName.trim(),
        password: inviteForm.password,
      });
      if (data.error) { setInviteError(data.error); return; }
      setSessionToken(data.sessionToken);
      window.history.replaceState({}, '', '/');
      onLogin();
    } catch {
      setInviteError('Failed to accept invitation. Please try again.');
    } finally {
      setInviteLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 2FA state
  const [needs2FA, setNeeds2FA] = useState(false);
  const [totpCode, setTotpCode] = useState(['', '', '', '', '', '']);
  const totpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first TOTP input when 2FA challenge appears
  useEffect(() => {
    if (needs2FA && totpRefs.current[0]) {
      totpRefs.current[0].focus();
    }
  }, [needs2FA]);

  const handleTotpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...totpCode];
    newCode[index] = value.slice(-1);
    setTotpCode(newCode);
    // Auto-advance to next input
    if (value && index < 5) {
      totpRefs.current[index + 1]?.focus();
    }
  };

  const handleTotpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !totpCode[index] && index > 0) {
      totpRefs.current[index - 1]?.focus();
    }
  };

  const handleTotpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setTotpCode(pasted.split(''));
      totpRefs.current[5]?.focus();
    }
  };

  const fullTotpCode = totpCode.join('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (needs2FA && fullTotpCode.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setLoading(true);

    try {
      const result = await authApi.login(email, password, needs2FA ? fullTotpCode : undefined);
      if (result.requires2FA) {
        setNeeds2FA(true);
        setLoading(false);
        return;
      }
      onLogin();
    } catch (err: any) {
      const msg = err?.message || '';
      const isIpDenied = msg.includes('IP') || msg.includes('authorized') || msg.includes('allowlist') || msg.includes('Contact the administrator');
      if (isIpDenied && onAccessDenied) {
        onAccessDenied();
        return;
      }
      if (needs2FA) {
        setTotpCode(['', '', '', '', '', '']);
        totpRefs.current[0]?.focus();
      }
      setError(msg || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setNeeds2FA(false);
    setTotpCode(['', '', '', '', '', '']);
    setError('');
  };

  // ── Invite Acceptance UI ──────────────────────────────────────────────────
  if (inviteMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#5D5FEF]/5 via-white to-[#5D5FEF]/5 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8 sm:mb-12">
            <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">
              <Cloud className="w-full h-full text-[#5D5FEF] fill-[#5D5FEF]/10" strokeWidth={2.5} />
            </div>
            <h1 className="font-bold text-xl sm:text-2xl tracking-tight text-[#111111]">
              Arcellite<span className="text-[#5D5FEF]">.</span>
            </h1>
          </div>

          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50 p-6 sm:p-8 md:p-10">
            {/* Header */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="w-12 h-12 bg-[#5D5FEF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-[#5D5FEF]" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#111111] mb-1">Accept Your Invitation</h2>
              <p className="text-gray-400 text-xs sm:text-sm font-medium">Create your Arcellite account</p>
            </div>

            {/* Error card (invalid/used token) */}
            {inviteError && !inviteInfo && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-600 text-xs sm:text-sm font-medium">{inviteError}</p>
              </div>
            )}

            {/* Loading state */}
            {!inviteInfo && !inviteError && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-[#5D5FEF] animate-spin" />
              </div>
            )}

            {/* Invite info + form */}
            {inviteInfo && (
              <form onSubmit={handleInviteSubmit} className="space-y-4 sm:space-y-5">
                {/* Invite summary */}
                <div className="bg-[#F5F5F7] rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <Users className="w-4 h-4 text-[#5D5FEF] flex-shrink-0" />
                    <span>Invited by <span className="font-bold text-[#111111]">{inviteInfo.ownerName}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-[#5D5FEF] flex-shrink-0" />
                    <span>{inviteInfo.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <HardDrive className="w-4 h-4 text-[#5D5FEF] flex-shrink-0" />
                    <span>{formatBytes(inviteInfo.storageQuota)} storage &bull; <span className="capitalize">{inviteInfo.role}</span> access</span>
                  </div>
                </div>

                {/* Error */}
                {inviteError && (
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-600 text-xs sm:text-sm font-medium">{inviteError}</p>
                  </div>
                )}

                {/* First name */}
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">First Name</label>
                  <input
                    type="text"
                    value={inviteForm.firstName}
                    onChange={e => setInviteForm(p => ({ ...p, firstName: e.target.value }))}
                    placeholder="Enter your first name"
                    className="w-full px-4 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                    required
                  />
                </div>

                {/* Last name */}
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Last Name</label>
                  <input
                    type="text"
                    value={inviteForm.lastName}
                    onChange={e => setInviteForm(p => ({ ...p, lastName: e.target.value }))}
                    placeholder="Enter your last name"
                    className="w-full px-4 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Create Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type={showInvitePassword ? 'text' : 'password'}
                      value={inviteForm.password}
                      onChange={e => setInviteForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="Min. 8 characters"
                      className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                      required
                      minLength={8}
                    />
                    <button type="button" onClick={() => setShowInvitePassword(!showInvitePassword)}
                      className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors">
                      {showInvitePassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type={showInvitePassword ? 'text' : 'password'}
                      value={inviteForm.confirmPassword}
                      onChange={e => setInviteForm(p => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Repeat your password"
                      className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-[#5D5FEF] text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {inviteLoading ? (
                    <><Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />Creating Account...</>
                  ) : (
                    'Create My Account'
                  )}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-gray-400 text-[10px] sm:text-xs font-medium mt-6 sm:mt-8 px-4">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5D5FEF]/5 via-white to-[#5D5FEF]/5 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* App Logo/Name */}
        <div className="flex items-center justify-center gap-2 mb-8 sm:mb-12">
          <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">
            <Cloud className="w-full h-full text-[#5D5FEF] fill-[#5D5FEF]/10" strokeWidth={2.5} />
          </div>
          <h1 className="font-bold text-xl sm:text-2xl tracking-tight text-[#111111]">
            Arcellite<span className="text-[#5D5FEF]">.</span>
          </h1>
        </div>

        {/* Auth Form */}
        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50 p-6 sm:p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            {needs2FA ? (
              <>
                <div className="w-12 h-12 bg-[#5D5FEF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-6 h-6 text-[#5D5FEF]" />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-[#111111] mb-1">Two-Factor Verification</h2>
                <p className="text-gray-400 text-xs sm:text-sm font-medium">Enter the 6-digit code from your authenticator app</p>
              </>
            ) : (
              <>
                <h2 className="text-lg sm:text-xl font-black text-[#111111] mb-1">Welcome Back</h2>
                <p className="text-gray-400 text-xs sm:text-sm font-medium">Sign in to your account</p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-600 text-xs sm:text-sm font-medium">{error}</p>
              </div>
            )}

            {needs2FA ? (
              <>
                {/* TOTP Code Input — 6 digit boxes */}
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-3 block text-center">
                    Authentication Code
                  </label>
                  <div className="flex items-center justify-center gap-2 sm:gap-3" onPaste={handleTotpPaste}>
                    {totpCode.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { totpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleTotpChange(i, e.target.value)}
                        onKeyDown={(e) => handleTotpKeyDown(i, e)}
                        className="w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-black bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/40 focus:bg-white transition-all outline-none"
                      />
                    ))}
                  </div>
                </div>

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={loading || fullTotpCode.length !== 6}
                  className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-[#5D5FEF] text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Sign In'
                  )}
                </button>

                {/* Back button */}
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full py-2 text-gray-400 text-xs font-bold hover:text-gray-600 transition-colors"
                >
                  ← Back to sign in
                </button>
              </>
            ) : (
              <>
                {/* Email Input */}
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase tracking-widest mb-2 block">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 bg-[#F5F5F7] rounded-xl sm:rounded-2xl border border-transparent focus:border-[#5D5FEF]/30 focus:bg-white transition-all text-[14px] sm:text-[15px] outline-none placeholder:text-gray-400 font-medium"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-[#5D5FEF] text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </>
            )}
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-[10px] sm:text-xs font-medium mt-6 sm:mt-8 px-4">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default AuthView;
