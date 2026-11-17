export type AgentType = 'Claude Code' | 'Cursor' | 'Ollama Local' | 'Codex' | 'Custom Agent';

export type SessionStatus = 'active' | 'idle' | 'completed' | 'drift_detected';

export interface ToolAction {
  id: string;
  name: string;
  input: string;
  output?: string;
  durationMs: number;
  status: 'ok' | 'error' | 'drift_warning';
}

export interface SessionEvent {
  id: string;
  timestamp: string;
  type: 'prompt' | 'agent_thought' | 'tool_call' | 'file_diff' | 'drift_alert' | 'correction';
  content: string;
  toolName?: string;
  fileName?: string;
  diff?: {
    added: string[];
    removed: string[];
  };
  severity?: 'info' | 'warning' | 'critical';
}

export interface DriftIncident {
  id: string;
  sessionId: string;
  agentName: string;
  title: string;
  category: 'lost_context' | 'architecture_drift' | 'repetitive_correction' | 'hallucinated_import' | 'anti_pattern' | 'tool_discipline';
  description: string;
  detectedSnippet: string;
  developerCorrection: string;
  suggestedRuleId: string;
  timestamp: string;
  status: 'pending' | 'resolved' | 'rule_created';
}

export interface ProposedRule {
  id: string;
  title: string;
  category: 'architecture' | 'code_style' | 'tool_discipline' | 'safety';
  targetFile: '.cursorrules' | 'CLAUDE.md' | 'AGENT_RULES.md' | 'SKILL.md';
  ruleSnippet: string;
  reason: string;
  frequency: number;
  status: 'suggested' | 'applied' | 'dismissed';
  diffPreview: {
    target: string;
    before: string;
    after: string;
  };
}

export interface AgentSession {
  id: string;
  agentName: string;
  agentType: AgentType;
  repository: string;
  status: SessionStatus;
  startedAt: string;
  totalDurationMs: number;
  tokens: {
    prompt: number;
    completion: number;
  };
  events: SessionEvent[];
  filesModified: string[];
  driftsCount: number;
}

// Legacy types for compatibility
export type DeploymentRuntime = 'local' | 'cloud' | 'self-hosted' | 'kubernetes' | 'edge';
export type AgentStatus = 'nominal' | 'degraded' | 'syncing' | 'offline';

export interface AgentDeployment {
  id: string;
  name: string;
  runtime: DeploymentRuntime;
  hostEndpoint: string;
  model: string;
  status: AgentStatus;
  statusMessage?: string;
  version: string;
  e2eeEnabled: boolean;
  e2eeKeyFingerprint: string;
  authTokenPrefix: string;
  assignedTools: string[];
  tags: string[];
  createdAt: string;
  lastPingAt: string;
  health: {
    latencyMs: number;
    uptimePercent: number;
    errorRatePercent: number;
    activeTasks: number;
    totalRequests24h: number;
  };
  resourceUsage: {
    gpuVramMb: number;
    gpuVramTotalMb: number;
    cpuPercent: number;
    memoryMb: number;
    memoryTotalMb: number;
    podCount?: number;
  };
}

export type SpanType = 'agent_step' | 'llm_call' | 'tool_call' | 'router' | 'guardrail';

export interface TraceSpan {
  id: string;
  name: string;
  type: SpanType;
  durationMs: number;
  status: 'ok' | 'error';
  inputSummary: string;
  outputSummary: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
}

export interface TraceComment {
  id: string;
  author: string;
  authorRole: string;
  timestamp: string;
  text: string;
  pinned: boolean;
  resolved?: boolean;
}

export interface TelemetryTrace {
  id: string;
  agentId: string;
  agentName: string;
  runtime: DeploymentRuntime;
  model: string;
  sessionId: string;
  startedAt: string;
  totalDurationMs: number;
  status: 'success' | 'error' | 'throttled' | 'interrupted';
  errorType?: 'TIMEOUT_504' | 'RATE_LIMIT_429' | 'SCHEMA_VIOLATION' | 'OOM_ERROR' | 'SAFETY_BLOCK' | 'UNKNOWN';
  tokens: {
    prompt: number;
    completion: number;
    total: number;
    cached: number;
    estimatedCostUsd: number;
  };
  spans: TraceSpan[];
  e2eePayload: {
    encrypted: boolean;
    ciphertextHex?: string;
    ivHex?: string;
    tagHex?: string;
    keyFingerprint?: string;
    plaintextPrompt?: string;
    plaintextResponse?: string;
  };
  comments: TraceComment[];
  tags: string[];
}

export interface AITool {
  id: string;
  name: string;
  description: string;
  category: 'data' | 'system' | 'ai_eval' | 'search' | 'communication';
  totalInvocations: number;
  avgLatencyMs: number;
  failureRatePercent: number;
  enabledAgentsCount: number;
  rateLimitRpm: number;
  schema: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface PipelineNode {
  id: string;
  label: string;
  type: 'entry' | 'classifier' | 'agent' | 'tool' | 'evaluator' | 'exit';
  targetAgentId?: string;
  fallbackAgentId?: string;
  latencyThresholdMs?: number;
  config: {
    description: string;
    provider?: string;
  };
}

export interface PipelineEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  condition?: 'default' | 'fallback_on_error' | 'high_latency' | 'pass';
}

export interface OrchestrationPipeline {
  id: string;
  name: string;
  description: string;
  strategy: 'fallback_route' | 'semantic_router' | 'consensus_eval' | 'dag_workflow';
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  executionStats: {
    totalRuns: number;
    fallbackTriggerRate: number;
    avgLatencyMs: number;
    successRate: number;
  };
}
