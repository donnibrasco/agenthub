import React, { useState } from 'react';
import { useBlume } from '../data/blumeStore';
import { 
  Cpu, 
  Terminal, 
  ShieldCheck, 
  Copy, 
  Check, 
  Laptop, 
  FileCode, 
  Download,
  ExternalLink,
  Layers
} from 'lucide-react';

export function FleetAndSetup() {
  const { rules, sessions } = useBlume();
  const [copiedAll, setCopiedAll] = useState(false);

  const activeRules = rules.filter(r => r.status === 'applied');

  const handleCopyAllRules = () => {
    const text = activeRules.map(r => `### ${r.title} (${r.targetFile})\n${r.ruleSnippet}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-neutral-800 bg-neutral-900/60">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            Connected Coding Agents & Active Ruleset
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Blume sidecar listens to your local coding agents (Claude Code, Cursor, Ollama, Codex) and enforces your refined ruleset.
          </p>
        </div>

        <button
          onClick={handleCopyAllRules}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-200 hover:text-white transition-colors shrink-0"
        >
          {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedAll ? 'Rules Copied!' : 'Export All Rules'}</span>
        </button>
      </div>

      {/* Terminal Sidecar Setup Card */}
      <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            Connect Your Local Agent in 10 Seconds
          </span>
          <span className="text-[11px] font-mono text-emerald-400">Local-First · Zero Cloud Upload</span>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
          Run Blume in your repository root alongside Claude Code or Cursor. Blume monitors agent session logs, catches drift, and proposes instant rule updates.
        </p>

        <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between font-mono text-xs text-amber-300">
          <code>npx @creativeprocess/blume watch --port=4040</code>
          <button
            onClick={() => {
              navigator.clipboard.writeText('npx @creativeprocess/blume watch --port=4040');
            }}
            className="text-neutral-400 hover:text-white px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-[11px]"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Connected Agents Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Watched Agent Instances
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { name: 'Claude Code CLI', runtime: 'Local Terminal', status: 'Connected', port: '4040', icon: Terminal, active: true },
            { name: 'Cursor IDE Agent', runtime: 'VS Code Extension', status: 'Connected', port: '4041', icon: Laptop, active: true },
            { name: 'Ollama Local M3', runtime: '127.0.0.1:11434', status: 'Idle', port: '11434', icon: Cpu, active: false }
          ].map(agent => {
            const Icon = agent.icon;
            return (
              <div
                key={agent.name}
                className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-white">{agent.name}</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    agent.active ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {agent.status}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 font-mono">
                  Runtime: {agent.runtime} · Port: {agent.port}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Rules Invariants */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Active Invariants & Applied Rules ({activeRules.length})
        </h3>

        <div className="space-y-3">
          {activeRules.map(rule => (
            <div key={rule.id} className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">{rule.title}</span>
                <span className="text-[11px] font-mono text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                  {rule.targetFile}
                </span>
              </div>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
                {rule.ruleSnippet}
              </pre>
            </div>
          ))}

          {activeRules.length === 0 && (
            <div className="p-6 text-center rounded-xl border border-neutral-800 text-xs text-neutral-400">
              No rules applied yet. Head over to &quot;Drift & Rules&quot; to review suggestions.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
