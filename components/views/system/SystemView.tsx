import React, { useState } from 'react';
import { Activity, BarChart3, HardDrive, Terminal, Archive, Server } from 'lucide-react';
import StatsView from './StatsView';
import SystemLogsView from './SystemLogsView';
import ActivityLogView from './ActivityLogView';
import ServerView from './ServerView';
import BackupView from './BackupView';

type SystemSubTab = 'health' | 'logs' | 'activity' | 'resources' | 'backup';

const TABS: { id: SystemSubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'health', label: 'Health', icon: BarChart3 },
  { id: 'logs', label: 'Logs', icon: Terminal },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'resources', label: 'Resources', icon: HardDrive },
  { id: 'backup', label: 'Backup', icon: Archive },
];

interface SystemViewProps {
  onNavigateToLogs?: () => void;
}

const SystemView: React.FC<SystemViewProps> = ({ onNavigateToLogs }) => {
  const [subTab, setSubTab] = useState<SystemSubTab>('health');

  const activeTabDef = TABS.find(t => t.id === subTab)!;
  const ActiveIcon = activeTabDef.icon;

  return (
    <div className="max-w-[1600px] mx-auto space-y-5">

      {/* ── Dark header banner ── */}
      <div className="rounded-2xl bg-[#1d1d1f] border border-[#2d2d2f] px-6 py-7 sm:py-8 flex items-center justify-between overflow-hidden relative">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[#5D5FEF]/10 blur-3xl" />
        <div className="flex items-center gap-4 relative z-10">
          {/* Gradient accent bar */}
          <div className="w-1 h-12 bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/10 rounded-full flex-shrink-0" />
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-white tracking-tight leading-tight">System</h1>
            <p className="text-[11px] text-white/40 mt-0.5 font-medium">
              Health · Logs · Activity · Resources · Backup
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 relative z-10">
          <ActiveIcon className="w-4 h-4 text-white/30" />
          <span className="text-[11px] font-black text-white/40 uppercase tracking-widest hidden sm:inline">
            {activeTabDef.label}
          </span>
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div className="flex items-center bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all flex-1 justify-center ${
              subTab === id
                ? 'bg-[#5D5FEF] text-white shadow-sm shadow-[#5D5FEF]/20'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="min-h-[400px]">
        {subTab === 'health' && <StatsView />}
        {subTab === 'logs' && <SystemLogsView />}
        {subTab === 'activity' && <ActivityLogView />}
        {subTab === 'resources' && <ServerView onNavigateToLogs={() => setSubTab('logs')} />}
        {subTab === 'backup' && <BackupView />}
      </div>
    </div>
  );
};

export default SystemView;
