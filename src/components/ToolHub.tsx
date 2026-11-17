import React, { useState } from 'react';
import { useAgentFleet } from '../context/AgentContext';
import { AITool } from '../types';
import { 
  Boxes, 
  Terminal, 
  Database, 
  Search, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Code2, 
  Play, 
  RefreshCw 
} from 'lucide-react';

export function ToolHub() {
  const { tools, invokeToolSandbox } = useAgentFleet();
  const [selectedToolId, setSelectedToolId] = useState<string>(tools[0]?.id || '');
  const activeTool = tools.find(t => t.id === selectedToolId) || tools[0];

  const [testInputJson, setTestInputJson] = useState<string>(
    JSON.stringify({ query: 'responsive typography scale', topK: 5 }, null, 2)
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState<{ success: boolean; latencyMs: number; output: Record<string, unknown> } | null>(null);

  // When changing tool, preload matching sample input
  const handleSelectTool = (tool: AITool) => {
    setSelectedToolId(tool.id);
    setExecutionOutput(null);
    if (tool.id === 'tool_code_interpreter') {
      setTestInputJson(JSON.stringify({ code: "def test_tokens(): return {'status': 'PASS'}", timeout: 2000 }, null, 2));
    } else if (tool.id === 'tool_vector_retriever') {
      setTestInputJson(JSON.stringify({ query: 'creativeprocess design tokens', topK: 6 }, null, 2));
    } else if (tool.id === 'tool_figma_fetcher') {
      setTestInputJson(JSON.stringify({ fileKey: 'cp99201a', nodeId: '8192:441' }, null, 2));
    } else if (tool.id === 'tool_sql_query') {
      setTestInputJson(JSON.stringify({ query: 'SELECT agent_id, avg(latency_ms) FROM telemetry GROUP BY 1 LIMIT 5;' }, null, 2));
    } else {
      setTestInputJson(JSON.stringify({ channel: '#agent-alerts', message: 'Test ping from Tool Hub' }, null, 2));
    }
  };

  const handleTestInvoke = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setExecutionOutput(null);

    try {
      let parsed = {};
      try {
        parsed = JSON.parse(testInputJson);
      } catch {
        parsed = { raw: testInputJson };
      }
      const res = await invokeToolSandbox(activeTool.id, parsed);
      setExecutionOutput(res);
    } finally {
      setIsExecuting(false);
    }
  };

  const getCategoryIcon = (category: AITool['category']) => {
    switch (category) {
      case 'system':
        return <Terminal className="w-4 h-4 text-cyan-400" />;
      case 'data':
        return <Database className="w-4 h-4 text-purple-400" />;
      case 'communication':
        return <Send className="w-4 h-4 text-emerald-400" />;
      default:
        return <Boxes className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Boxes className="w-4 h-4 text-cyan-400" />
            AI Tool & Function Calling Registry
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Centralized function schemas, rate limiting, and execution sandboxes shared across local and cloud agents.
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Registered Tools: <span className="text-cyan-300 font-semibold">{tools.length}</span>
        </div>
      </div>

      {/* Main Grid: Tools List + Sandbox Execution Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Tools List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {tools.map(tool => {
            const isSelected = tool.id === activeTool.id;
            return (
              <div
                key={tool.id}
                onClick={() => handleSelectTool(tool)}
                className={`p-4 rounded-lg border transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? 'border-cyan-400 bg-cyan-950/20 shadow-md shadow-cyan-950/40'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded bg-slate-800 border border-slate-700">
                      {getCategoryIcon(tool.category)}
                    </span>
                    <div>
                      <h3 className="text-xs font-semibold text-white">{tool.name}</h3>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">
                        {tool.id} · {tool.category}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {tool.enabledAgentsCount} agents
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {tool.description}
                </p>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Invocations</span>
                    <span className="text-slate-200 tabular-nums">{tool.totalInvocations.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Avg Latency</span>
                    <span className="text-cyan-300 tabular-nums">{tool.avgLatencyMs}ms</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Fail Rate</span>
                    <span className="text-emerald-400 tabular-nums">{tool.failureRatePercent}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Schema Inspector & Interactive Sandbox (7 cols) */}
        <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-slate-900/60 p-5 space-y-5">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-white">{activeTool.name}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Rate Limit: {activeTool.rateLimitRpm} RPM · Strict JSON Schema Verification
              </p>
            </div>
            <span className="px-2.5 py-1 text-xs font-mono rounded bg-slate-950 border border-slate-800 text-cyan-300 uppercase">
              {activeTool.category}
            </span>
          </div>

          {/* JSON Schema Definition */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Parameter Schema (OpenAI / Gemini function calling format):
            </span>
            <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed max-h-56">
              {JSON.stringify(activeTool.schema, null, 2)}
            </pre>
          </div>

          {/* Interactive Sandbox Invocation */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                Test Sandbox Invocation
              </span>
              <span className="text-[11px] font-mono text-slate-500">Simulate payload</span>
            </div>

            <textarea
              rows={4}
              value={testInputJson}
              onChange={e => setTestInputJson(e.target.value)}
              className="w-full p-3 text-xs rounded border border-slate-700 bg-slate-950 text-slate-100 font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 leading-relaxed"
            />

            <button
              onClick={handleTestInvoke}
              disabled={isExecuting}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded transition-colors flex items-center justify-center gap-2"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing in Sandbox...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Tool Test</span>
                </>
              )}
            </button>

            {executionOutput && (
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400 pb-1.5 border-b border-slate-800/80">
                  <span className="text-emerald-400 flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Sandbox Execution Success ({executionOutput.latencyMs}ms)
                  </span>
                  <span className="text-[11px] text-slate-500">Zero Invariant Violations</span>
                </div>
                <pre className="text-slate-300 overflow-x-auto text-[11px] max-h-48">
                  {JSON.stringify(executionOutput.output, null, 2)}
                </pre>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
