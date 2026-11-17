import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { AgentDeployment, TelemetryTrace, AITool, OrchestrationPipeline } from '../types';
import { INITIAL_AGENTS, INITIAL_TRACES, INITIAL_TOOLS, INITIAL_PIPELINES } from '../data/seedData';
import { encryptTelemetryPayload, generateKeyFingerprint } from '../lib/encryption';
import { calculatePercentiles, estimateTokenCost } from '../lib/metrics';

interface AgentContextType {
  agents: AgentDeployment[];
  traces: TelemetryTrace[];
  tools: AITool[];
  pipelines: OrchestrationPipeline[];
  activeTab: 'fleet' | 'telemetry' | 'debugger' | 'orchestration' | 'tools' | 'analytics';
  setActiveTab: (tab: 'fleet' | 'telemetry' | 'debugger' | 'orchestration' | 'tools' | 'analytics') => void;
  selectedTraceId: string | null;
  setSelectedTraceId: (id: string | null) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  isConnectModalOpen: boolean;
  setIsConnectModalOpen: (open: boolean) => void;
  isSecurityVaultOpen: boolean;
  setIsSecurityVaultOpen: (open: boolean) => void;
  isLiveStreaming: boolean;
  setIsLiveStreaming: (streaming: boolean) => void;
  addAgent: (agent: Omit<AgentDeployment, 'id' | 'createdAt' | 'lastPingAt'>) => void;
  toggleAgentE2EE: (agentId: string) => void;
  pingAgent: (agentId: string) => void;
  addTraceComment: (traceId: string, author: string, authorRole: string, text: string) => void;
  dispatchAgentPrompt: (agentId: string, prompt: string) => Promise<TelemetryTrace>;
  runPipelineExecution: (pipelineId: string, samplePrompt: string, onStep?: (nodeId: string, log: string) => void) => Promise<{ success: boolean; latencyMs: number; output: string; traceId: string }>;
  invokeToolSandbox: (toolId: string, inputParams: Record<string, unknown>) => Promise<{ success: boolean; latencyMs: number; output: Record<string, unknown> }>;
}

