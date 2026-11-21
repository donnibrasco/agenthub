import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NeuroDatabase } from './db.ts';
import { workspaceActions } from './workspaceActions.ts';

test('startup drops legacy sample rows and keeps user-created workspace data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'neuronest-migration-'));
  const dbPath = join(dir, 'workspace.sqlite');
  try {
    const old = new NeuroDatabase(dbPath);
    let modelId: string;
    let jobId: string;
    try {
      const actions = workspaceActions(old, old.getWorkspaceSecret());
      const { model } = actions.createModel({
        name: 'Workspace model', modelId: 'team-model', endpointUrl: 'https://models.example/v1',
        provider: 'OpenAI-Compatible', runtime: 'Cloud API', category: 'Engineering', authToken: 'saved-test-key',
      });
      assert.ok(model);
      modelId = model.id;
      ({ jobId } = actions.createJob({ title: 'Workspace job', assignedType: 'agent', assignedToId: 'agent_coder' }));
      old.db.exec(`
        DELETE FROM workspace_settings WHERE key = 'sample_data_removed_v1';
        INSERT INTO workspace_settings VALUES ('initial_seed_v1', 'true'), ('analyzed_messages_count', '394');
        INSERT INTO connected_models (id, name, description, model, endpoint_url, runtime, provider, category,
          e2ee_fingerprint, domain, created_at, date_label)
          VALUES ('agent_coder', 'Sample', '', 'demo-model', 'https://demo.example', 'Cloud API', 'OpenAI-Compatible',
            'Engineering', '', 'demo.example', '2025-05-25', 'May 25');
        INSERT INTO jobs (id, title, description, status, priority, assigned_type, category, created_at)
          VALUES ('job_1', 'Sample', '', 'queued', 'medium', 'unassigned', 'Engineering', '2025-05-25');
        INSERT INTO friction_signals VALUES
          ('sig_1', 'correction', 'agent_coder', 'Sample', 'demo/repo', 'Seeded', 'May 25', 'May 25', '2025-05-25'),
          ('sig_1767312000000', 'steering', 'agent_coder', 'Sample', 'creativeprocess/core-platform',
            'Pinned demo-model to verify E2EE payload schemas before endpoint commits.', 'Just now', 'Today', '2026-01-02'),
          ('sig_real', 'correction', 'external_agent', 'My agent', 'team/repo', 'Captured from an actual webhook', 'Just now', 'Today', '2026-01-01');
        INSERT INTO daily_signal_series VALUES ('Oct 13', 1.9, 1.4, 0.9, 68, 1);
      `);
      old.recordDailyTelemetry('2026-01-01T01:00:00.000Z', 'correction');
      old.recordDailyTelemetry('2026-01-01T02:00:00.000Z', 'heartbeat');
    } finally {
      old.db.close();
    }

    for (let restart = 0; restart < 2; restart++) {
      const workspace = new NeuroDatabase(dbPath);
      try {
        assert.deepEqual(workspace.listModels().map(model => model.id), [modelId]);
        assert.ok(workspace.getModelRow(modelId)?.auth_token_encrypted);
        assert.deepEqual(workspace.listJobs().map(job => [job.id, job.status, job.assignedType]), [
          [jobId, 'queued', 'unassigned'],
        ]);
        assert.equal(workspace.listActivities().length, 1);
        const improvements = workspace.getImprovementsBundle();
        assert.deepEqual(improvements.frictionSignals.map(signal => signal.id), ['sig_real']);
        assert.equal(improvements.totalAnalyzedMessages, 2);
        assert.deepEqual(improvements.dailySignalSeries, [{
          dateLabel: '2026-01-01', correctionsPct: 50, steeringPct: 0, frustrationPct: 0, messageCount: 2,
        }]);
      } finally {
        workspace.db.close();
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
