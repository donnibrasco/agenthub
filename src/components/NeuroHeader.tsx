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
        if (!inputRef.current?.getClientRects().length) return;
        e.preventDefault();
        inputRef.current.focus();
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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-[#e7e2d9] bg-[#fffdfa] px-3 backdrop-blur-md sm:gap-4 sm:px-6">
      {/* Search Input with ⌘ + F shortcut */}
      <div className="relative w-full max-w-md">
        <Search className="w-4 h-4 text-[#777064] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search models, jobs, workflows..."
          aria-label="Global workspace search"
          className="w-full rounded-xl border border-[#e7e2d9] bg-[#fffdfa] py-2 pr-8 pl-9 font-sans text-xs text-[#282820] transition-colors placeholder:text-[#777064] focus:border-[#08666c] focus:outline-none sm:pr-14"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#665f54] hover:text-[#282820] border border-[#d8d3ca] rounded px-1.5 py-0.5 bg-[#fffdfa]"
          >
            Esc
          </button>
        ) : (
          <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-[#d8d3ca] bg-[#fffdfa] px-1.5 py-0.5 font-mono text-xs text-[#777064] sm:flex">
            <span>⌘</span>
            <span>+</span>
            <span>F</span>
          </div>
        )}
      </div>

      {/* Right Controls: System Status + Connect Model */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setIsStatusOpen(prev => !prev)}
            aria-expanded={isStatusOpen}
            aria-label="System Status"
            data-testid="system-status-indicator"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-colors ${
              health === null && isCheckingHealth
                ? 'bg-[#fffdfa] border-[#d8d3ca] text-[#4b4941]'
                : isHealthy
                ? 'bg-[#fffdfa] border-[#166b66]/25 text-[#1f6b5f] hover:bg-[#e9f2eb]'
                : 'bg-[#f9ece4] border-[#a44e32]/25 text-[#922d1d] hover:bg-[#f9ece4]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                health === null && isCheckingHealth
                  ? 'bg-[#c08a1e] animate-pulse'
                  : isHealthy
                  ? 'bg-[#08666c]'
                  : 'bg-[#b4442a]'
              }`}
            />
            <span className="font-medium text-[#282820] hidden sm:inline">System Status</span>
            <span className="text-[#777064] hidden sm:inline">·</span>
            <span className="hidden font-mono text-xs sm:inline">
              {agentCount} {agentCount === 1 ? 'agent' : 'agents'}
            </span>
            <span className="text-[#777064] hidden md:inline">·</span>
            <span className="font-mono text-xs hidden md:inline">{dbStateLabel}</span>
          </button>

          {isStatusOpen && (
            <div
              role="region"
              aria-label="System Status Details"
              className="fixed inset-x-3 top-14 z-50 space-y-3 rounded-2xl border border-[#e7e2d9] bg-[#fffdfa] p-4 text-xs shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-[#e7e2d9]">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isHealthy ? 'bg-[#08666c]' : 'bg-[#b4442a]'
                    }`}
                  />
                  <span className="font-semibold text-[#282820]">System Status</span>
                </div>
                <span
                  className={`font-mono text-xs uppercase px-2 py-0.5 rounded border ${
                    isHealthy
                      ? 'bg-[#e9f2eb] border-[#166b66]/25 text-[#1f6b5f]'
                      : 'bg-[#f9ece4] border-[#a44e32]/25 text-[#922d1d]'
                  }`}
                >
                  {isHealthy ? 'Healthy' : 'Degraded'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#665f54] flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-[#777064]" />
                    Database ({health?.storage || 'sqlite'})
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      health?.database === 'connected' && !healthError
                        ? 'text-[#1f6b5f]'
                        : 'text-[#922d1d]'
                    }`}
                  >
                    {healthError ? 'disconnected' : health?.database ?? 'checking'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#665f54] flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-[#777064]" />
                    Connected Agents
                  </span>
                  <span className="font-mono text-[#282820] font-semibold">
                    {agentCount} total ({health?.activeAgentCount ?? 0} active)
                  </span>
                </div>

                {typeof health?.uptimeSeconds === 'number' && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#665f54]">Server Uptime</span>
                    <span className="font-mono text-[#4b4941]">{health.uptimeSeconds}s</span>
                  </div>
                )}

                {healthError && (
                  <div className="p-2 rounded-lg bg-[#f9ece4] border border-[#a44e32]/25 text-[#922d1d] font-mono text-xs">
                    {healthError}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#e7e2d9] flex items-center justify-between">
                <span className="text-xs font-mono text-[#777064]">
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
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f2eee6] hover:bg-[#ede9e0] text-[#282820] text-xs font-medium transition-colors disabled:opacity-50"
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
          aria-label="Connect Agent"
          title="Connect Agent"
          className="flex items-center gap-2 rounded-full bg-[#262922] p-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#3b4236] sm:px-3.5 sm:py-1.5"
        >
          <Plug className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Connect Agent</span>
        </button>
      </div>
    </header>
  );
}
