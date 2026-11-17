import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNeuro } from '../context/NeuroContext';
import { Search, Plug, Database, Bot, RefreshCw } from 'lucide-react';

interface SystemHealthResponse {
  ok: boolean;
  status: 'healthy' | 'degraded';
  database: 'connected' | 'disconnected';
  storage: string;
  agentCount: number;
  activeAgentCount: number;
  uptimeSeconds: number;
  checkedAt: string;
  error?: string;
}

export function NeuroHeader() {
  const { searchQuery, setSearchQuery, setIsConnectModalOpen, setEditingModel, agents } = useNeuro();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(true);
  const [isStatusOpen, setIsStatusOpen] = useState<boolean>(false);

  const fetchHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data = (await res.json()) as SystemHealthResponse;
      setHealth(data);
      setHealthError(res.ok && data.ok ? null : data.error || 'Health check degraded');
    } catch {
      setHealthError('Server unreachable');
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    const timer = window.setInterval(() => {
      void fetchHealth();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [fetchHealth, agents.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setIsStatusOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!isStatusOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsStatusOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isStatusOpen]);

  const isHealthy = Boolean(health?.ok && health.database === 'connected' && !healthError);
  const agentCount = health?.agentCount ?? agents.length;
  const dbStateLabel = healthError
    ? 'Disconnected'
    : health
    ? health.database === 'connected'
      ? 'DB Connected'
      : 'DB Disconnected'
    : 'Checking...';

  return (
    <header className="h-16 border-b border-[#222426] bg-[#141517]/80 backdrop-blur-md px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Search Input with ⌘ + F shortcut */}
      <div className="relative w-full max-w-md">
        <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search models, jobs, workflows..."
          aria-label="Global workspace search"
          className="w-full pl-9 pr-14 py-2 text-xs rounded-xl border border-[#2A2B2E] bg-[#1D1E20] text-slate-100 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400 font-sans transition-colors"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-neutral-400 hover:text-white border border-[#333538] rounded px-1.5 py-0.5 bg-[#141517]"
          >
            Esc
          </button>
        ) : (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] font-mono text-neutral-500 border border-[#333538] rounded px-1.5 py-0.5 bg-[#141517] pointer-events-none">
            <span>⌘</span>
            <span>+</span>
            <span>F</span>
          </div>
        )}
      </div>

      {/* Right Controls: System Status + Connect Model */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setIsStatusOpen(prev => !prev)}
            aria-expanded={isStatusOpen}
            aria-label="System Status"
            data-testid="system-status-indicator"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-colors ${
              health === null && isCheckingHealth
                ? 'bg-[#1D1E20] border-[#2D2F34] text-neutral-300'
                : isHealthy
                ? 'bg-[#15221B] border-[#254432] text-emerald-300 hover:bg-[#1A2B22]'
                : 'bg-rose-950/60 border-rose-800/70 text-rose-300 hover:bg-rose-950/80'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                health === null && isCheckingHealth
                  ? 'bg-amber-400 animate-pulse'
                  : isHealthy
                  ? 'bg-emerald-400'
                  : 'bg-rose-500'
              }`}
            />
            <span className="font-medium text-neutral-200 hidden sm:inline">System Status</span>
            <span className="text-neutral-600 hidden sm:inline">·</span>
            <span className="font-mono text-[11px]">
              {agentCount} {agentCount === 1 ? 'agent' : 'agents'}
            </span>
            <span className="text-neutral-600 hidden md:inline">·</span>
            <span className="font-mono text-[11px] hidden md:inline">{dbStateLabel}</span>
          </button>

          {isStatusOpen && (
            <div
              role="region"
              aria-label="System Status Details"
              className="absolute right-0 mt-2 w-72 rounded-2xl border border-[#2B2D31] bg-[#18191B] p-4 shadow-2xl space-y-3 z-50 text-xs"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-[#25262A]">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isHealthy ? 'bg-emerald-400' : 'bg-rose-500'
                    }`}
                  />
                  <span className="font-semibold text-white">System Status</span>
                </div>
                <span
                  className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded border ${
                    isHealthy
                      ? 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300'
                      : 'bg-rose-950/70 border-rose-800/60 text-rose-300'
                  }`}
                >
                  {isHealthy ? 'Healthy' : 'Degraded'}
                </span>
              </div>

              <div className="space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-neutral-500" />
                    Database ({health?.storage || 'sqlite'})
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      health?.database === 'connected' && !healthError
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {healthError ? 'disconnected' : health?.database ?? 'checking'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-neutral-500" />
                    Connected Agents
                  </span>
                  <span className="font-mono text-white font-semibold">
                    {agentCount} total ({health?.activeAgentCount ?? 0} active)
                  </span>
                </div>

                {typeof health?.uptimeSeconds === 'number' && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Server Uptime</span>
                    <span className="font-mono text-neutral-300">{health.uptimeSeconds}s</span>
                  </div>
                )}

                {healthError && (
                  <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 font-mono text-[10px]">
                    {healthError}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#25262A] flex items-center justify-between">
                <span className="text-[10px] font-mono text-neutral-500">
                  {health?.checkedAt
                    ? `Checked ${new Date(health.checkedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}`
                    : 'Checking...'}
                </span>
                <button
                  type="button"
                  onClick={() => void fetchHealth()}
                  disabled={isCheckingHealth}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#232429] hover:bg-[#2D2F35] text-neutral-200 text-[11px] font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingModel(null);
            setIsConnectModalOpen(true);
          }}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-neutral-950 bg-white hover:bg-neutral-100 rounded-full transition-all shadow-sm"
        >
          <Plug className="w-3.5 h-3.5" />
          <span>Connect Model</span>
        </button>
      </div>
    </header>
  );
}
