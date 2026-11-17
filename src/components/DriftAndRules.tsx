import React, { useState } from 'react';
import { useBlume } from '../data/blumeStore';
import { ProposedRule, DriftIncident } from '../types';
import { 
  Sparkles, 
  GitBranch, 
  Check, 
  Undo2, 
  FileCode, 
  AlertTriangle, 
  CheckCircle2, 
  Copy,
  Layers,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export function DriftAndRules() {
  const { drifts, rules, applyRule, undoRule, dismissRule } = useBlume();
  const [copiedRuleId, setCopiedRuleId] = useState<string | null>(null);

  const handleCopyRule = (rule: ProposedRule) => {
    navigator.clipboard.writeText(rule.ruleSnippet);
    setCopiedRuleId(rule.id);
    setTimeout(() => setCopiedRuleId(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-neutral-800 bg-neutral-900/60">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Drift Intelligence & Auto-Learned Rules
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Blume extracts patterns from developer nudges, mistakes, and repetitive corrections—turning them into concrete, permanent project rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400 font-mono">
            {rules.filter(r => r.status === 'suggested').length} Suggested · {rules.filter(r => r.status === 'applied').length} Active
          </span>
        </div>
      </div>

      {/* Captured Drift Incidents */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Recent Drift Incidents & Friction Clusters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {drifts.map(drift => {
            const isResolved = drift.status === 'rule_created';
            return (
              <div
                key={drift.id}
                className={`p-4 rounded-xl border transition-colors space-y-2.5 ${
                  isResolved
                    ? 'border-neutral-800 bg-neutral-900/30'
                    : 'border-amber-900/60 bg-amber-950/20'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                    {isResolved ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    {drift.title}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">
                    {drift.category.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">
                  {drift.description}
                </p>

                <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800/80 text-[11px] font-mono space-y-1">
                  <div className="text-neutral-500 text-[10px] uppercase">Developer Nudge:</div>
                  <div className="text-amber-300">&quot;{drift.developerCorrection}&quot;</div>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-neutral-500 font-mono">Agent: {drift.agentName}</span>
                  <span className={`font-mono ${isResolved ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isResolved ? 'Rule Active' : 'Proposal Ready'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-Synthesized Proposed Rules with Diff Previews */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
          Proposed Rule Updates (Diff Review & 1-Click Apply)
        </h3>

        <div className="space-y-4">
          {rules.map(rule => {
            const isApplied = rule.status === 'applied';
            return (
              <div
                key={rule.id}
                className={`p-5 rounded-xl border space-y-4 transition-all ${
                  isApplied
                    ? 'border-emerald-900/60 bg-emerald-950/10'
                    : 'border-neutral-800 bg-neutral-900/50'
                }`}
              >
                {/* Rule Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-800/80">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-white">{rule.title}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700">
                        Target: {rule.targetFile}
                      </span>
                      {isApplied && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400">{rule.reason}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCopyRule(rule)}
                      className="px-2.5 py-1 text-xs rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 flex items-center gap-1 font-mono transition-colors"
                    >
                      {copiedRuleId === rule.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedRuleId === rule.id ? 'Copied' : 'Copy'}</span>
                    </button>

                    {isApplied ? (
                      <button
                        onClick={() => undoRule(rule.id)}
                        className="px-3 py-1 text-xs rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 flex items-center gap-1 font-medium transition-colors"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Undo</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => applyRule(rule.id)}
                        className="px-3.5 py-1 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Apply to {rule.targetFile}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Unified Git Diff Preview */}
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                    <span>Unified Diff for {rule.targetFile}</span>
                    <span className="text-amber-400/90">{rule.frequency} recurring instances prevented</span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800/80 space-y-1 overflow-x-auto text-[11px] leading-relaxed">
                    <div className="text-neutral-500">--- a/{rule.targetFile}</div>
                    <div className="text-neutral-500">+++ b/{rule.targetFile}</div>
                    {rule.diffPreview.after.split('\n').map((line, i) => {
                      if (line.startsWith('+')) {
                        return (
                          <div key={i} className="text-emerald-400 bg-emerald-950/30 px-1 py-0.5 rounded">
                            {line}
                          </div>
                        );
                      }
                      return <div key={i} className="text-neutral-400">{line}</div>;
                    })}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
