import test from 'node:test';
import assert from 'node:assert/strict';
import { findBestIdleAgent, calculateFleetUtilization, AssignableAgent } from './jobAssignment';

test('findBestIdleAgent selects idle agent with matching category', () => {
  const agents: AssignableAgent[] = [
    { id: '1', name: 'Active Coder', status: 'Active', category: 'Engineering', model: 'R1', isRunning: true },
    { id: '2', name: 'Idle Searcher', status: 'Idle', category: 'Search', model: 'Qwen', isRunning: false },
    { id: '3', name: 'Idle Engineer', status: 'Idle', category: 'Engineering', model: 'DeepSeek', isRunning: false },
  ];

  const matched = findBestIdleAgent({ category: 'Engineering' }, agents);
  assert.ok(matched);
  assert.strictEqual(matched?.id, '3', 'Should prioritize idle agent in the matching category');
});

test('findBestIdleAgent falls back to any idle agent if category differs', () => {
  const agents: AssignableAgent[] = [
    { id: '1', name: 'Active Coder', status: 'Active', category: 'Engineering', model: 'R1', isRunning: true },
    { id: '2', name: 'Idle Searcher', status: 'Idle', category: 'Search', model: 'Qwen', isRunning: false },
  ];

  const matched = findBestIdleAgent({ category: 'Design' }, agents);
  assert.ok(matched);
  assert.strictEqual(matched?.id, '2');
});

test('findBestIdleAgent returns null when all agents are active', () => {
  const agents: AssignableAgent[] = [
    { id: '1', name: 'Active Coder', status: 'Active', category: 'Engineering', model: 'R1', isRunning: true },
  ];

  const matched = findBestIdleAgent({ category: 'Engineering' }, agents);
  assert.strictEqual(matched, null);
});

test('calculateFleetUtilization computes accurate rate', () => {
  const agents: AssignableAgent[] = [
    { id: '1', name: 'A', status: 'Active', category: 'E', model: 'M', isRunning: true },
    { id: '2', name: 'B', status: 'Active', category: 'E', model: 'M', isRunning: true },
    { id: '3', name: 'C', status: 'Idle', category: 'E', model: 'M', isRunning: false },
    { id: '4', name: 'D', status: 'Idle', category: 'E', model: 'M', isRunning: false },
  ];

  const stats = calculateFleetUtilization(agents);
  assert.strictEqual(stats.activeCount, 2);
  assert.strictEqual(stats.idleCount, 2);
  assert.strictEqual(stats.total, 4);
  assert.strictEqual(stats.utilizationRate, 50);
});
