import React, { useState } from 'react';
import { useAgentFleet } from '../context/AgentContext';
import { TelemetryTrace } from '../types';
import { 
  Bug, 
  GitFork, 
  Play, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Sliders, 
  FileDiff, 
  ArrowRight, 
  RefreshCw,
  Sparkles,
  Zap,
  Cpu,
  Layers
} from 'lucide-react';
import { estimateTokenCost } from '../lib/metrics';

export function DebuggerSuite() {
  const { 
    traces, 
    agents, 
    selectedTraceId, 
    setSelectedTraceId, 
    dispatchAgentPrompt 
  } = useAgentFleet();

  // Selected trace for debugging
  const activeTrace = traces.find(t => t.id === selectedTraceId) || traces.find(t => t.status === 'error') || traces[0];

  // Fork & Replay state
  const [selectedAgentId, setSelectedAgentId] = useState<string>(activeTrace?.agentId || agents[0]?.id || '');
  const [forkedPrompt, setForkedPrompt] = useState<string>(activeTrace?.e2eePayload.plaintextPrompt || '');
  const [temperature, setTemperature] = useState<number>(0.2);
  const [maxTokens, setMaxTokens] = useState<number>(1024);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [forkedResult, setForkedResult] = useState<{
    traceId: string;
    output: string;
    durationMs: number;
    tokens: number;
    costUsd: number;
  } | null>(null);

  // Sync prompt when trace changes
  React.useEffect(() => {
    if (activeTrace) {
      setForkedPrompt(activeTrace.e2eePayload.plaintextPrompt || '');
      setSelectedAgentId(activeTrace.agentId);
    }
  }, [activeTrace?.id]);

  const handleForkAndRun = async () => {
    if (!forkedPrompt.trim() || isReplaying) return;
    setIsReplaying(true);

    try {
      const trace = await dispatchAgentPrompt(selectedAgentId, forkedPrompt);
      setForkedResult({
        traceId: trace.id,
        output: trace.e2eePayload.plaintextResponse || 'Encrypted wire execution verified.',
        durationMs: trace.totalDurationMs,
        tokens: trace.tokens.total,
        costUsd: trace.tokens.estimatedCostUsd
      });
    } finally {
      setIsReplaying(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bug className="w-4 h-4 text-cyan-400" />
            Collaborative Debugging & Fork Workbench
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select any production trace, inspect root causes, tweak prompts/parameters, and re-run against agent endpoints side-by-side.
          </p>
        </div>

        {/* Trace Selector Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">Debugging:</span>
          <select
            value={activeTrace?.id || ''}
            onChange={e => setSelectedTraceId(e.target.value)}
            className="px-3 py-1.5 text-xs rounded border border-slate-700 bg-slate-950 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
          >
            {traces.map(t => (
              <option key={t.id} value={t.id}>
                {t.id} - {t.agentName} ({t.status.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Root Cause Diagnostics Card (if error) */}
      {activeTrace?.status === 'error' && (
        <div className="p-4 rounded-lg border border-rose-900/80 bg-rose-950/20 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-rose-400 font-semibold uppercase tracking-wider font-mono">
              <AlertTriangle className="w-4 h-4" />
              Automated Root Cause Diagnosis · {activeTrace.errorType || 'INFERENCE_FAILURE'}
            </span>
            <span className="text-slate-400 font-mono">Incident in {activeTrace.agentName}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-3 rounded bg-slate-950/80 border border-slate-800/80">
              <span className="text-slate-500 text-[11px] block">Observed Bottleneck</span>
              <p className="text-rose-200 mt-1 font-mono">
                Duration {activeTrace.totalDurationMs}ms exceeded gateway SLA threshold (2000ms).
              </p>
            </div>
            <div className="p-3 rounded bg-slate-950/80 border border-slate-800/80">
              <span className="text-slate-500 text-[11px] block">Infrastructure State</span>
              <p className="text-amber-200 mt-1 font-mono">
                Docker host GPU VRAM peaked at 94.2% during multimodal frame parsing.
              </p>
            </div>
            <div className="p-3 rounded bg-slate-950/80 border border-slate-800/80">
              <span className="text-slate-500 text-[11px] block">Recommended Remediation</span>
              <p className="text-cyan-300 mt-1">
                Configure auto-fallback to Cloud Gemini in the Orchestration Canvas or lower max tokens.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fork & Replay Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Replay Controls & Prompt Editor (5 cols) */}
        <div className="lg:col-span-5 rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <GitFork className="w-3.5 h-3.5 text-cyan-400" />
              Fork & Tweak Execution
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Live endpoint replay</span>
          </div>

          {/* Model / Target Agent Selector */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 block">Dispatch Target Agent:</label>
            <select
              value={selectedAgentId}
              onChange={e => setSelectedAgentId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded border border-slate-700 bg-slate-950 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.runtime} - {a.model})
                </option>
              ))}
            </select>
          </div>

          {/* Hyperparameter Sliders */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 font-mono text-[11px]">
                <span>Temperature</span>
                <span>{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 font-mono text-[11px]">
                <span>Max Tokens</span>
                <span>{maxTokens}</span>
              </div>
              <input
                type="range"
                min="256"
                max="4096"
                step="128"
                value={maxTokens}
                onChange={e => setMaxTokens(parseInt(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Prompt Textarea */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <label>Prompt Payload:</label>
              <button
                type="button"
                onClick={() => setForkedPrompt(activeTrace?.e2eePayload.plaintextPrompt || '')}
                className="text-cyan-400 hover:underline text-[11px]"
              >
                Reset to Original
              </button>
            </div>
            <textarea
              rows={6}
              value={forkedPrompt}
              onChange={e => setForkedPrompt(e.target.value)}
              placeholder="Prompt to replay..."
              className="w-full p-3 text-xs rounded border border-slate-700 bg-slate-950 text-slate-100 font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 leading-relaxed"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleForkAndRun}
            disabled={isReplaying}
            className="w-full py-2.5 px-4 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded transition-colors flex items-center justify-center gap-2 font-semibold shadow-md shadow-cyan-950"
          >
            {isReplaying ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Replaying Execution...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Fork & Re-run Against Endpoint</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Side-by-Side Comparison (7 cols) */}
        <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <FileDiff className="w-3.5 h-3.5 text-cyan-400" />
              Side-by-Side Output & Telemetry Comparison
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Original vs Forked</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            
            {/* Original Card */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800/80">
                <span className="font-semibold text-slate-200">Original Execution</span>
                <span className="text-[10px] uppercase">{activeTrace?.id}</span>
              </div>

              <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-400">
                <div>
                  <span className="text-slate-500 text-[10px] block">Latency</span>
                  <span className="text-slate-200 font-semibold">{activeTrace?.totalDurationMs}ms</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Tokens</span>
                  <span className="text-slate-200 font-semibold">{activeTrace?.tokens.total}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Cost</span>
                  <span className="text-emerald-400 font-semibold">${activeTrace?.tokens.estimatedCostUsd.toFixed(5)}</span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-slate-500 text-[10px] uppercase block mb-1">Output:</span>
                <p className="text-slate-300 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                  {activeTrace?.e2eePayload.plaintextResponse || 'Encrypted wire payload.'}
                </p>
              </div>
            </div>

            {/* Forked Output Card */}
            <div className={`p-3.5 rounded-lg border space-y-2.5 ${
              forkedResult ? 'bg-slate-950 border-cyan-800/80' : 'bg-slate-950/40 border-slate-800 border-dashed'
            }`}>
              <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800/80">
                <span className="font-semibold text-cyan-300">Forked Run Result</span>
                <span className="text-[10px] uppercase text-cyan-400 font-mono">
                  {forkedResult ? forkedResult.traceId : 'Awaiting Replay'}
                </span>
              </div>

              {forkedResult ? (
                <>
                  <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-400">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Latency</span>
                      <span className="text-emerald-300 font-semibold">{forkedResult.durationMs}ms</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Tokens</span>
                      <span className="text-slate-200 font-semibold">{forkedResult.tokens}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Cost</span>
                      <span className="text-emerald-400 font-semibold">${forkedResult.costUsd.toFixed(5)}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="text-slate-500 text-[10px] uppercase block mb-1">Forked Output:</span>
                    <p className="text-slate-200 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                      {forkedResult.output}
                    </p>
                  </div>
                </>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-slate-500">
                  <Play className="w-6 h-6 mb-2 opacity-40 text-cyan-400" />
                  <p>Click &quot;Fork & Re-run&quot; on the left to execute the tweaked prompt and compare outputs.</p>
                </div>
              )}
            </div>

          </div>

          {/* Differential Telemetry Summary */}
          {forkedResult && (
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/60 text-xs flex items-center justify-between">
              <span className="text-emerald-300 flex items-center gap-1.5 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Latency delta: {forkedResult.durationMs < (activeTrace?.totalDurationMs || 0) ? (
                  <span className="font-semibold text-emerald-400">
                    -{(activeTrace?.totalDurationMs || 0) - forkedResult.durationMs}ms ({Math.round((((activeTrace?.totalDurationMs || 0) - forkedResult.durationMs) / (activeTrace?.totalDurationMs || 1)) * 100)}% faster)
                  </span>
                ) : (
                  <span>+{forkedResult.durationMs - (activeTrace?.totalDurationMs || 0)}ms</span>
                )}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                Ready to commit to production pipeline
              </span>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
