import React, { useState } from 'react';
import { useBlume } from '../data/blumeStore';
import { 
  Play, 
  Send, 
  AlertTriangle, 
  CheckCircle2, 
  FileCode2, 
  Terminal, 
  Cpu, 
  ArrowRight, 
  Clock, 
  Sparkles,
  RefreshCw,
  GitCommit
} from 'lucide-react';

export function LiveSessionMonitor() {
  const { 
    sessions, 
    activeSessionId, 
    setActiveSessionId, 
    simulateLivePrompt, 
    isSimulating,
    setActiveView
  } = useBlume();

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const [promptInput, setPromptInput] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || isSimulating) return;
    const text = promptInput;
    setPromptInput('');
    await simulateLivePrompt(text);
  };

  const handleQuickNudge = async (nudge: string) => {
    setPromptInput(nudge);
    await simulateLivePrompt(nudge);
  };

  return (
    <div className="space-y-5">
      
      {/* Top Session Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-neutral-800 border border-neutral-700">
            <Cpu className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">{activeSession.agentName}</h2>
              <span className="text-[11px] font-mono text-neutral-400">
                · {activeSession.repository}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Live sidecar monitoring agent actions, file edits, and intent drift.
            </p>
          </div>
        </div>

        {/* Session Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 font-mono">Session:</span>
          <select
            value={activeSession.id}
            onChange={e => setActiveSessionId(e.target.value)}
            className="px-2.5 py-1 text-xs rounded border border-neutral-700 bg-neutral-950 text-neutral-200 font-mono focus:outline-none focus:border-amber-400"
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.agentName} ({s.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Timeline Card Container */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Session Event Stream ({activeSession.events.length} events)
            </h3>
          </div>
          <div className="text-xs font-mono text-neutral-400 flex items-center gap-3">
            <span>Tokens: {activeSession.tokens.prompt + activeSession.tokens.completion}</span>
            <span>Files: {activeSession.filesModified.length}</span>
            {activeSession.driftsCount > 0 && (
              <button
                onClick={() => setActiveView('drifts')}
                className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{activeSession.driftsCount} Drifts Captured</span>
              </button>
            )}
          </div>
        </div>

        {/* Event Timeline */}
        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {activeSession.events.map((event, idx) => {
            if (event.type === 'prompt') {
              return (
                <div key={event.id} className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                    <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                      <Terminal className="w-3 h-3" /> Developer Prompt
                    </span>
                    <span>{event.timestamp}</span>
                  </div>
                  <p className="text-xs text-neutral-200 font-sans leading-relaxed">{event.content}</p>
                </div>
              );
            }

            if (event.type === 'agent_thought') {
              return (
                <div key={event.id} className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800/80 text-xs text-neutral-300 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                    <span className="flex items-center gap-1 text-purple-400">
                      <Sparkles className="w-3 h-3" /> Agent Reasoning
                    </span>
                    <span>{event.timestamp}</span>
                  </div>
                  <p className="font-mono text-neutral-400 text-[11px] leading-relaxed">{event.content}</p>
                </div>
              );
            }

            if (event.type === 'tool_call') {
              return (
                <div key={event.id} className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-cyan-400 flex items-center gap-1.5">
                      <FileCode2 className="w-3 h-3" /> {event.toolName || 'Tool Execution'}
                    </span>
                    <span className="text-[10px] text-neutral-500">{event.timestamp}</span>
                  </div>
                  <p className="text-neutral-300 text-[11px]">{event.content}</p>
                </div>
              );
            }

            if (event.type === 'file_diff') {
              return (
                <div key={event.id} className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <GitCommit className="w-3 h-3 text-cyan-400" /> Diff: {event.fileName}
                    </span>
                    <span className="text-[10px] text-neutral-500">{event.timestamp}</span>
                  </div>
                  {event.diff && (
                    <div className="space-y-0.5 text-[11px] bg-neutral-900/90 p-2 rounded">
                      {event.diff.added.map((line, i) => (
                        <div key={i} className="text-emerald-400">+ {line}</div>
                      ))}
                      {event.diff.removed.map((line, i) => (
                        <div key={i} className="text-rose-400">- {line}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            if (event.type === 'correction') {
              return (
                <div key={event.id} className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-amber-400 font-mono">
                    <span className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> Developer Correction / Nudge
                    </span>
                    <span>{event.timestamp}</span>
                  </div>
                  <p className="text-xs text-amber-200 font-medium leading-relaxed">{event.content}</p>
                </div>
              );
            }

            if (event.type === 'drift_alert') {
              return (
                <div key={event.id} className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/80 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="font-semibold text-rose-300 font-mono flex items-center gap-1.5 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      Blume Drift Captured
                    </span>
                    <p className="text-neutral-300 leading-relaxed">{event.content}</p>
                  </div>
                  <button
                    onClick={() => setActiveView('drifts')}
                    className="px-2.5 py-1 text-xs font-medium text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded shrink-0 whitespace-nowrap"
                  >
                    Review Proposed Rule
                  </button>
                </div>
              );
            }

            return null;
          })}
        </div>

        {/* Live Interactive Developer Nudge Bar */}
        <div className="pt-3 border-t border-neutral-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-medium">Send Live Prompt or Nudge Agent:</span>
            <span className="text-[11px] font-mono text-neutral-500">
              Try testing a correction to watch Blume synthesize a rule
            </span>
          </div>

          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={promptInput}
              onChange={e => setPromptInput(e.target.value)}
              placeholder="e.g. 'No, do not use inline styles, always use Tailwind CSS classes!'"
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={isSimulating}
              className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Watching...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Nudges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-neutral-500">Quick tests:</span>
            <button
              onClick={() => handleQuickNudge("No, do not use inline styles! Always use Tailwind CSS classes.")}
              className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 font-mono transition-colors"
            >
              Nudge: Strict Tailwind
            </button>
            <button
              onClick={() => handleQuickNudge("You forgot to run the unit tests and lint check before finishing!")}
              className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 font-mono transition-colors"
            >
              Nudge: Run Tests & Lint
            </button>
            <button
              onClick={() => handleQuickNudge("Make sure to preserve active API handlers and do not mock data.")}
              className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 font-mono transition-colors"
            >
              Nudge: Real Handlers
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
