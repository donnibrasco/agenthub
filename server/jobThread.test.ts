import test from 'node:test';
import assert from 'node:assert/strict';
import { NeuroDatabase } from './db.ts';
import { workspaceActions } from './workspaceActions.ts';

test('job runs preserve the timeline, store replies, and include prior messages in follow-ups', async t => {
  const db = new NeuroDatabase(':memory:');
  t.after(() => db.db.close());
  const workspace = workspaceActions(db, 'test-workspace');
  const { model } = workspace.createModel({
    name: 'Research agent', modelId: 'hermes-agent', provider: 'Hermes',
    endpointUrl: 'https://agent.example/v1', runtime: 'Self-Hosted Server', category: 'Search',
  });
  assert.ok(model);
  const { jobId } = workspace.createJob({
    title: 'Check the summary', description: 'Produce a summary.', assignedType: 'agent',
    assignedToId: model.id, assignedToName: model.name,
  });
  const prompts: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    prompts.push(JSON.parse(String(init.body)).messages[0].content);
    return Response.json({ choices: [{ message: { content: 'Summary is ready.' } }], usage: { total_tokens: 12 } });
  });

  const first = (await workspace.runJobMessage(jobId, undefined)).jobs.find(job => job.id === jobId);
  assert.equal(first?.status, 'completed');
  assert.equal(first.progressPercent, 100);
  assert.equal(first.logs.length, 2);
  assert.equal(first.logs[1].author, 'Research agent');
  assert.ok(Number.isFinite(Date.parse(first.createdAt)));
  assert.equal(prompts[0], 'Produce a summary.');
  await assert.rejects(workspace.runJobMessage(jobId, undefined), /already started/);

  const followUp = (await workspace.runJobMessage(jobId, 'Make it shorter.')).jobs.find(job => job.id === jobId);
  assert.match(prompts[1], /Original job: Produce a summary\.[\s\S]+Agent: Summary is ready\.[\s\S]+User follow-up: Make it shorter\./);
  assert.equal(followUp?.consumedTokens, 24);
  assert.deepEqual(followUp.logs.map(log => log.role), [undefined, 'agent', 'user', 'agent']);

  workspace.updateJob(jobId, { status: 'paused' });
  await assert.rejects(workspace.runJobMessage(jobId, 'Try again.'), /Resume the job/);
});
