import test from 'node:test';
import assert from 'node:assert/strict';
import { createCodexCollector, parseCodexJsonl } from './codexCli.ts';

test('parseCodexJsonl reads the final message and token usage', () => {
  const out = [
    '{"type":"thread.started","thread_id":"t"}',
    '{"type":"item.completed","item":{"type":"reasoning","text":"thinking"}}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"first"}}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"final answer"}}',
    '{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":50,"output_tokens":7,"reasoning_output_tokens":3}}',
    'not json',
  ].join('\n');
  const parsed = parseCodexJsonl(out);
  assert.equal(parsed.text, 'final answer');
  assert.equal(parsed.tokens, 110);
  assert.equal(parsed.error, '');
  assert.deepEqual(parsed.steps, [{ kind: 'thinking', text: 'thinking' }, { kind: 'message', text: 'first' }]);
  assert.equal(parseCodexJsonl('{"type":"turn.failed","error":{"message":"boom"}}').error, 'boom');
});

test('collects searches and commands live, and keeps the answer out of the steps', () => {
  const collector = createCodexCollector();
  const seen: number[] = [];
  const feed = (event: object) => { if (collector.push(`${JSON.stringify(event)}\n`)) seen.push(collector.steps().length); };
  feed({ type: 'item.started', item: { id: 's1', type: 'web_search', query: '', action: { type: 'other' } } });
  feed({ type: 'item.completed', item: { id: 's1', type: 'web_search', query: 'node lts version' } });
  feed({ type: 'item.started', item: { id: 'c1', type: 'command_execution', command: String.raw`/bin/bash -lc 'echo it'\''s'`, aggregated_output: '', exit_code: null, status: 'in_progress' } });
  assert.deepEqual(collector.steps().at(-1), { kind: 'command', command: "echo it's", output: '', exitCode: null, status: 'running' });
  feed({ type: 'item.completed', item: { id: 'c1', type: 'command_execution', command: String.raw`/bin/bash -lc 'echo it'\''s'`, aggregated_output: "it's\n", exit_code: 0, status: 'completed' } });
  feed({ type: 'item.completed', item: { id: 'm1', type: 'agent_message', text: 'Done: **it works**' } });

  const result = collector.finish();
  assert.equal(result.text, 'Done: **it works**');
  assert.deepEqual(result.steps, [
    { kind: 'search', query: 'node lts version' },
    { kind: 'command', command: "echo it's", output: "it's", exitCode: 0, status: 'done' },
  ]);
  assert.ok(seen.length >= 3, 'reports progress as events arrive');
});

test('handles JSON lines split across output chunks', () => {
  const collector = createCodexCollector();
  const line = JSON.stringify({ type: 'item.completed', item: { id: 'm', type: 'agent_message', text: 'hello' } });
  collector.push(line.slice(0, 20));
  collector.push(`${line.slice(20)}\n`);
  assert.equal(collector.finish().text, 'hello');
});
