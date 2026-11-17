import React, { useState } from 'react';
import { useAgentFleet } from '../context/AgentContext';
import { TelemetryTrace, TraceSpan } from '../types';
import { 
  Activity, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ShieldCheck, 
  Shield, 
  Terminal, 
  ChevronRight, 
  MessageSquare, 
  Layers, 
  Eye, 
  EyeOff, 
  Copy, 
  ExternalLink,
  Coins,
  Bug,
  Share2
} from 'lucide-react';

export function TelemetryView() {
  const { 
    traces, 
    agents, 
    selectedTraceId, 
    setSelectedTraceId, 
    setActiveTab, 
    addTraceComment 
  } = useAgentFleet();

  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | null>(null);
  const [showWireCiphertext, setShowWireCiphertext] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>('');

  // Active trace being inspected
  const currentTrace = traces.find(t => t.id === selectedTraceId) || traces[0];

  const filteredTraces = traces.filter(trace => {
    const matchesAgent = filterAgent === 'all' || trace.agentId === filterAgent;
    const matchesStatus = filterStatus === 'all' || trace.status === filterStatus;
    const matchesSearch = 
      trace.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trace.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trace.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (trace.e2eePayload.plaintextPrompt && trace.e2eePayload.plaintextPrompt.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesAgent && matchesStatus && matchesSearch;
  });

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !currentTrace) return;
    addTraceComment(currentTrace.id, 'zafarontech@gmail.com', 'Staff Engineer', newCommentText.trim());
    setNewCommentText('');
  };

  const getStatusIcon = (status: TelemetryTrace['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'throttled':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getSpanColor = (type: TraceSpan['type']) => {
    switch (type) {
      case 'agent_step':
        return 'bg-blue-500';
      case 'llm_call':
        return 'bg-cyan-400';
      case 'tool_call':
        return 'bg-amber-400';
      case 'router':
        return 'bg-purple-400';
      case 'guardrail':
        return 'bg-emerald-400';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search and Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900/60">
        <div className="flex flex-wrap items-center gap-2">
          {/* Agent Filter */}
          <select
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-slate-950 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Agents ({agents.length})</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.runtime})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-slate-950 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success Only</option>
            <option value="error">Errors & Timeouts</option>
            <option value="throttled">Throttled</option>
          </select>

          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Showing <span className="text-slate-300 tabular-nums">{filteredTraces.length}</span> traces
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search trace ID, prompt, model..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Trace Table / Right Waterfall Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Traces Stream Table (5 columns) */}
        <div className="lg:col-span-5 rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden space-y-0 divide-y divide-slate-800/80">
          <div className="px-4 py-2.5 bg-slate-900/90 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Execution Traces</span>
            <span className="font-mono text-slate-500">Latency / Status</span>
          </div>

          <div className="max-h-[640px] overflow-y-auto divide-y divide-slate-800/60">
            {filteredTraces.map(trace => {
              const isSelected = currentTrace?.id === trace.id;
              return (
                <button
                  key={trace.id}
                  onClick={() => {
                    setSelectedTraceId(trace.id);
                    setSelectedSpan(null);
                  }}
                  className={`w-full text-left p-3.5 transition-colors flex items-start justify-between gap-3 ${
                    isSelected 
                      ? 'bg-cyan-950/30 border-l-2 border-l-cyan-400' 
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(trace.status)}
                      <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                        {trace.id}
                      </span>
                      {trace.e2eePayload.encrypted && (
                        <span title="E2EE Encrypted" className="shrink-0 flex items-center">
                          <ShieldCheck className="w-3 h-3 text-cyan-400" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {trace.agentName} <span className="text-slate-600">·</span> <span className="font-mono text-slate-400">{trace.model}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {trace.e2eePayload.plaintextPrompt || 'Encrypted wire payload'}
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <span className="font-mono text-xs font-medium text-slate-200 tabular-nums block">
                      {trace.totalDurationMs}ms
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 block tabular-nums">
                      {trace.tokens.total} tok
                    </span>
                    {trace.comments.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
                        <MessageSquare className="w-2.5 h-2.5" /> {trace.comments.length}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {filteredTraces.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                No telemetry traces found.
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Trace Waterfall & Details (7 columns) */}
        {currentTrace && (
          <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-slate-900/60 p-5 space-y-5">
            
            {/* Header: ID, Agent, Quick Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white font-mono">{currentTrace.id}</h3>
                  <span className={`px-2 py-0.5 text-[11px] font-mono rounded ${
                    currentTrace.status === 'success' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}>
                    {currentTrace.status.toUpperCase()}
                  </span>
                  {currentTrace.errorType && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-rose-900/50 text-rose-200 rounded">
                      {currentTrace.errorType}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  Agent: <span className="text-slate-200 font-medium">{currentTrace.agentName}</span> ({currentTrace.runtime}) · Model: <span className="font-mono text-cyan-300">{currentTrace.model}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedTraceId(currentTrace.id);
                    setActiveTab('debugger');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors whitespace-nowrap"
                >
                  <Bug className="w-3.5 h-3.5" />
                  <span>Open in Debugger</span>
                </button>
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-500 text-[11px] block">Duration</span>
                <span className="font-mono text-slate-200 tabular-nums font-semibold">{currentTrace.totalDurationMs} ms</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Total Tokens</span>
                <span className="font-mono text-slate-200 tabular-nums">{currentTrace.tokens.total.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Estimated Cost</span>
                <span className="font-mono text-emerald-400 tabular-nums font-semibold">${currentTrace.tokens.estimatedCostUsd.toFixed(5)}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">E2EE Security</span>
                <span className="font-mono text-cyan-400 flex items-center gap-1">
                  {currentTrace.e2eePayload.encrypted ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3 text-slate-500" />}
                  {currentTrace.e2eePayload.encrypted ? 'AES-GCM' : 'Plaintext'}
                </span>
              </div>
            </div>

            {/* Multi-Span Waterfall Visualization */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Execution Spans Waterfall ({currentTrace.spans.length} steps)
                </h4>
                <span className="text-[11px] font-mono text-slate-500">
                  Total: {currentTrace.totalDurationMs}ms
                </span>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
                {currentTrace.spans.map((span, idx) => {
                  const widthPct = Math.max(8, Math.min(100, Math.round((span.durationMs / (currentTrace.totalDurationMs || 1)) * 100)));
                  const isSpanSelected = selectedSpan?.id === span.id;

                  return (
                    <div
                      key={span.id}
                      onClick={() => setSelectedSpan(isSpanSelected ? null : span)}
                      className={`p-2.5 rounded border transition-colors cursor-pointer space-y-1.5 ${
                        isSpanSelected
                          ? 'border-cyan-500 bg-slate-900'
                          : 'border-slate-800/80 hover:border-slate-700 bg-slate-900/30'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${getSpanColor(span.type)}`} />
                          <span className="font-mono font-medium text-slate-200 truncate">{span.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            ({span.type})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-xs text-slate-300 tabular-nums">{span.durationMs}ms</span>
                          <span className={`text-[10px] font-mono ${span.status === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {span.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Visual Waterfall Bar */}
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getSpanColor(span.type)}`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>

                      {/* Expanded Span Details */}
                      {isSpanSelected && (
                        <div className="mt-2 pt-2 border-t border-slate-800 text-xs font-mono space-y-2 text-slate-300">
                          <div>
                            <span className="text-slate-500 text-[10px] uppercase block">Input Summary:</span>
                            <p className="text-slate-200">{span.inputSummary}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] uppercase block">Output Summary:</span>
                            <p className="text-slate-200">{span.outputSummary}</p>
                          </div>
                          {span.toolInput && (
                            <div>
                              <span className="text-slate-500 text-[10px] uppercase block">Tool Arguments:</span>
                              <pre className="p-2 bg-slate-950 rounded text-amber-300 text-[11px] overflow-x-auto">
                                {JSON.stringify(span.toolInput, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Prompt & Completion Inspector with E2EE Wire Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  Payload & Wire Encryption Inspector
                </h4>
                {currentTrace.e2eePayload.encrypted && (
                  <button
                    onClick={() => setShowWireCiphertext(!showWireCiphertext)}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
                  >
                    {showWireCiphertext ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showWireCiphertext ? 'View Plaintext' : 'View Wire Ciphertext'}</span>
                  </button>
                )}
              </div>

              {showWireCiphertext && currentTrace.e2eePayload.encrypted ? (
                <div className="p-3 rounded-lg bg-slate-950 border border-cyan-900/60 space-y-2 text-xs font-mono">
                  <div className="text-emerald-400 flex items-center gap-1 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Zero-Knowledge E2EE Envelope Verified (AES-256-GCM)
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Key Fingerprint:</span>
                    <span className="text-cyan-300">{currentTrace.e2eePayload.keyFingerprint}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Initialization Vector (IV):</span>
                    <span className="text-slate-400">{currentTrace.e2eePayload.ivHex}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Authentication Tag:</span>
                    <span className="text-slate-400">{currentTrace.e2eePayload.tagHex}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Ciphertext (Wire payload):</span>
                    <p className="text-amber-200/90 break-all bg-slate-900/80 p-2 rounded max-h-24 overflow-y-auto">
                      {currentTrace.e2eePayload.ciphertextHex}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 text-[11px] font-mono uppercase block mb-1">User Prompt:</span>
                    <p className="text-slate-200">{currentTrace.e2eePayload.plaintextPrompt || 'Encrypted wire payload'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
                    <span className="text-slate-500 text-[11px] uppercase block mb-1">Agent Response:</span>
                    <p className="text-slate-200 whitespace-pre-wrap">{currentTrace.e2eePayload.plaintextResponse || 'Encrypted wire payload'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Collaborative Debugging Notes */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                Collaborative Team Annotations ({currentTrace.comments.length})
              </h4>

              <div className="space-y-2">
                {currentTrace.comments.map(c => (
                  <div key={c.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{c.author}</span>
                        <span className="text-[10px] text-slate-500 font-mono uppercase">{c.authorRole}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">{c.timestamp}</span>
                    </div>
                    <p className="text-slate-300">{c.text}</p>
                  </div>
                ))}

                <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                    placeholder="Add team annotation or RCA hypothesis..."
                    className="flex-1 px-3 py-1.5 text-xs rounded border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors shrink-0"
                  >
                    Post Note
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
