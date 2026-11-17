import React, { useState } from 'react';
import { useNeuro } from '../context/NeuroContext';
import { 
  Sparkles, 
  Bot, 
  FileText, 
  GitBranch, 
  Database, 
  Bookmark, 
  ArrowRight,
  Plug
} from 'lucide-react';

export function DashboardView() {
  const { agents, activities, searchQuery, setActiveLaunchAgent, setIsConnectModalOpen, setEditingModel } = useNeuro();
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleAgents = normalizedQuery
    ? agents.filter(
        a =>
          a.name.toLowerCase().includes(normalizedQuery) ||
          a.description.toLowerCase().includes(normalizedQuery) ||
          a.model.toLowerCase().includes(normalizedQuery)
      )
    : agents;

  const visibleActivities = normalizedQuery
    ? activities.filter(
        act =>
          act.title.toLowerCase().includes(normalizedQuery) ||
          act.snippet.toLowerCase().includes(normalizedQuery) ||
          act.modelTag.toLowerCase().includes(normalizedQuery)
      )
    : activities;

  return (
    <div className="space-y-7">
      
      {/* HERO BANNER: Meet NeuroNest */}
      <div className="relative rounded-3xl bg-[#1B1C1E] border border-[#27292C] p-7 md:p-9 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 shadow-md">
        
        {/* Subtle decorative grid overlay */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Left Column: Heading, Subtitle & Video CTA */}
        <div className="space-y-4 max-w-xl z-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight font-sans">
            Meet NeuroNest — Your Modular <br className="hidden sm:inline" />
            Command Center for Everything AI
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans">
            Welcome to NeuroNest — a modular desktop dashboard built to amplify your creative and operational workflows with AI at the center.
          </p>
        </div>

        {/* Right Column: Floating 3D/Metallic AI Model Badges matching Dribbble shot */}
        <div className="relative z-10 shrink-0 w-64 h-48 flex items-center justify-center">
          
          {/* Claude Anthropic Star Badge */}
          <div className="absolute top-2 left-6 w-14 h-14 rounded-2xl bg-[#28292D] border border-neutral-700/80 shadow-xl flex items-center justify-center transition-transform hover:scale-110">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-amber-300">
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="currentColor"/>
            </svg>
          </div>

          {/* OpenAI Spiral Badge */}
          <div className="absolute top-4 right-10 w-16 h-16 rounded-full bg-[#222326] border border-neutral-700/80 shadow-2xl flex items-center justify-center transition-transform hover:scale-110">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 7C9.2 7 7 9.2 7 12C7 14.8 9.2 17 12 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          {/* DeepSeek Whale Badge */}
          <div className="absolute bottom-6 right-2 w-14 h-14 rounded-2xl bg-[#28292D] border border-neutral-700/80 shadow-xl flex items-center justify-center transition-transform hover:scale-110">
            <span className="text-blue-400 font-bold font-mono text-sm">🐳 R1</span>
          </div>

          {/* Copy.ai Badge */}
          <div className="absolute bottom-8 left-16 px-4 py-2 rounded-2xl bg-[#1F2023] border border-neutral-700/80 shadow-lg text-xs font-semibold text-neutral-300 tracking-tight">
            copy.ai
          </div>

          {/* Cursor Badge */}
          <div className="absolute top-16 left-28 w-12 h-12 rounded-2xl bg-[#18191B] border border-neutral-700/80 shadow-lg flex items-center justify-center text-xs font-mono font-bold text-white">
            ⬡
          </div>

        </div>

      </div>

      {/* QUICK STATS (4 Pastel Cards matching Dribbble reference) */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-white tracking-tight">
          Quick Stats
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: 150+ Favorite Prompts (Soft Blue) */}
          <div className="p-5 rounded-2xl bg-[#D7E6FF] text-[#111827] shadow-sm space-y-3 transition-transform hover:-translate-y-0.5">
            <div className="w-8 h-8 rounded-full bg-[#111827] flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="text-3xl font-extrabold font-sans tracking-tight text-[#111827]">
                150+
              </div>
              <div className="text-xs font-medium text-neutral-700 mt-0.5">
                Favorite Prompts
              </div>
            </div>
          </div>

          {/* Card 2: Connected Models (Soft Mint Green) */}
          <div className="p-5 rounded-2xl bg-[#E5F3DD] text-[#111827] shadow-sm space-y-3 transition-transform hover:-translate-y-0.5">
            <div className="w-8 h-8 rounded-full bg-[#111827] flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="text-3xl font-extrabold font-sans tracking-tight text-[#111827]">
                {agents.length}
              </div>
              <div className="text-xs font-medium text-neutral-700 mt-0.5">
                Connected Models
              </div>
            </div>
          </div>

          {/* Card 3: 89 Uploaded Docs (Soft Butter Yellow) */}
          <div className="p-5 rounded-2xl bg-[#FDF4B8] text-[#111827] shadow-sm space-y-3 transition-transform hover:-translate-y-0.5">
            <div className="w-8 h-8 rounded-full bg-[#111827] flex items-center justify-center text-white">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-3xl font-extrabold font-sans tracking-tight text-[#111827]">
                89
              </div>
              <div className="text-xs font-medium text-neutral-700 mt-0.5">
                Uploaded Docs
              </div>
            </div>
          </div>

          {/* Card 4: 1.2K Flows Executed (Soft Lilac Purple) */}
          <div className="p-5 rounded-2xl bg-[#F0E6FA] text-[#111827] shadow-sm space-y-3 transition-transform hover:-translate-y-0.5">
            <div className="w-8 h-8 rounded-full bg-[#111827] flex items-center justify-center text-white">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <div className="text-3xl font-extrabold font-sans tracking-tight text-[#111827]">
                1.2K
              </div>
              <div className="text-xs font-medium text-neutral-700 mt-0.5">
                Flows Executed
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* MAIN 2-COLUMN SPLIT: Quick Launch Agents & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Column 1: Connected Models */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white tracking-tight">
              Connected Models
            </h2>
            <button
              type="button"
              onClick={() => {
                setEditingModel(null);
                setIsConnectModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-colors"
            >
              <Plug className="w-3 h-3" />
              <span>Connect Model</span>
            </button>
          </div>

          <div className="space-y-3.5">
            {visibleAgents.map(agent => (
              <div
                key={agent.id}
                className="p-5 rounded-2xl bg-[#1D1E20] border border-[#27292C] space-y-3 hover:border-neutral-600 transition-colors shadow-sm"
              >
                {/* Header: Date + Active Status pill */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 font-sans">{agent.date}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#1F3D27] text-[#4ADE80] border border-[#275333] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
                    <span>{agent.status}</span>
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-base font-semibold text-white tracking-tight">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                    {agent.description}
                  </p>
                </div>

                {/* Footer Telemetry & Quick Launch Button */}
                <div className="flex items-center justify-between pt-2 border-t border-[#2A2B2E] text-xs">
                  <div className="flex items-center gap-2 font-mono text-neutral-400">
                    <Database className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{agent.tokens} Tokens</span>
                    <span className="text-emerald-400 font-sans font-medium">Running</span>
                  </div>

                  <button
                    onClick={() => setActiveLaunchAgent(agent)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2A2C30] hover:bg-[#34363A] text-white text-xs font-medium transition-colors"
                  >
                    <span>Run Prompt</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Recent Activity */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white tracking-tight">
            Recent Activity
          </h2>

          <div className="space-y-3.5">
            {visibleActivities.map(act => (
              <div
                key={act.id}
                onClick={() => setSelectedActivity(selectedActivity === act.id ? null : act.id)}
                className={`p-5 rounded-2xl ${act.bgColorClass} cursor-pointer transition-all hover:opacity-95 shadow-sm space-y-3`}
              >
                {/* Header: Date + Indicator Icon */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-600 font-sans">{act.date}</span>
                  <Bookmark className="w-4 h-4 text-neutral-500" />
                </div>

                {/* Title & Snippet */}
                <div>
                  <h3 className={`text-base font-bold tracking-tight ${act.textColorClass}`}>
                    {act.title}
                  </h3>
                  <p className="text-xs text-neutral-700 mt-1 leading-relaxed">
                    {act.snippet}
                  </p>
                </div>

                {/* Bottom Model Badge */}
                <div className="pt-1 flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${act.tagColorClass} shadow-sm`}>
                    {act.modelTag}
                  </span>

                  <span className="text-[11px] text-neutral-500 hover:underline">
                    {selectedActivity === act.id ? 'Collapse response' : 'View full response →'}
                  </span>
                </div>

                {/* Expanded Response Drawer */}
                {selectedActivity === act.id && (
                  <div className="p-3.5 rounded-xl bg-white/90 text-neutral-900 text-xs font-mono mt-2 space-y-1.5 shadow-inner">
                    <div className="font-semibold text-neutral-700 text-[11px] uppercase tracking-wider">Generated Output:</div>
                    <p className="whitespace-pre-wrap leading-relaxed">{act.response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
