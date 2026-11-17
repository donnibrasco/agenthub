import React, { useState } from 'react';
import { useNeuro } from '../context/NeuroContext';
import { 
  Bot, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  Database, 
  Sparkles,
  X 
} from 'lucide-react';

export function LaunchAgentModal() {
  const { activeLaunchAgent, setActiveLaunchAgent, launchAgentPrompt } = useNeuro();
  const [promptText, setPromptText] = useState('Draft an executive summary and check compliance invariants.');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (!activeLaunchAgent) return null;

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim() || isExecuting) return;
    setIsExecuting(true);
    setResult(null);

    try {
      const res = await launchAgentPrompt(activeLaunchAgent.id, promptText);
      setResult(res);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl border border-[#2B2D31] bg-[#18191B] p-6 space-y-4 shadow-2xl text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A2B2E]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#252629] text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {activeLaunchAgent.name}
              </h3>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                Model: <span className="text-blue-400">{activeLaunchAgent.model}</span> · Category: {activeLaunchAgent.category}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveLaunchAgent(null)}
            className="text-neutral-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prompt Input Form */}
        <form onSubmit={handleRun} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs text-neutral-400 font-medium">Input Prompt / Instructions:</label>
            <textarea
              rows={4}
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              placeholder="Enter prompt to test this connected model..."
              className="w-full p-3 text-xs rounded-2xl border border-[#2E3034] bg-[#121314] text-slate-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400 leading-relaxed font-sans"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
              <Database className="w-3.5 h-3.5 text-neutral-500" />
              <span>Tokens processed: {activeLaunchAgent.tokens}</span>
            </div>

            <button
              type="submit"
              disabled={isExecuting}
              className="px-5 py-2 text-xs font-bold text-neutral-950 bg-white hover:bg-neutral-100 disabled:opacity-50 rounded-full transition-colors flex items-center gap-2 shadow-sm"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Run Prompt on Model</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Execution Output */}
        {result && (
          <div className="p-4 rounded-2xl bg-[#121314] border border-[#2A2B2E] space-y-2 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Execution Verified · Added to Recent Activity</span>
            </div>
            <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed text-[11px] max-h-48 overflow-y-auto">
              {result}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
}
