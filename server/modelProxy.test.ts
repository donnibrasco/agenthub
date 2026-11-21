import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptSecretToken,
  decryptSecretToken,
  buildProbeRequest,
  buildChatCompletionRequest,
  extractModelReplyText,
  probeModelEndpoint,
  runPromptAgainstModel,
} from './modelProxy.ts';

test('encryptSecretToken and decryptSecretToken round-trip API keys cleanly', () => {
  const secret = 'hetzner-vps-master-secret';
  const encrypted = encryptSecretToken('sk-live-abc123xyz', secret);
  assert.notStrictEqual(encrypted, 'sk-live-abc123xyz');
  assert.strictEqual(encrypted.split(':').length, 3);
  assert.strictEqual(decryptSecretToken(encrypted, secret), 'sk-live-abc123xyz');
  assert.strictEqual(decryptSecretToken(encrypted, 'wrong-secret'), '');
});

test('buildProbeRequest targets provider-specific health paths', () => {
  const ollama = buildProbeRequest('http://127.0.0.1:11434', 'Ollama');
  assert.strictEqual(ollama.url, 'http://127.0.0.1:11434/api/tags');

  const ollamaV1 = buildProbeRequest('http://127.0.0.1:11434/v1', 'Ollama');
  assert.strictEqual(ollamaV1.url, 'http://127.0.0.1:11434/v1/models');

  const gemini = buildProbeRequest('https://generativelanguage.googleapis.com/v1beta', 'Gemini', 'gem_key');
  assert.strictEqual(gemini.url, 'https://generativelanguage.googleapis.com/v1beta/models?key=gem_key');
});

test('buildChatCompletionRequest formats OpenAI-compatible and Anthropic payloads', () => {
  const vllm = buildChatCompletionRequest(
    'http://10.0.0.4:8000/v1',
    'vLLM',
    'deepseek-r1-distill-32b',
    'Ping test',
    'tok_123'
  );
  assert.strictEqual(vllm.url, 'http://10.0.0.4:8000/v1/chat/completions');
  assert.strictEqual(vllm.headers.Authorization, 'Bearer tok_123');
  assert.strictEqual(vllm.body.model, 'deepseek-r1-distill-32b');

  const anthropic = buildChatCompletionRequest(
    'https://api.anthropic.com/v1',
    'Anthropic',
    'claude-3-7-sonnet',
    'Hello',
    'ant_456'
  );
  assert.strictEqual(anthropic.url, 'https://api.anthropic.com/v1/messages');
  assert.strictEqual(anthropic.headers['x-api-key'], 'ant_456');
});

test('extractModelReplyText extracts text and tokens from OpenAI and Gemini formats', () => {
  const openai = extractModelReplyText('vLLM', {
    choices: [{ message: { content: 'All checks passed.' } }],
    usage: { total_tokens: 94 },
  });
  assert.strictEqual(openai.text, 'All checks passed.');
  assert.strictEqual(openai.tokensUsed, 94);

  const gemini = extractModelReplyText('Gemini', {
    candidates: [{ content: { parts: [{ text: 'Gemini online.' }] } }],
    usageMetadata: { totalTokenCount: 51 },
  });
  assert.strictEqual(gemini.text, 'Gemini online.');
  assert.strictEqual(gemini.tokensUsed, 51);
});

test('probe discovers live Ollama model IDs and reports invalid credentials as a failure', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ models: [{ name: 'team-model:latest' }] }));
  const endpoint = 'http://localhost:11434';
  const discovered = await probeModelEndpoint(endpoint, 'Ollama');
  assert.deepEqual(discovered.modelIds, ['team-model:latest']);
  assert.equal(discovered.reachable, true);

  fetch.mock.mockImplementation(async () => new Response(null, { status: 401 }));
  const rejected = await probeModelEndpoint(endpoint, 'Ollama', 'bad-key');
  assert.equal(rejected.reachable, false);
  assert.equal(rejected.httpStatus, 401);
  assert.match(rejected.message, /API key/);
});

test('prompt runs report provider text and never invent missing token usage', async t => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ choices: [{ message: { content: 'Actual response' } }] }));
  const result = await runPromptAgainstModel({
    endpointUrl: 'https://model.example/v1', provider: 'OpenAI-Compatible', modelId: 'team-model', promptText: 'Check connection',
  });
  assert.equal(result.ok, true);
  assert.equal(result.output, 'Actual response');
  assert.equal(result.tokensUsed, 0);
});

test('agent gateway connections use the OpenAI-compatible API and do not follow sign-in redirects', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    new Response(null, { status: 302, headers: { Location: 'https://signin.example/' } }));
  const probe = await probeModelEndpoint('https://agent.example/p/sales/', 'Hermes', 'hermes-token');
  const [url, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, 'https://agent.example/p/sales/v1/models');
  assert.equal(init?.redirect, 'manual');
  assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer hermes-token');
  assert.equal(probe.reachable, false);
  assert.match(probe.message, /sign-in redirect/);

  const chat = buildChatCompletionRequest('https://agent.example/v1', 'OpenClaw', 'openclaw/default', 'Reply with OK.', 'claw-token');
  assert.equal(chat.url, 'https://agent.example/v1/chat/completions');
  assert.equal(chat.body.model, 'openclaw/default');
  assert.equal(chat.headers.Authorization, 'Bearer claw-token');
});
