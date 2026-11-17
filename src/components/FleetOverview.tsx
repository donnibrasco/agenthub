import React, { useState } from 'react';
import { useAgentFleet } from '../context/AgentContext';
import { DeploymentRuntime, AgentDeployment } from '../types';
import { 
  Server, 
  Laptop, 
  Cloud, 
  Boxes, 
  Shield, 
  ShieldCheck, 
  ShieldAlert,
  Send, 
  Terminal, 
  Activity, 
  RefreshCw, 
  ExternalLink,
  Code2,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { generateSdkSnippet } from '../lib/orchestration';

export function FleetOverview() {
  const { 
    agents, 
    toggleAgentE2EE, 
    pingAgent, 
    dispatchAgentPrompt, 
    setSelectedAgentId, 
    setActiveTab, 
    setSelectedTraceId,
    setIsConnectModalOpen 
  } = useAgentFleet();

  const [runtimeFilter, setRuntimeFilter] = useState<'all' | DeploymentRuntime>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDispatchAgentId, setActiveDispatchAgentId] = useState<string>(agents[0]?.id || '');
  const [dispatchPromptText, setDispatchPromptText] = useState('Analyze the system AST tokens for landing page components and verify zero layout clipping.');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{ traceId: string; response: string } | null>(null);
  const [inspectedAgentForSnippet, setInspectedAgentForSnippet] = useState<AgentDeployment | null>(null);
  const [snippetLang, setSnippetLang] = useState<'python' | 'typescript' | 'curl' | 'docker'>('typescript');

  // Filtered agents
  const filteredAgents = agents.filter(agent => {
    const matchesRuntime = runtimeFilter === 'all' || agent.runtime === runtimeFilter;
    const matchesSearch = 
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.hostEndpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRuntime && matchesSearch;
  });

  // Calculate fleet stats
  const totalAgents = agents.length;
  const nominalAgents = agents.filter(a => a.status === 'nominal').length;
  const totalVramUsedMb = agents.reduce((acc, a) => acc + a.resourceUsage.gpuVramMb, 0);
  const totalVramMaxMb = agents.reduce((acc, a) => acc + a.resourceUsage.gpuVramTotalMb, 0);
  const avgLatency = Math.round(agents.reduce((acc, a) => acc + a.health.latencyMs, 0) / (totalAgents || 1));
  const e2eeProtected = agents.filter(a => a.e2eeEnabled).length;

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDispatchAgentId || !dispatchPromptText.trim() || isDispatching) return;

    setIsDispatching(true);
    setDispatchResult(null);

    try {
      const trace = await dispatchAgentPrompt(activeDispatchAgentId, dispatchPromptText);
      setDispatchResult({
        traceId: trace.id,
        response: trace.e2eePayload.plaintextResponse || 'Encrypted wire payload received and verified.'
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const getRuntimeIcon = (runtime: DeploymentRuntime) => {
    switch (runtime) {
      case 'local':
        return <Laptop className="w-3.5 h-3.5 text-amber-400" />;
      case 'cloud':
        return <Cloud className="w-3.5 h-3.5 text-cyan-400" />;
      case 'kubernetes':
        return <Boxes className="w-3.5 h-3.5 text-blue-400" />;
      case 'self-hosted':
        return <Server className="w-3.5 h-3.5 text-purple-400" />;
      case 'edge':
        return <Layers className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const getStatusBadge = (status: AgentDeployment['status']) => {
    switch (status) {
      case 'nominal':
        return (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Nominal</span>
          </span>
        );
      case 'degraded':
        return (
          <span className="flex items-center gap-1.5 text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Degraded</span>
          </span>
        );
      case 'syncing':
        return (
          <span className="flex items-center gap-1.5 text-xs text-blue-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Syncing</span>
          </span>
        );
      case 'offline':
        return (
          <span className="flex items-center gap-1.5 text-xs text-rose-400">
            <XCircle className="w-3.5 h-3.5" />
            <span>Offline</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400">Fleet Availability</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">{nominalAgents} / {totalAgents}</span>
            <span className="text-xs text-emerald-400 font-mono">
              {Math.round((nominalAgents / (totalAgents || 1)) * 100)}% Online
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Local, K8s, Cloud & Self-Hosted
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400">Average Latency (p50)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">{avgLatency}</span>
            <span className="text-xs text-slate-400">ms</span>
            <span className="text-xs text-cyan-400 font-mono">SLA &lt;800ms</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Across hybrid model endpoints
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400">Fleet GPU VRAM Load</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {(totalVramUsedMb / 1024).toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">/ {(totalVramMaxMb / 1024).toFixed(0)} GB</span>
            <span className="text-xs text-purple-400 font-mono">
              {totalVramMaxMb > 0 ? Math.round((totalVramUsedMb / totalVramMaxMb) * 100) : 0}%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Self-hosted cluster + local GPUs
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400">E2EE Cryptographic Shield</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">{e2eeProtected} / {totalAgents}</span>
            <span className="text-xs text-cyan-300 font-mono">AES-GCM-256</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Client-side encrypted payload transit
          </div>
        </div>
      </div>

      {/* Interactive Quick Dispatch Console */}
      <div className="p-4 sm:p-5 rounded-lg border border-slate-800 bg-slate-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Live Prompt Dispatcher & Telemetry Recorder
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Send an interactive prompt to any connected agent to record live execution traces, waterfalls, and encrypted envelopes.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 self-start sm:self-auto">
            Target: <span className="text-cyan-300">{agents.find(a => a.id === activeDispatchAgentId)?.name || 'Select Agent'}</span>
          </span>
        </div>

        <form onSubmit={handleDispatch} className="mt-3.5 space-y-3">
          <div className="flex flex-col md:flex-row gap-2.5">
            <select
              value={activeDispatchAgentId}
              onChange={e => setActiveDispatchAgentId(e.target.value)}
              className="px-3 py-2 text-xs rounded border border-slate-700 bg-slate-950 text-slate-200 focus:outline-none focus:border-cyan-500 md:w-64 shrink-0 font-mono"
            >
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.runtime} - {agent.model})
                </option>
              ))}
            </select>

            <input
              type="text"
              value={dispatchPromptText}
              onChange={e => setDispatchPromptText(e.target.value)}
              placeholder="Enter prompt to execute on agent..."
              className="flex-1 px-3 py-2 text-xs rounded border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />

            <button
              type="submit"
              disabled={isDispatching}
              className="px-4 py-2 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded transition-colors flex items-center justify-center gap-2 shrink-0 font-medium"
            >
              {isDispatching ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Prompt</span>
                </>
              )}
            </button>
          </div>

          {dispatchResult && (
            <div className="mt-3 p-3 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono space-y-2">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-1.5">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Trace Generated: <span className="text-white">{dispatchResult.traceId}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTraceId(dispatchResult.traceId);
                    setActiveTab('telemetry');
                  }}
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  View Waterfall <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <p className="text-slate-200 whitespace-pre-wrap">{dispatchResult.response}</p>
            </div>
          )}
        </form>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Runtime Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto">
          {(['all', 'local', 'cloud', 'kubernetes', 'self-hosted', 'edge'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setRuntimeFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap capitalize ${
                runtimeFilter === tab
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'all' ? 'All Deployments' : tab}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search agents, models, tags..."
            className="w-full sm:w-64 px-3 py-1.5 text-xs rounded-md border border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredAgents.map(agent => {
          const vramPct = agent.resourceUsage.gpuVramTotalMb > 0 
            ? Math.round((agent.resourceUsage.gpuVramMb / agent.resourceUsage.gpuVramTotalMb) * 100) 
            : 0;

          return (
            <div
              key={agent.id}
              className="p-5 rounded-lg border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-colors space-y-4"
            >
              {/* Header: Name, Runtime, and Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-slate-800 border border-slate-700" title={`Runtime: ${agent.runtime}`}>
                      {getRuntimeIcon(agent.runtime)}
                    </span>
                    <h3 className="text-sm font-semibold text-white tracking-tight">{agent.name}</h3>
                    <span className="text-[11px] font-mono text-slate-400 uppercase">
                      {agent.runtime}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Model: <span className="text-cyan-300">{agent.model}</span> · Host: <span className="text-slate-300">{agent.hostEndpoint}</span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {getStatusBadge(agent.status)}
                </div>
              </div>

              {/* Status Message */}
              {agent.statusMessage && (
                <div className="text-xs text-slate-400 bg-slate-950/70 p-2.5 rounded border border-slate-800/80 font-mono">
                  {agent.statusMessage}
                </div>
              )}

              {/* Telemetry Metrics Row */}
              <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Latency</span>
                  <span className="font-mono text-slate-200 tabular-nums">{agent.health.latencyMs}ms</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Uptime</span>
                  <span className="font-mono text-slate-200 tabular-nums">{agent.health.uptimePercent}%</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Error Rate</span>
                  <span className={`font-mono tabular-nums ${agent.health.errorRatePercent > 5 ? 'text-rose-400' : 'text-slate-200'}`}>
                    {agent.health.errorRatePercent}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Active Tasks</span>
                  <span className="font-mono text-slate-200 tabular-nums">{agent.health.activeTasks}</span>
                </div>
              </div>

              {/* Resource Load Bar (if GPU/CPU present) */}
              <div className="space-y-1.5 pt-1 text-xs">
                {agent.resourceUsage.gpuVramTotalMb > 0 && (
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono mb-1">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-purple-400" /> GPU VRAM
                      </span>
                      <span>
                        {(agent.resourceUsage.gpuVramMb / 1024).toFixed(1)} / {(agent.resourceUsage.gpuVramTotalMb / 1024).toFixed(0)} GB ({vramPct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${vramPct > 85 ? 'bg-rose-500' : vramPct > 70 ? 'bg-amber-400' : 'bg-purple-500'}`}
                        style={{ width: `${Math.min(100, vramPct)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono mb-1">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-cyan-400" /> CPU Load
                    </span>
                    <span>{agent.resourceUsage.cpuPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 transition-all"
                      style={{ width: `${Math.min(100, agent.resourceUsage.cpuPercent)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Footer: E2EE Toggle & Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                <button
                  onClick={() => toggleAgentE2EE(agent.id)}
                  title="Toggle AES-256-GCM End-to-End Encryption"
                  className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors font-mono ${
                    agent.e2eeEnabled
                      ? 'border-cyan-800 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-950/60'
                      : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {agent.e2eeEnabled ? <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> : <Shield className="w-3.5 h-3.5" />}
                  <span>{agent.e2eeEnabled ? 'E2EE Active' : 'E2EE Disabled'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => pingAgent(agent.id)}
                    title="Send Health Ping"
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setInspectedAgentForSnippet(agent)}
                    title="View SDK Integration Snippet"
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>SDK</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedAgentId(agent.id);
                      setActiveDispatchAgentId(agent.id);
                      window.scrollTo({ top: 120, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    <span>Dispatch</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAgents.length === 0 && (
        <div className="p-12 text-center rounded-lg border border-slate-800 bg-slate-900/30">
          <p className="text-sm text-slate-400">No agents found matching &quot;{searchQuery}&quot;.</p>
          <button
            onClick={() => { setSearchQuery(''); setRuntimeFilter('all'); }}
            className="mt-3 px-3 py-1.5 text-xs text-cyan-400 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* SDK Snippet Modal */}
      {inspectedAgentForSnippet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-950 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Connect {inspectedAgentForSnippet.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Embed CreativeProcess telemetry and E2EE agent client into your service.
                </p>
              </div>
              <button
                onClick={() => setInspectedAgentForSnippet(null)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-2 p-1 bg-slate-900 rounded border border-slate-800">
              {(['typescript', 'python', 'curl', 'docker'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => setSnippetLang(lang)}
                  className={`px-3 py-1 text-xs rounded font-mono capitalize ${
                    snippetLang === lang ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Code Block */}
            <pre className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre leading-relaxed max-h-96">
              {generateSdkSnippet(snippetLang, {
                name: inspectedAgentForSnippet.name,
                endpoint: inspectedAgentForSnippet.hostEndpoint,
                token: `${inspectedAgentForSnippet.authTokenPrefix}_prod_sec_${Date.now().toString(36)}`,
                e2ee: inspectedAgentForSnippet.e2eeEnabled,
                fingerprint: inspectedAgentForSnippet.e2eeKeyFingerprint
              })}
            </pre>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    generateSdkSnippet(snippetLang, {
                      name: inspectedAgentForSnippet.name,
                      endpoint: inspectedAgentForSnippet.hostEndpoint,
                      token: `${inspectedAgentForSnippet.authTokenPrefix}_prod_sec_${Date.now().toString(36)}`,
                      e2ee: inspectedAgentForSnippet.e2eeEnabled,
                      fingerprint: inspectedAgentForSnippet.e2eeKeyFingerprint
                    })
                  );
                }}
                className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setInspectedAgentForSnippet(null)}
                className="px-4 py-2 text-xs font-medium bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
