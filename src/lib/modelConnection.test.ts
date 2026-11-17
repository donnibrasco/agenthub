import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateModelConnection,
  normalizeEndpointDomain,
  generateConnectionFingerprint,
} from './modelConnection';

test('normalizeEndpointDomain extracts clean host and port', () => {
  assert.strictEqual(normalizeEndpointDomain('http://localhost:11434/v1'), 'localhost:11434');
  assert.strictEqual(
    normalizeEndpointDomain('https://api.gemini.google.com/v1beta/models'),
    'api.gemini.google.com'
  );
});

test('validateModelConnection rejects missing name or invalid URL', () => {
  const bad = validateModelConnection({
    name: '',
    modelId: 'qwen2.5',
    endpointUrl: 'ftp://invalid-host',
    runtime: 'Local Workstation',
    provider: 'Ollama',
    category: 'Engineering',
  });

  assert.strictEqual(bad.valid, false);
  assert.ok(bad.errors.name);
  assert.ok(bad.errors.endpointUrl);
});

test('validateModelConnection accepts valid local and cloud endpoints', () => {
  const good = validateModelConnection({
    name: 'Local Qwen Code Reviewer',
    modelId: 'qwen2.5-coder:32b',
    endpointUrl: 'http://localhost:11434/v1',
    runtime: 'Local Workstation',
    provider: 'Ollama',
    category: 'Engineering',
  });

  assert.strictEqual(good.valid, true);
  assert.deepStrictEqual(good.errors, {});
  assert.strictEqual(good.domain, 'localhost:11434');
});

test('generateConnectionFingerprint formats deterministic e2ee fingerprint', () => {
  const fp1 = generateConnectionFingerprint('http://localhost:11434/v1|qwen2.5');
  const fp2 = generateConnectionFingerprint('http://localhost:11434/v1|qwen2.5');
  assert.strictEqual(fp1, fp2);
  assert.match(fp1, /^e2ee:[0-9a-f]{4}\.\.\.[0-9a-f]{4}$/);
});