const AgentContext = createContext<AgentContextType | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<AgentDeployment[]>(() => {
    const saved = localStorage.getItem('creativeprocess_agents');
    return saved ? JSON.parse(saved) : INITIAL_AGENTS;
  });

  const [traces, setTraces] = useState<TelemetryTrace[]>(() => {
    const saved = localStorage.getItem('creativeprocess_traces');
    return saved ? JSON.parse(saved) : INITIAL_TRACES;
  });

  const [tools, setTools] = useState<AITool[]>(() => {
    const saved = localStorage.getItem('creativeprocess_tools');
    return saved ? JSON.parse(saved) : INITIAL_TOOLS;
  });

  const [pipelines, setPipelines] = useState<OrchestrationPipeline[]>(() => {
    const saved = localStorage.getItem('creativeprocess_pipelines');
    return saved ? JSON.parse(saved) : INITIAL_PIPELINES;
  });

  const [activeTab, setActiveTab] = useState<'fleet' | 'telemetry' | 'debugger' | 'orchestration' | 'tools' | 'analytics'>('fleet');
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isSecurityVaultOpen, setIsSecurityVaultOpen] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('creativeprocess_agents', JSON.stringify(agents));
    } catch {
      // quota or local storage restriction
    }
  }, [agents]);

  useEffect(() => {
    try {
      localStorage.setItem('creativeprocess_traces', JSON.stringify(traces));
    } catch {
      // quota
    }
  }, [traces]);

  // Periodic subtle background heartbeats when live streaming is active
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      setAgents(prev =>
        prev.map(agent => {
          if (agent.status === 'offline') return agent;
          const jitter = (Math.random() - 0.5) * 8;
          const newLatency = Math.max(40, Math.round(agent.health.latencyMs + jitter));
          return {
            ...agent,
            lastPingAt: 'Just now',
            health: {
              ...agent.health,
              latencyMs: newLatency
            }
          };
        })
      );
    }, 6000);
    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  const addAgent = (newAgentData: Omit<AgentDeployment, 'id' | 'createdAt' | 'lastPingAt'>) => {
    const id = `agent_${Date.now()}`;
    const newAgent: AgentDeployment = {
      ...newAgentData,
      id,
      createdAt: new Date().toISOString(),
      lastPingAt: 'Just now'
    };
    setAgents(prev => [newAgent, ...prev]);
  };

  const toggleAgentE2EE = (agentId: string) => {
    setAgents(prev =>
      prev.map(a => {
        if (a.id === agentId) {
          const enabled = !a.e2eeEnabled;
          return {
            ...a,
            e2eeEnabled: enabled,
            e2eeKeyFingerprint: enabled ? generateKeyFingerprint('cp_e2ee') : 'cp_e2ee_unverified'
          };
        }
        return a;
      })
    );
  };

  const pingAgent = (agentId: string) => {
    setAgents(prev =>
      prev.map(a => {
        if (a.id === agentId) {
          return {
            ...a,
            lastPingAt: 'Just now',
            status: a.status === 'offline' ? 'nominal' : a.status
          };
        }
        return a;
      })
    );
  };

  const addTraceComment = (traceId: string, author: string, authorRole: string, text: string) => {
    setTraces(prev =>
      prev.map(t => {
        if (t.id === traceId) {
          const newComment = {
            id: `c_${Date.now()}`,
            author,
            authorRole,
            timestamp: 'Just now',
            text,
            pinned: true
          };
          return {
            ...t,
            comments: [newComment, ...t.comments]
          };
        }
        return t;
      })
    );
  };

  const dispatchAgentPrompt = async (agentId: string, prompt: string): Promise<TelemetryTrace> => {
    const targetAgent = agents.find(a => a.id === agentId) || agents[0];
    const startTime = Date.now();

    // Model latency simulation based on agent runtime
    const baseLatency = targetAgent.health.latencyMs || 280;
    const simulatedDuration = Math.round(baseLatency * (0.85 + Math.random() * 0.3));

    await new Promise(resolve => setTimeout(resolve, Math.min(600, simulatedDuration)));

    const promptTokens = Math.max(120, Math.round(prompt.length / 3.8));
    const completionTokens = Math.round(180 + Math.random() * 320);
    const cost = estimateTokenCost(targetAgent.model, promptTokens, completionTokens, 50);

    const generatedResponse = `Analysis and execution report for: "${prompt.slice(0, 80)}..."\n\n1. Target Runtime: ${targetAgent.runtime} (${targetAgent.model})\n2. Memory & VRAM Footprint: Nominal execution completed within ${simulatedDuration}ms SLA.\n3. Invariant Verification: All schema invariants satisfied. Zero data leakage detected.`;

    const encrypted = targetAgent.e2eeEnabled
      ? encryptTelemetryPayload(prompt, generatedResponse, targetAgent.e2eeKeyFingerprint)
      : {
          encrypted: false as const,
          plaintextPrompt: prompt,
          plaintextResponse: generatedResponse
        };

    const newTrace: TelemetryTrace = {
      id: `tr_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`,
      agentId: targetAgent.id,
      agentName: targetAgent.name,
      runtime: targetAgent.runtime,
      model: targetAgent.model,
      sessionId: `sess_live_${Date.now().toString().slice(-5)}`,
      startedAt: new Date().toISOString(),
      totalDurationMs: simulatedDuration,
      status: targetAgent.status === 'degraded' && Math.random() > 0.7 ? 'error' : 'success',
      errorType: targetAgent.status === 'degraded' ? 'TIMEOUT_504' : undefined,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
        cached: 50,
        estimatedCostUsd: cost
      },
      spans: [
        {
          id: `sp_l1_${Date.now()}`,
          name: 'Telemetry Ingestion & Auth Handshake',
          type: 'agent_step',
          durationMs: Math.round(simulatedDuration * 0.15),
          status: 'ok',
          inputSummary: `Ingest prompt via ${targetAgent.runtime} transport`,
          outputSummary: 'Tokenized context into agent memory'
        },
        {
          id: `sp_l2_${Date.now()}`,
          name: targetAgent.assignedTools[0] || 'tool_vector_retriever',
          type: 'tool_call',
          durationMs: Math.round(simulatedDuration * 0.35),
          status: 'ok',
          inputSummary: `Semantic lookup for prompt context`,
          outputSummary: 'Retrieved 4 relevant knowledge chunks',
          toolName: targetAgent.assignedTools[0] || 'tool_vector_retriever',
          toolInput: { query: prompt.slice(0, 40) },
          toolOutput: { status: 200, hits: 4 }
        },
        {
          id: `sp_l3_${Date.now()}`,
          name: `${targetAgent.model} Inference`,
          type: 'llm_call',
          durationMs: Math.round(simulatedDuration * 0.5),
          status: 'ok',
          inputSummary: `Stream inference with temperature=0.3`,
          outputSummary: `Generated ${completionTokens} completion tokens`
        }
      ],
      e2eePayload: encrypted,
      comments: [],
      tags: ['interactive-dispatch', targetAgent.runtime, 'live-test']
    };

    setTraces(prev => [newTrace, ...prev]);
    return newTrace;
  };

  const runPipelineExecution = async (
    pipelineId: string,
    samplePrompt: string,
    onStep?: (nodeId: string, log: string) => void
  ) => {
    const pipeline = pipelines.find(p => p.id === pipelineId) || pipelines[0];
    let totalLatency = 0;

    for (const node of pipeline.nodes) {
      if (onStep) {
        onStep(node.id, `Executing step: ${node.label}...`);
      }
      const stepDuration = Math.round(60 + Math.random() * 80);
      totalLatency += stepDuration;
      await new Promise(r => setTimeout(r, 120));
    }

    const output = `Pipeline "${pipeline.name}" completed successfully. All 6 nodes executed with 0 guardrail violations.`;

    // Record trace
    const newTrace = await dispatchAgentPrompt(agents[0].id, `[Pipeline: ${pipeline.name}] ${samplePrompt}`);

    // Update pipeline stats
    setPipelines(prev =>
      prev.map(p => {
        if (p.id === pipelineId) {
          return {
            ...p,
            executionStats: {
              ...p.executionStats,
              totalRuns: p.executionStats.totalRuns + 1
            }
          };
        }
        return p;
      })
    );

    return {
      success: true,
      latencyMs: totalLatency,
      output,
      traceId: newTrace.id
    };
  };

  const invokeToolSandbox = async (toolId: string, inputParams: Record<string, unknown>) => {
    const tool = tools.find(t => t.id === toolId);
    const latency = tool ? Math.round(tool.avgLatencyMs * (0.9 + Math.random() * 0.2)) : 100;
    await new Promise(r => setTimeout(r, 200));

    // Update tool invocations
    setTools(prev =>
      prev.map(t => {
        if (t.id === toolId) {
          return {
            ...t,
            totalInvocations: t.totalInvocations + 1
          };
        }
        return t;
      })
    );

    return {
      success: true,
      latencyMs: latency,
      output: {
        status: 'SUCCESS',
        executedAt: new Date().toISOString(),
        inputEcho: inputParams,
        resultPayload: {
          itemsCount: 5,
          memoryUsageKb: 420,
          verifiedSafe: true
        }
      }
    };
  };

  return (
    <AgentContext.Provider
      value={{
        agents,
        traces,
        tools,
        pipelines,
        activeTab,
        setActiveTab,
        selectedTraceId,
        setSelectedTraceId,
        selectedAgentId,
        setSelectedAgentId,
        isConnectModalOpen,
        setIsConnectModalOpen,
        isSecurityVaultOpen,
        setIsSecurityVaultOpen,
        isLiveStreaming,
        setIsLiveStreaming,
        addAgent,
        toggleAgentE2EE,
        pingAgent,
        addTraceComment,
        dispatchAgentPrompt,
        runPipelineExecution,
        invokeToolSandbox
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentFleet() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgentFleet must be used within an AgentProvider');
  }
  return context;
}
