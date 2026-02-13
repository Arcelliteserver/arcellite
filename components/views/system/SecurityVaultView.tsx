
import React from 'react';
import { Lock, ShieldCheck, Key, EyeOff, Activity, RefreshCw, AlertTriangle, ShieldAlert, ChevronRight, Eye, Shield, Lock as LockIcon } from 'lucide-react';

const SecurityVaultView: React.FC = () => {
  return (
    <div className="max-w-[1600px] mx-auto py-10 animate-in fade-in duration-500 min-h-full">
      <div className="mb-12">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            Security Vault
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <p className="text-gray-500 font-medium text-sm pl-3 sm:pl-4 md:pl-6">End-to-end server protection</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        {/* Main Security Column */}
        <div className="xl:col-span-2 space-y-12">
          <div className="bg-[#5D5FEF] rounded-[2.5rem] p-12 text-white shadow-2xl shadow-[#5D5FEF]/20 relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-white/10 rounded-full blur-[100px]" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
              <div className="max-w-xl">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-8 border border-white/20">
                  <ShieldCheck className="w-9 h-9 text-white" />
                </div>
                <h3 className="text-4xl font-black mb-4 tracking-tight leading-tight">Your data is secured at the cluster level.</h3>
                <p className="text-white/70 font-bold text-lg leading-relaxed">Cluster Node 01 is utilizing military-grade AES-256 encryption with automated key rotation every 24 hours.</p>
              </div>
              <div className="flex flex-col items-center gap-4 bg-black/10 p-8 rounded-[2rem] border border-white/10 backdrop-blur-sm">
                 <span className="text-6xl font-black">100%</span>
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Security Score</span>
              </div>
            </div>
          </div>

          {/* Privacy Controls Section */}
          <section>
             <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-8 ml-4">Privacy & Access Controls</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: 'Two-Factor Auth', desc: 'Secure logins via biometric or hardware keys.', icon: LockIcon, status: 'Active' },
                  { label: 'File Obfuscation', desc: 'Randomize metadata for sensitive vault items.', icon: EyeOff, status: 'Disabled' },
                  { label: 'Ghost Folders', desc: 'Hide folders unless specifically searched.', icon: Eye, status: 'Active' },
                  { label: 'Traffic Masking', desc: 'Mask server IP via Arcellite Tunneling.', icon: Shield, status: 'Active' },
                ].map((item, i) => (
                  <button key={i} className="flex items-center justify-between p-8 bg-white border border-gray-100 rounded-[2rem] hover:shadow-xl transition-all text-left group">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-[#5D5FEF] transition-all">
                        <item.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-base font-black text-gray-900 mb-1">{item.label}</p>
                        <p className="text-xs font-medium text-gray-400 leading-tight pr-4">{item.desc}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${item.status === 'Active' ? 'bg-green-50 text-green-500' : 'bg-gray-50 text-gray-300'}`}>{item.status}</span>
                       <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-[#5D5FEF] transition-all" />
                    </div>
                  </button>
                ))}
             </div>
          </section>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 p-12 shadow-sm">
            <div className="flex items-center justify-between mb-12">
              <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Cluster Access Logs</h4>
              <button className="text-[10px] font-black text-[#5D5FEF] uppercase tracking-widest hover:underline">Download Audit PDF</button>
            </div>
            <div className="space-y-10">
              {[
                { location: 'San Francisco, US', ip: '192.168.1.42', time: 'Just now', device: 'Arcellite Desktop 16"', status: 'authorized' },
                { location: 'San Francisco, US', ip: '192.168.1.42', time: '2 hours ago', device: 'Arcellite Desktop 16"', status: 'authorized' },
                { location: 'Tokyo, JP', ip: '203.0.113.5', time: 'Yesterday', device: 'Backup Mirror Node', status: 'authorized' },
                { location: 'Unknown', ip: '45.12.33.201', time: '3 days ago', device: 'Unknown Attempt', status: 'blocked' }
              ].map((log, i) => (
                <div key={i} className="flex items-center justify-between border-b border-gray-50 pb-8 last:border-none last:pb-0 group">
                  <div className="flex items-center gap-8">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${log.status === 'blocked' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400 group-hover:bg-[#5D5FEF]/10 group-hover:text-[#5D5FEF]'}`}>
                      {log.status === 'blocked' ? <ShieldAlert className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className={`text-[17px] font-black ${log.status === 'blocked' ? 'text-red-600' : 'text-gray-800'}`}>{log.device}</p>
                      <p className="text-[13px] font-medium text-gray-400">{log.location} • {log.ip}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-black text-gray-300 uppercase tracking-widest block mb-1">{log.time}</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${log.status === 'blocked' ? 'text-red-500' : 'text-green-500'}`}>{log.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Controls Column */}
        <div className="space-y-12">
          <div className="bg-gray-50/50 rounded-[2.5rem] p-10 border border-gray-100">
            <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-8">Protocol Actions</h4>
            <div className="space-y-4">
              <button className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-transparent hover:border-[#5D5FEF]/30 transition-all group shadow-sm active:scale-[0.98]">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-[#5D5FEF]/10 group-hover:text-[#5D5FEF] transition-all">
                    <Key className="w-5 h-5" />
                  </div>
                  <span className="text-[15px] font-black text-gray-700">Rotate RSA Keys</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-[#5D5FEF]" />
              </button>
              <button className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-transparent hover:border-[#5D5FEF]/30 transition-all group shadow-sm active:scale-[0.98]">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-[#5D5FEF]/10 group-hover:text-[#5D5FEF] transition-all">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <span className="text-[15px] font-black text-gray-700">Regenerate SSL</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-[#5D5FEF]" />
              </button>
              <button className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-transparent hover:border-[#5D5FEF]/30 transition-all group shadow-sm active:scale-[0.98]">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-[#5D5FEF]/10 group-hover:text-[#5D5FEF] transition-all">
                    <Activity className="w-5 h-5" />
                  </div>
                  <span className="text-[15px] font-black text-gray-700">Integrity Check</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-[#5D5FEF]" />
              </button>
            </div>
          </div>

          <div className="bg-amber-50 rounded-[2.5rem] p-10 border border-amber-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <AlertTriangle className="w-24 h-24 text-amber-500" />
            </div>
            <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-6">Advanced Notice</h4>
            <p className="text-amber-900 text-lg font-black mb-4 leading-tight">Strict Isolation Mode</p>
            <p className="text-amber-700/80 text-sm font-bold leading-relaxed mb-10">Enabling this prevents all non-authorized IP addresses from pinging your node. This might affect some remote sync mirrors.</p>
            <button className="w-full py-4 bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-amber-600 transition-all shadow-xl shadow-amber-500/20 active:scale-95">
              Enable Strict Isolation
            </button>
          </div>

          <div className="bg-red-50 rounded-[2.5rem] p-10 border border-red-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-100 rounded-[1.8rem] flex items-center justify-center text-red-500 mb-8">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <p className="text-red-900 font-black text-lg mb-2">Nuclear Lockdown</p>
            <p className="text-red-700 text-sm font-bold leading-relaxed mb-10">Immediately cut all network interfaces and encrypt the master block. Requires physical node access to revert.</p>
            <button className="w-full py-5 bg-red-600 text-white font-black text-[12px] uppercase tracking-[0.2em] rounded-3xl hover:bg-red-700 transition-all shadow-2xl shadow-red-600/30 active:scale-95">
              Execute Lockdown
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityVaultView;
