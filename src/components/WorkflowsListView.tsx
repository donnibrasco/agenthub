import React, { useState } from 'react';
import { useNeuro } from '../context/NeuroContext';
import { GitBranch, Play, CheckCircle2, Clock, Plus, Layers, ArrowRight } from 'lucide-react';

export function WorkflowsListView() {
  const { workflows, searchQuery } = useNeuro();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [successLogs, setSuccessLogs] = useState<Record<string, string>>({});

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleWorkflows = normalizedQuery
    ? workflows.filter(
        wf =>
          wf.title.toLowerCase().includes(normalizedQuery) ||
          wf.description.toLowerCase().includes(normalizedQuery)
      )
    : workflows;

  const handleRunWorkflow = async (id: string, title: string) => {
    setRunningId(id);
    await new Promise(r => setTimeout(r, 800));
    setRunningId(null);
    setSuccessLogs(prev => ({
      ...prev,
      [id]: `Workflow "${title}" executed successfully across all nodes with 0 errors.`
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#1B1C1E] border border-[#27292C]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Automated AI Workflows</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Multi-step agent pipelines, semantic routing, and conditional guardrails connecting your tool stack.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {visibleWorkflows.map(wf => (
          <div
            key={wf.id}
            className="p-5 rounded-3xl bg-[#1D1E20] border border-[#27292C] space-y-3 hover:border-neutral-600 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#252629] flex items-center justify-center text-white">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">{wf.title}</h3>
                  <div className="text-[11px] text-neutral-400 font-mono">
                    {wf.stepsCount} Nodes · Last Run: {wf.lastRun}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleRunWorkflow(wf.id, wf.title)}
                disabled={runningId === wf.id}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2A2C30] hover:bg-[#34363A] disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                {runningId === wf.id ? (
                  <span>Executing...</span>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Flow</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed font-sans">
              {wf.description}
            </p>

            {successLogs[wf.id] && (
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/80 text-emerald-300 text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{successLogs[wf.id]}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
