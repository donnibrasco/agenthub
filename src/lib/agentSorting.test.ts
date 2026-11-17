import test from 'node:test';
import assert from 'node:assert/strict';
import { sortAgentsByRedditRule, getAgentTimestamp, SortableAgent } from './agentSorting';

test('getAgentTimestamp parses ISO and human date strings', () => {
  const ts1 = getAgentTimestamp({ date: 'May 25, 2025' });
  assert.ok(ts1 > 0);

  const ts2 = getAgentTimestamp({ date: 'May 20, 2025', createdAt: '2025-05-25T12:00:00Z' });
  assert.strictEqual(new Date(ts2).toISOString(), '2025-05-25T12:00:00.000Z');
});

test('sortAgentsByRedditRule orders newest active agents on top and inactive at the bottom', () => {
  const sample: SortableAgent[] = [
    {
      id: '1',
      name: 'Older Active Agent',
      status: 'Active',
      date: 'May 20, 2025',
      tokens: 100
    },
    {
      id: '2',
      name: 'Newest Inactive Agent',
      status: 'Idle',
      date: 'May 26, 2025',
      tokens: 200
    },
    {
      id: '3',
      name: 'Newest Active Agent',
      status: 'Active',
      date: 'May 25, 2025',
      tokens: 300
    },
    {
      id: '4',
      name: 'Older Inactive Agent',
      status: 'Idle',
      date: 'May 18, 2025',
      tokens: 50
    }
  ];

  const sorted = sortAgentsByRedditRule(sample, 'active_first');

  // Must be: Newest Active (id: 3), Older Active (id: 1), Newest Inactive (id: 2), Older Inactive (id: 4)
  assert.strictEqual(sorted[0].id, '3', 'Newest active agent must be #1');
  assert.strictEqual(sorted[1].id, '1', 'Older active agent must be #2');
  assert.strictEqual(sorted[2].id, '2', 'Newest inactive agent must be #3');
  assert.strictEqual(sorted[3].id, '4', 'Older inactive agent must be #4');
});

test('sortAgentsByRedditRule handles newest overall when requested', () => {
  const sample: SortableAgent[] = [
    { id: '1', name: 'A', status: 'Active', date: 'May 20, 2025', tokens: 10 },
    { id: '2', name: 'B', status: 'Idle', date: 'May 26, 2025', tokens: 10 },
    { id: '3', name: 'C', status: 'Active', date: 'May 25, 2025', tokens: 10 }
  ];

  const sorted = sortAgentsByRedditRule(sample, 'newest');
  assert.strictEqual(sorted[0].id, '2', 'B is newest overall (May 26)');
  assert.strictEqual(sorted[1].id, '3', 'C is next newest (May 25)');
  assert.strictEqual(sorted[2].id, '1', 'A is oldest (May 20)');
});
