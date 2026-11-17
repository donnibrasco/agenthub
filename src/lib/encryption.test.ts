import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateKeyFingerprint,
  encryptTelemetryPayload,
  decryptTelemetryPayload,
  stringToHex,
  hexToString
} from './encryption';

test('stringToHex and hexToString are reversible', () => {
  const original = 'CreativeProcess.io Agent Orchestration 2026';
  const hex = stringToHex(original);
  assert.equal(typeof hex, 'string');
  assert.equal(hexToString(hex), original);
});

test('generateKeyFingerprint creates formatted key prefix', () => {
  const fp = generateKeyFingerprint('agent_sec');
  assert.ok(fp.startsWith('agent_sec_'));
  assert.equal(fp.length, 'agent_sec_'.length + 16);
});

test('encryptTelemetryPayload and decryptTelemetryPayload succeed with matching key', () => {
  const key = 'cp_key_test_abcdef123456';
  const prompt = 'Find quarterly churn rate for self-hosted cluster';
  const response = 'The Q3 churn rate is 1.4% with 99.8% SLA.';

  const encrypted = encryptTelemetryPayload(prompt, response, key);
  assert.equal(encrypted.encrypted, true);
  assert.ok(encrypted.ciphertextHex.length > 0);
  assert.ok(encrypted.ivHex.length >= 12);
  assert.ok(encrypted.tagHex.length >= 16);

  const decrypted = decryptTelemetryPayload(encrypted, key);
  assert.equal(decrypted.success, true);
  assert.equal(decrypted.plaintextPrompt, prompt);
  assert.equal(decrypted.plaintextResponse, response);
});

test('decryptTelemetryPayload fails if key fingerprint is mismatched', () => {
  const key1 = 'cp_key_first_111111111111';
  const key2 = 'cp_key_second_222222222222';
  const prompt = 'Classify customer intent';
  const response = 'Intent: Billing inquiry';

  const encrypted = encryptTelemetryPayload(prompt, response, key1);
  const decrypted = decryptTelemetryPayload(encrypted, key2);

  assert.equal(decrypted.success, false);
  assert.ok(decrypted.error?.includes('AUTHENTICATION_TAG_MISMATCH'));
});
