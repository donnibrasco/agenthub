import React from 'react';
import { useNeuro } from '../context/NeuroContext';
import { 
  LayoutGrid, 
  Bot, 
  GitBranch, 
  LineChart, 
  Sparkles,
  ListTodo,
  LogOut
} from 'lucide-react';

export function NeuroSidebar() {
  const { activeTab, setActiveTab } = useNeuro();

  return (
    <aside className="w-64 shrink-0 border-r border-[#222426] bg-[#141517] flex flex-col justify-between p-4 h-screen sticky top-0 select-none text-slate-300">
      
      {/* Top Branding & Navigation */}
      <div className="space-y-6">
        
        {/* NeuroNest Brand Lockup */}
        <div className="flex items-center gap-2.5 px-2 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-white to-slate-300 text-neutral-950 font-bold shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 18L10 6L14 14L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight text-white font-sans">
            NeuroNest
          </span>
        </div>

        {/* SECTION: GENERAL */}
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider px-3 mb-2">
            General
          </div>
          
          <button
            type="button"
            onClick={() => setActiveTab('dashboards')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'dashboards'
                ? 'bg-[#252629] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#1D1E20]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Dashboards</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('agents')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'agents'
                ? 'bg-[#252629] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#1D1E20]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Bot className="w-4 h-4" />
              <span>Connected Models</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
              stream
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('jobs')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'jobs'
                ? 'bg-[#252629] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#1D1E20]'
            }`}
          >
            <div className="flex items-center gap-3">
              <ListTodo className="w-4 h-4" />
              <span>Jobs & Tasks</span>
            </div>
            <span className="text-[10px] font-mono text-orange-400 bg-orange-950/60 px-1.5 py-0.5 rounded border border-orange-800/50">
              Active
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('improvements')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'improvements'
                ? 'bg-[#252629] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#1D1E20]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-[#A5A1EE]" />
              <span>Improvements</span>
            </div>
            <span className="text-[10px] font-medium text-[#A5A1EE] bg-[#222233] px-1.5 py-0.5 rounded border border-[#343452]">
              Beta
            </span>
          </button>
        </div>

        {/* SECTION: MONITORING & FLOWS */}
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider px-3 mb-2">
            Operations
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('workflows')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'workflows'
                ? 'bg-[#252629] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#1D1E20]'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Workflows</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'bg-[#252629] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#1D1E20]'
            }`}
          >
            <LineChart className="w-4 h-4" />
            <span>Analytics</span>
          </button>
        </div>

      </div>

      {/* Bottom Profile Lockup */}
      <div className="pt-4 border-t border-[#222426]">
        <div className="flex items-center gap-3 px-2">
          <img
            src="/src/assets/images/avatar_franklin_1794427738987.jpg"
            alt="Franklin Eugene"
            className="w-9 h-9 rounded-lg object-cover border border-neutral-700"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">Franklin Eugene</div>
            <div className="text-[11px] text-neutral-500 font-mono truncate">eug.frank01@lain.com</div>
          </div>
        </div>
        <form action="/logout" method="post" className="mt-3">
          <button type="submit" className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-[#1D1E20]">
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </form>
      </div>

    </aside>
  );
}
