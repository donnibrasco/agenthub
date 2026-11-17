import React, { useState } from 'react';
import { useBlume } from '../data/blumeStore';
import { Sparkles, Terminal, Shield, Check, Copy } from 'lucide-react';

export function BlumeHeader() {
  const { activeView, setActiveView, drifts, rules } = useBlume();
  const [copiedHook, setCopiedHook] = useState(false);

  const pendingDriftsCount = drifts.filter(d => d.status === 'pending').length;
  const suggestedRulesCount = rules.filter(r => r.status === 'suggested').length;

  const handleCopyHook = () => {
    navigator.clipboard.writeText('npx @creativeprocess/blume watch --port=4040');
    setCopiedHook(true);
    setTimeout(() => setCopiedHook(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-8 px-4 sm:px-6">
        
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-400 to-rose-400 text-neutral-950 font-bold text-xs shadow-sm">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div className="leading-tight">
              <span className="text-sm font-semibold tracking-tight text-white block">
                Blume
              </span>
            </div>
            <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
              / Creativeprocess.io
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Single-line clean tabs) */}
        <nav className="flex items-center gap-6 text-xs font-medium text-neutral-400">
          <button
            onClick={() => setActiveView('monitor')}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeView === 'monitor'
                ? 'text-amber-400 font-semibold border-b-2 border-amber-400'
                : 'hover:text-neutral-200'
            }`}
          >
            Live Monitor
          </button>
          <button
            onClick={() => setActiveView('drifts')}
            className={`transition-colors whitespace-nowrap py-1 flex items-center gap-1.5 ${
              activeView === 'drifts'
                ? 'text-amber-400 font-semibold border-b-2 border-amber-400'
                : 'hover:text-neutral-200'
            }`}
          >
            <span>Drift & Rules</span>
            {pendingDriftsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-mono">
                {pendingDriftsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveView('rules')}
            className={`transition-colors whitespace-nowrap py-1 ${
              activeView === 'rules'
                ? 'text-amber-400 font-semibold border-b-2 border-amber-400'
                : 'hover:text-neutral-200'
            }`}
          >
            Active Rules ({rules.filter(r => r.status === 'applied').length})
          </button>
        </nav>

        {/* Zone 3: Primary Action & Listening Status */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sidecar Watching</span>
          </div>

          <button
            onClick={handleCopyHook}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors font-mono"
            title="Copy terminal sidecar watcher command"
          >
            {copiedHook ? <Check className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedHook ? 'Copied hook!' : 'npx @blume/watch'}</span>
            <span className="sm:hidden">Hook</span>
          </button>
        </div>

      </div>
    </header>
  );
}
