import test from 'node:test';
import assert from 'node:assert/strict';
import { createClaudeCollector } from './claudeCode.ts';

const events = [
  { type: 'system', subtype: 'init', tools: ['WebSearch', 'WebFetch', 'Read'] },
  { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'Need fresh prices.' }, { type: 'text', text: 'Let me look that up.' }, { type: 'tool_use', id: 't1', name: 'WebSearch', input: { query: 'qdrant pricing' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'results' }] } },
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't2', name: 'WebFetch', input: { url: 'https://qdrant.tech/pricing', prompt: 'price' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't2', content: 'blocked', is_error: true }] } },
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't3', name: 'Read', input: { file_path: '/tmp/agenthub-claude-x/attachments/shot.png' } }] } },
  { type: 'assistant', message: { content: [{ type: 'text', text: 'Qdrant starts at **$25/mo**.' }] } },
  { type: 'result', subtype: 'success', is_error: false, result: 'Qdrant starts at **$25/mo**.', usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50 } },
].map(e => JSON.stringify(e)).join('\n');


test('collector turns stream-json into steps and keeps the answer out', () => {
  const collector = createClaudeCollector();
  collector.push(`${events}\n`);
  const result = collector.finish();
  assert.equal(result.text, 'Qdrant starts at **$25/mo**.');
  assert.equal(result.tokens, 170);
  assert.deepEqual(result.steps, [
    { kind: 'thinking', text: 'Need fresh prices.' },
    { kind: 'message', text: 'Let me look that up.' },
    { kind: 'search', query: 'qdrant pricing' },
    { kind: 'fetch', url: 'https://qdrant.tech/pricing', failed: true },
    { kind: 'read', path: 'attachments/shot.png' },
  ]);
});

test('error results become readable errors', () => {
  const collector = createClaudeCollector();
  collector.push(`${JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'Invalid API key · Please run /login' })}\n`);
  assert.equal(collector.finish().text, '');
});
