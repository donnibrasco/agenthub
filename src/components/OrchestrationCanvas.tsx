import React, { useState } from 'react';
import { useAgentFleet } from '../context/AgentContext';
import { 
  GitBranch, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  ShieldCheck, 
  Terminal, 
  RefreshCw, 
  Sliders, 
  ArrowRight,
  Server,
  Cloud,
  Cpu,
  Boxes
} from 'lucide-react';

export function OrchestrationCanvas() {
  const { 
    pipelines, 
    agents, 
    runPipelineExecution 
  } = useAgentFleet();

  const [activePipelineId, setActivePipelineId] = useState<string>(pipelines[0]?.id || '');
  const pipeline = pipelines.find(p => p.id === activePipelineId) || pipelines[0];

  const [testPrompt, setTestPrompt] = useState<string>('Refactor authentication hook to support zero-knowledge E2EE key derivation and verify tests.');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [stepLogs, setStepLogs] = useState<string[]>([]);
  const [runResult, setRunResult] = useState<{ success: boolean; latencyMs: number; output: string } | null>(null);
  const [failoverThresholdMs, setFailoverThresholdMs] = useState<number>(800);

  const handleRunPipeline = async () => {
    if (!testPrompt.trim() || isRunning) return;
    setIsRunning(true);
    setRunResult(null);
    setStepLogs([]);

    try {
      const res = await runPipelineExecution(pipeline.id, testPrompt, (nodeId, log) => {
        setActiveNodeId(nodeId);
        setStepLogs(prev => [...prev, log]);
      });
      setRunResult(res);
      setActiveNodeId(null);
    } finally {
      setIsRunning(false);
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'entry':
        return <Terminal className="w-4 h-4 text-cyan-400" />;
      case 'classifier':
        return <GitBranch className="w-4 h-4 text-blue-400" />;
      case 'agent':
        return <Cpu className="w-4 h-4 text-purple-400" />;
      case 'tool':
        return <Boxes className="w-4 h-4 text-amber-400" />;
      case 'evaluator':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'exit':
        return <CheckCircle2 className="w-4 h-4 text-cyan-400" />;
      default:
        return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-cyan-400" />
            Model Orchestration & Data Pipeline Canvas
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Design multi-agent fallback topologies, hybrid routing between local workstations and cloud clusters, and automated safety guardrails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">Strategy:</span>
          <span className="px-2.5 py-1 text-xs font-mono rounded bg-slate-950 border border-slate-800 text-cyan-300">
            {pipeline.strategy.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-slate-900/40 border border-slate-800">
          <span className="text-slate-500 text-[11px] block">Total Orchestrated Runs</span>
          <span className="text-xl font-bold font-mono text-white tabular-nums">
            {pipeline.executionStats.totalRuns.toLocaleString()}
          </span>
        </div>
        <div className="p-3.5 rounded-lg bg-slate-900/40 border border-slate-800">
          <span className="text-slate-500 text-[11px] block">Fallback Trigger Rate</span>
          <span className="text-xl font-bold font-mono text-amber-400 tabular-nums">
            {pipeline.executionStats.fallbackTriggerRate}%
          </span>
        </div>
        <div className="p-3.5 rounded-lg bg-slate-900/40 border border-slate-800">
          <span className="text-slate-500 text-[11px] block">Avg End-to-End Latency</span>
          <span className="text-xl font-bold font-mono text-cyan-400 tabular-nums">
            {pipeline.executionStats.avgLatencyMs} ms
          </span>
        </div>
        <div className="p-3.5 rounded-lg bg-slate-900/40 border border-slate-800">
          <span className="text-slate-500 text-[11px] block">SLA Success Rate</span>
          <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
            {pipeline.executionStats.successRate}%
          </span>
        </div>
      </div>

      {/* Visual Pipeline Topology Canvas */}
      <div className="p-6 rounded-lg border border-slate-800 bg-slate-950/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">{pipeline.name}</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {pipeline.description}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-xs text-slate-400 font-mono">
              Failover Latency: <span className="text-cyan-300">{failoverThresholdMs}ms</span>
            </div>
          </div>
        </div>

        {/* Nodes Flow Diagram */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 relative py-4">
          {pipeline.nodes.map((node, index) => {
            const isActive = activeNodeId === node.id;
            return (
              <div
                key={node.id}
                className={`p-3.5 rounded-lg border transition-all flex flex-col justify-between space-y-3 relative ${
                  isActive
                    ? 'border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-950/80 scale-[1.02]'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="p-1 rounded bg-slate-800 border border-slate-700">
                      {getNodeIcon(node.type)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      0{index + 1}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 tracking-tight leading-tight">
                    {node.label}
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {node.config.description}
                  </p>
                </div>

                {node.type === 'agent' && (
                  <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-cyan-400 space-y-0.5">
                    <div>Primary: Local M3</div>
                    <div className="text-slate-400">Fallback: Cloud Gemini</div>
                  </div>
                )}

                {isActive && (
                  <div className="text-[10px] font-mono text-cyan-300 animate-pulse flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Executing...
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Interactive Runner Bar */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
            <span className="font-semibold text-slate-200">Test Pipeline Execution</span>
            <span className="font-mono text-[11px]">Triggers full end-to-end node simulation</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={testPrompt}
              onChange={e => setTestPrompt(e.target.value)}
              placeholder="Prompt to send through pipeline..."
              className="flex-1 px-3 py-2 text-xs rounded border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleRunPipeline}
              disabled={isRunning}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm shadow-cyan-950"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing Pipeline...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Pipeline Test</span>
                </>
              )}
            </button>
          </div>

          {/* Real-time Step Logs during run */}
          {stepLogs.length > 0 && (
            <div className="p-3 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 space-y-1 max-h-36 overflow-y-auto">
              {stepLogs.map((log, i) => (
                <div key={i} className="flex items-center gap-2 text-cyan-300">
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span>{log}</span>
                </div>
              ))}
              {runResult && (
                <div className="pt-2 text-emerald-400 font-semibold flex items-center gap-1.5 border-t border-slate-800 mt-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {runResult.output} ({runResult.latencyMs}ms total)
                </div>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
