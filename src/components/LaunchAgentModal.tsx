import React, { useState, useEffect } from 'react';
import { AssistantMessage } from './ChatMessage';
import { submitOnEnter } from '../lib/submitOnEnter';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useNeuro } from '../context/NeuroContext';
import { 
  Bot, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  Database, 
  X 
} from 'lucide-react';

export function LaunchAgentModal() {
  const { activeLaunchAgent, setActiveLaunchAgent, launchAgentPrompt } = useNeuro();
  const [promptText, setPromptText] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPromptText('');
    setResult(null);
    setError(null);
  }, [activeLaunchAgent?.id]);

  useEscapeKey(Boolean(activeLaunchAgent), () => setActiveLaunchAgent(null));
  if (!activeLaunchAgent) return null;

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim() || isExecuting) return;
    setIsExecuting(true);
    setResult(null);
    setError(null);

    try {
      const res = await launchAgentPrompt(activeLaunchAgent.id, promptText);
      setResult(res);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The model request failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26251e]/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#e7e2d9] bg-[#fffdfa] p-6 space-y-4 shadow-2xl text-[#282820]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e7e2d9]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#f2eee6] text-[#282820]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#282820] tracking-tight">
                {activeLaunchAgent.name}
              </h3>
              <p className="text-xs text-[#665f54] font-mono mt-0.5">
                Model: <span className="text-[#2f5d8a]">{activeLaunchAgent.model}</span> · Category: {activeLaunchAgent.category}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveLaunchAgent(null)}
            disabled={isExecuting}
            aria-label="Close prompt"
            className="text-[#665f54] hover:text-[#282820] p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prompt Input Form */}
        <form onSubmit={handleRun} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs text-[#665f54] font-medium">Input Prompt / Instructions:</label>
            <textarea
              rows={4}
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              onKeyDown={submitOnEnter}
              aria-label="Prompt"
              placeholder="Enter prompt to test this connected model..."
              className="w-full p-3 text-xs rounded-2xl border border-[#d8d3ca] bg-[#faf8f4] text-[#282820] placeholder:text-[#777064] focus:outline-none focus:border-[#08666c] leading-relaxed font-sans"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#665f54]">
              <Database className="w-3.5 h-3.5 text-[#777064]" />
              <span>Tokens processed: {activeLaunchAgent.tokens}</span>
            </div>

            <button
              type="submit"
              disabled={isExecuting || !promptText.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#262922] hover:bg-[#3b4236] disabled:opacity-50 rounded-full transition-colors flex items-center gap-2 shadow-sm"
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

        {error && <p role="alert" className="text-xs text-[#922d1d]">{error}</p>}

        {/* Execution Output */}
        {result && (
          <div className="rounded-2xl border border-[#e7e2d9] bg-[#faf8f4] p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#1f6b5f]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Saved to Recent Activity</span>
            </div>
            <div className="max-h-[50vh] overflow-y-auto pr-1">
              <AssistantMessage name={activeLaunchAgent.name} text={result} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
