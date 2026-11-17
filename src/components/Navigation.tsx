import React from 'react';
import { useAgentFleet } from '../context/AgentContext';
import { 
  ShieldCheck, 
  Plus, 
  Activity, 
  Cpu, 
  Radio
} from 'lucide-react';

export function Navigation() {
  const { 
    activeTab, 
    setActiveTab, 
    setIsConnectModalOpen, 
    setIsSecurityVaultOpen,
    isLiveStreaming,
    setIsLiveStreaming,
    agents
  } = useAgentFleet();

  const e2eeCount = agents.filter(a => a.e2eeEnabled).length;
  const nominalCount = agents.filter(a => a.status === 'nominal').length;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-8 px-4 sm:px-6">
        
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setActiveTab('fleet')}
            className="flex items-center gap-2.5 text-left text-sm font-semibold tracking-tight text-white transition-opacity hover:opacity-90"
            aria-label="Go to fleet dashboard"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-mono text-xs font-bold shadow-sm">
              CP
            </div>
            <span className="whitespace-nowrap">CreativeProcess AgentPulse</span>
          </button>
        </div>

        {/* Zone 2: Navigation Links (Single-line text links) */}
        <nav className="hidden lg:flex items-center gap-7 text-xs font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('fleet')}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeTab === 'fleet' ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400' : 'hover:text-slate-200'
            }`}
          >
            Agent Fleet ({agents.length})
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeTab === 'telemetry' ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400' : 'hover:text-slate-200'
            }`}
          >
            Traces & Waterfall
          </button>
          <button
            onClick={() => setActiveTab('debugger')}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeTab === 'debugger' ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400' : 'hover:text-slate-200'
            }`}
          >
            Collaborative Debugger
          </button>
          <button
            onClick={() => setActiveTab('orchestration')}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeTab === 'orchestration' ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400' : 'hover:text-slate-200'
            }`}
          >
            Pipeline Canvas
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeTab === 'tools' ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400' : 'hover:text-slate-200'
            }`}
          >
            Tool Hub
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeTab === 'analytics' ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400' : 'hover:text-slate-200'
            }`}
          >
            Analytics & Reports
          </button>
        </nav>

        {/* Zone 3: Primary Action & Security Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* E2EE Security Badge Button */}
          <button
            onClick={() => setIsSecurityVaultOpen(true)}
            title="Inspect End-to-End Encryption Keys and Zero-Trust Vault"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-500/50 hover:text-white transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">E2EE</span>
            <span className="text-slate-400 tabular-nums">({e2eeCount}/{agents.length})</span>
          </button>

          {/* Live Telemetry Stream Toggle */}
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            title={isLiveStreaming ? "Live telemetry stream active" : "Live telemetry paused"}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors ${
              isLiveStreaming 
                ? 'border-emerald-800/80 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/50' 
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className={`w-3 h-3 ${isLiveStreaming ? 'animate-pulse text-emerald-400' : 'text-slate-500'}`} />
            <span className="hidden md:inline font-mono text-[11px]">{isLiveStreaming ? 'LIVE' : 'PAUSED'}</span>
          </button>

          {/* Primary Action Button */}
          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 transition-colors whitespace-nowrap shadow-sm shadow-cyan-950"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Connect Agent</span>
          </button>
        </div>

      </div>

      {/* Mobile Tab Navigation Bar */}
      <div className="lg:hidden flex items-center gap-4 overflow-x-auto px-4 py-2 border-t border-slate-800/80 bg-slate-950 text-xs text-slate-400">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`whitespace-nowrap ${activeTab === 'fleet' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Fleet ({agents.length})
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`whitespace-nowrap ${activeTab === 'telemetry' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Traces
        </button>
        <button
          onClick={() => setActiveTab('debugger')}
          className={`whitespace-nowrap ${activeTab === 'debugger' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Debugger
        </button>
        <button
          onClick={() => setActiveTab('orchestration')}
          className={`whitespace-nowrap ${activeTab === 'orchestration' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Pipelines
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`whitespace-nowrap ${activeTab === 'tools' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Tools
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`whitespace-nowrap ${activeTab === 'analytics' ? 'text-cyan-400 font-semibold' : ''}`}
        >
          Analytics
        </button>
      </div>
    </header>
  );
}
