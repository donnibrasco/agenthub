import test from 'node:test';
import assert from 'node:assert/strict';
import { NeuroDatabase } from './db.ts';

test('checkHealth reports connected SQLite database and accurate seeded agent counts', () => {
  const neuroDb = new NeuroDatabase(':memory:');
  try {
    const health = neuroDb.checkHealth();
    assert.equal(health.ok, true);
    assert.equal(health.status, 'healthy');
    assert.equal(health.database, 'connected');
    assert.equal(health.storage, 'sqlite');
    assert.equal(health.agentCount, 7);
    assert.equal(health.activeAgentCount, 4);
  } finally {
    neuroDb.db.close();
  }
});

test('checkHealth reflects agent count changes immediately after insert/delete', () => {
  const neuroDb = new NeuroDatabase(':memory:');
  try {
    neuroDb.db
      .prepare(`
        INSERT INTO connected_models (
          id, name, description, model, endpoint_url, runtime, provider, category,
          status, tokens, score, user_vote, latency_ms, e2ee_fingerprint, auth_token_encrypted,
          author, subreddit, domain, comments_count, created_at, date_label, last_ping_at
        ) VALUES ('m_test', 'Health Probe Node', 'Test node', 'llama3', 'http://localhost:11434', 'Local Workstation', 'Ollama', 'Engineering',
          'Active', 0, 1, 'up', 12, 'e2ee:1234', '', 'u/test', 'r/engineering', 'localhost:11434', 0, '2026-01-01T00:00:00.000Z', 'Jan 1, 2026', 'Just now')
      `)
      .run();

    const afterInsert = neuroDb.checkHealth();
    assert.equal(afterInsert.agentCount, 8);
    assert.equal(afterInsert.activeAgentCount, 5);

    neuroDb.db.prepare('DELETE FROM connected_models WHERE id = ?').run('m_test');
    const afterDelete = neuroDb.checkHealth();
    assert.equal(afterDelete.agentCount, 7);
    assert.equal(afterDelete.activeAgentCount, 4);
  } finally {
    neuroDb.db.close();
  }
});

test('checkHealth reports disconnected degraded status when SQLite connection is closed', () => {
  const neuroDb = new NeuroDatabase(':memory:');
  neuroDb.db.close();

  const health = neuroDb.checkHealth();
  assert.equal(health.ok, false);
  assert.equal(health.status, 'degraded');
  assert.equal(health.database, 'disconnected');
  assert.equal(health.agentCount, 0);
  assert.ok(typeof health.error === 'string' && health.error.length > 0);
});
