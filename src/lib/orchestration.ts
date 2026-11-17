/**
 * Orchestration and dynamic fallback engine for multi-agent workflows.
 */

import { AgentDeployment, PipelineNode } from '../types';

export interface RouteDecision {
  selectedAgentId: string;
  isFallback: boolean;
  reason: string;
  expectedLatencyMs: number;
}

/**
 * Evaluates whether an agent is capable of servicing a request or needs fallback
 */
export function evaluateAgentRoute(
  primaryAgent: AgentDeployment | undefined,
  fallbackAgent: AgentDeployment | undefined,
  maxLatencyThresholdMs: number = 800
): RouteDecision {
  if (!primaryAgent) {
    if (fallbackAgent && fallbackAgent.status !== 'offline') {
      return {
        selectedAgentId: fallbackAgent.id,
        isFallback: true,
        reason: 'PRIMARY_NOT_CONFIGURED: Routed to designated secondary agent',
        expectedLatencyMs: fallbackAgent.health.latencyMs
      };
    }
    return {
      selectedAgentId: '',
      isFallback: false,
      reason: 'NO_ACTIVE_AGENT_AVAILABLE',
      expectedLatencyMs: 0
    };
  }

  // If primary is offline or has error rate > 15%
  if (primaryAgent.status === 'offline') {
    if (fallbackAgent && fallbackAgent.status !== 'offline') {
      return {
        selectedAgentId: fallbackAgent.id,
        isFallback: true,
        reason: `PRIMARY_OFFLINE: ${primaryAgent.name} is offline. Auto-rerouted to fallback ${fallbackAgent.name}`,
        expectedLatencyMs: fallbackAgent.health.latencyMs
      };
    }
  }

  if (primaryAgent.status === 'degraded' || primaryAgent.health.errorRatePercent > 15) {
    if (fallbackAgent && fallbackAgent.status === 'nominal') {
      return {
        selectedAgentId: fallbackAgent.id,
        isFallback: true,
        reason: `PRIMARY_DEGRADED: ${primaryAgent.name} error rate (${primaryAgent.health.errorRatePercent}%) exceeds tolerance. Failover triggered.`,
        expectedLatencyMs: fallbackAgent.health.latencyMs
      };
    }
  }

  // If primary latency exceeds SLA threshold
  if (primaryAgent.health.latencyMs > maxLatencyThresholdMs && fallbackAgent && fallbackAgent.status === 'nominal') {
    return {
      selectedAgentId: fallbackAgent.id,
      isFallback: true,
      reason: `SLA_BREACH: Primary latency (${primaryAgent.health.latencyMs}ms) > threshold (${maxLatencyThresholdMs}ms). Routed to cloud backup.`,
      expectedLatencyMs: fallbackAgent.health.latencyMs
    };
  }

  return {
    selectedAgentId: primaryAgent.id,
    isFallback: false,
    reason: `NOMINAL: Routed to primary ${primaryAgent.name} (${primaryAgent.runtime})`,
    expectedLatencyMs: primaryAgent.health.latencyMs
  };
}

/**
 * Formats SDK connection snippet for different targets
 */
export function generateSdkSnippet(
  language: 'python' | 'typescript' | 'curl' | 'docker',
  agent: { name: string; endpoint: string; token: string; e2ee: boolean; fingerprint: string }
): string {
  switch (language) {
    case 'python':
      return `from creativeprocess import AgentPulse, E2EEConfig

# Connect ${agent.name} to Unified Control Plane
pulse = AgentPulse(
    api_key="${agent.token}",
    endpoint="${agent.endpoint}",
    ${agent.e2ee ? `e2ee=E2EEConfig(enabled=True, key_fingerprint="${agent.fingerprint}"),` : 'e2ee=None,'}
    environment="production"
)

@pulse.instrument()
def run_agent_workflow(prompt: str):
    # Automated tracing, latency metrics, and tool telemetry
    result = agent.invoke({"query": prompt})
    return result
`;

    case 'typescript':
      return `import { CreativePulseClient } from '@creativeprocess/agent-client';

const pulse = new CreativePulseClient({
  endpoint: '${agent.endpoint}',
  agentToken: '${agent.token}',
  e2ee: ${agent.e2ee ? `{ enabled: true, fingerprint: '${agent.fingerprint}' }` : 'false'},
  telemetry: {
    logWaterfall: true,
    collectVramUsage: true
  }
});

export async function executePrompt(prompt: string) {
  const span = pulse.startSpan('agent_reasoning');
  try {
    const res = await myAgent.run(prompt);
    span.recordSuccess(res);
    return res;
  } catch (err) {
    span.recordError(err);
    throw err;
  }
}
`;

    case 'curl':
      return `curl -X POST "${agent.endpoint}/api/v1/telemetry/heartbeat" \\
  -H "Authorization: Bearer ${agent.token}" \\
  -H "Content-Type: application/json" \\
  -H "X-E2EE-Fingerprint: ${agent.fingerprint}" \\
  -d '{
    "agent": "${agent.name}",
    "status": "nominal",
    "metrics": { "active_tasks": 3, "vram_mb": 14200, "cpu_pct": 28.4 }
  }'
`;

    case 'docker':
      return `version: '3.8'
services:
  agent-worker:
    image: creativeprocess/agent-runtime:latest
    environment:
      - CP_AGENT_TOKEN=${agent.token}
      - CP_ENDPOINT=${agent.endpoint}
      - CP_E2EE_ENABLED=${agent.e2ee}
      - CP_KEY_FINGERPRINT=${agent.fingerprint}
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
`;
  }
}
