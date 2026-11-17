import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAgentRoute, generateSdkSnippet } from './orchestration';
import { AgentDeployment } from '../types';

const mockPrimary: AgentDeployment = {
  id: 'agent_primary',
  name: 'Local Ollama Coder',
  runtime: 'local',
  hostEndpoint: 'http://localhost:11434',
  model: 'qwen2.5-coder:32b',
  status: 'nominal',
  version: '1.2.0',
  e2eeEnabled: true,
  e2eeKeyFingerprint: 'key_111',
  authTokenPrefix: 'cp_live_111',
  assignedTools: ['code_exec'],
  tags: ['local', 'coding'],
  createdAt: '2026-01-01',
  lastPingAt: 'Just now',
  health: {
    latencyMs: 350,
    uptimePercent: 99.8,
    errorRatePercent: 1.2,
    activeTasks: 2,
    totalRequests24h: 1200
  },
  resourceUsage: {
    gpuVramMb: 12000,
    gpuVramTotalMb: 16000,
    cpuPercent: 35,
    memoryMb: 8000,
    memoryTotalMb: 32000
  }
};

const mockFallback: AgentDeployment = {
  id: 'agent_fallback',
  name: 'Gemini Cloud Flash',
  runtime: 'cloud',
  hostEndpoint: 'https://api.creativeprocess.io',
  model: 'gemini-2.5-flash',
  status: 'nominal',
  version: '2.0.0',
  e2eeEnabled: true,
  e2eeKeyFingerprint: 'key_222',
  authTokenPrefix: 'cp_live_222',
  assignedTools: ['code_exec'],
  tags: ['cloud', 'fast'],
  createdAt: '2026-01-01',
  lastPingAt: 'Just now',
  health: {
    latencyMs: 180,
    uptimePercent: 99.99,
    errorRatePercent: 0.1,
    activeTasks: 1,
    totalRequests24h: 8900
  },
  resourceUsage: {
    gpuVramMb: 0,
    gpuVramTotalMb: 0,
    cpuPercent: 5,
    memoryMb: 1200,
    memoryTotalMb: 8000
  }
};

test('evaluateAgentRoute selects primary when nominal and below latency threshold', () => {
  const decision = evaluateAgentRoute(mockPrimary, mockFallback, 800);
  assert.equal(decision.selectedAgentId, 'agent_primary');
  assert.equal(decision.isFallback, false);
});

test('evaluateAgentRoute routes to fallback when primary is offline', () => {
  const offlinePrimary = { ...mockPrimary, status: 'offline' as const };
  const decision = evaluateAgentRoute(offlinePrimary, mockFallback, 800);
  assert.equal(decision.selectedAgentId, 'agent_fallback');
  assert.equal(decision.isFallback, true);
  assert.ok(decision.reason.includes('PRIMARY_OFFLINE'));
});

test('evaluateAgentRoute routes to fallback when primary latency exceeds threshold', () => {
  const slowPrimary = { ...mockPrimary, health: { ...mockPrimary.health, latencyMs: 1400 } };
  const decision = evaluateAgentRoute(slowPrimary, mockFallback, 800);
  assert.equal(decision.selectedAgentId, 'agent_fallback');
  assert.equal(decision.isFallback, true);
  assert.ok(decision.reason.includes('SLA_BREACH'));
});

test('generateSdkSnippet generates python, typescript, curl and docker snippets with token', () => {
  const snippetPy = generateSdkSnippet('python', {
    name: 'TestAgent',
    endpoint: 'http://localhost:8000',
    token: 'cp_test_token',
    e2ee: true,
    fingerprint: 'key_test_fp'
  });
  assert.ok(snippetPy.includes('AgentPulse'));
  assert.ok(snippetPy.includes('cp_test_token'));

  const snippetTs = generateSdkSnippet('typescript', {
    name: 'TestAgent',
    endpoint: 'http://localhost:8000',
    token: 'cp_test_token',
    e2ee: false,
    fingerprint: 'key_test_fp'
  });
  assert.ok(snippetTs.includes('CreativePulseClient'));
});
