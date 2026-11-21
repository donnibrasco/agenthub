import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import type { NeuroJob } from '../src/context/NeuroContext.tsx';
import {
  generateConnectionFingerprint,
  normalizeEndpointDomain,
  validateModelConnection,
  validateModelEndpoint,
  type ModelConnectionPayload,
} from '../src/lib/modelConnection.ts';
import { ADMIN_USERNAME } from './authStore.ts';
import type { NeuroDatabase } from './db.ts';
import type { AgentStep } from '../src/lib/agentSteps.ts';
import { linkAttachments, listJobAttachments, type AgentAttachment } from './attachments.ts';
import { decryptSecretToken, encryptSecretToken, probeModelEndpoint, runPromptAgainstModel } from './modelProxy.ts';

type ModelUpdateInput = Partial<ModelConnectionPayload> & {
  status?: 'Active' | 'Idle' | 'Syncing';
  score?: number;
  userVote?: 'up' | 'down' | null;
};
type JobInput = Partial<NeuroJob> & { logMessage?: string; logLevel?: string; attachmentIds?: unknown };

function endpointOrigin(endpoint: string) {
  try { return new URL(endpoint).origin; } catch { return endpoint; }
}

export class WorkspaceActionError extends Error {
  readonly status: number;
  readonly details?: Record<string, string>;

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function workspaceRoute(handler: (req: Request) => unknown, status = 200): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve().then(() => handler(req)).then(result => res.status(status).json(result)).catch(error => {
      if (error instanceof WorkspaceActionError) res.status(error.status).json({ error: error.message, errors: error.details });
      else next(error);
    });
  };
}

export function workspaceActions(db: NeuroDatabase, workspaceSecret: string) {
  const runningJobs = new Set<string>();
  const liveSteps = new Map<string, AgentStep[]>();
  function probeConnection(payload: { endpointUrl?: unknown; provider?: unknown; authToken?: unknown; savedModelId?: unknown }) {
    const endpoint = typeof payload.endpointUrl === 'string' ? payload.endpointUrl.trim() : '';
    const provider = String(payload.provider || 'OpenAI-Compatible');
    const endpointError = validateModelEndpoint(endpoint, provider);
    if (endpointError) throw new WorkspaceActionError(400, endpointError);

    const saved = typeof payload.savedModelId === 'string' ? db.getModelRow(payload.savedModelId) : null;
    let token = typeof payload.authToken === 'string' ? payload.authToken.trim() : '';
    if (!token && saved && saved.provider === provider && endpointOrigin(saved.endpoint_url) === endpointOrigin(endpoint)) {
      token = decryptSecretToken(saved.auth_token_encrypted, workspaceSecret);
    }
    return probeModelEndpoint(endpoint, provider, token || undefined);
  }

  function createModel(payload: ModelConnectionPayload) {
    const provider = payload.provider || 'Ollama';
    const runtime = payload.runtime || 'Local Workstation';
    const validation = validateModelConnection({
      name: String(payload.name || ''),
      modelId: String(payload.modelId || ''),
      endpointUrl: String(payload.endpointUrl || ''),
      runtime,
      provider,
      category: String(payload.category || 'Engineering'),
      description: payload.description,
      authToken: payload.authToken,
    });

    if (!validation.valid) {
      throw new WorkspaceActionError(400, 'Validation failed', validation.errors);
    }

    const now = new Date();
    const id = `model_${randomUUID()}`;
    const formattedDate =
      now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ', ' +
      now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const domain = normalizeEndpointDomain(payload.endpointUrl);
    const fingerprint = generateConnectionFingerprint(`${payload.endpointUrl}|${payload.modelId}`);
    const encryptedToken = payload.authToken
      ? encryptSecretToken(String(payload.authToken), workspaceSecret)
      : '';
    const description = typeof payload.description === 'string' ? payload.description.trim() : '';

    db.db
      .prepare(`
        INSERT INTO connected_models (
          id, name, description, model, endpoint_url, runtime, provider, category,
          status, tokens, score, user_vote, latency_ms, e2ee_fingerprint, auth_token_encrypted,
          author, subreddit, domain, comments_count, created_at, date_label, last_ping_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Idle', 0, 0, NULL, 0, ?, ?, ?, ?, ?, 0, ?, ?, 'Not checked')
      `)
      .run(
        id,
        String(payload.name).trim(),
        description,
        String(payload.modelId).trim(),
        String(payload.endpointUrl).trim(),
        runtime,
        provider,
        String(payload.category || 'Engineering'),
        fingerprint,
        encryptedToken,
        ADMIN_USERNAME,
        `r/${String(payload.category || 'engineering').toLowerCase()}`,
        domain,
        now.toISOString(),
        formattedDate
      );

    db.db
      .prepare(`
        INSERT INTO activities (id, date_label, title, snippet, model_tag, bg_color_class, text_color_class, tag_color_class, response, created_at)
        VALUES (?, 'Just now', ?, ?, ?, 'bg-[#e9f2eb]', 'text-[#282820]', 'bg-[#08666c] text-white', ?, ?)
      `)
      .run(
        `act_${randomUUID()}`,
        `Model Connected: ${String(payload.name).trim()}`,
        `Registered ${domain} (${String(payload.modelId).trim()}) on ${runtime}.`,
        provider,
        'Connection settings saved.',
        now.toISOString()
      );

    const created = db.getModelRow(id);
    return { model: created ? db.mapModelRow(created) : null };
  }

  function updateModel(id: string, body: ModelUpdateInput) {
    const existing = db.getModelRow(id);
    if (!existing) {
      throw new WorkspaceActionError(404, 'Model not found');
    }

    const nextName = typeof body.name === 'string' ? body.name.trim() : existing.name;
    const nextModel = typeof body.modelId === 'string' ? body.modelId.trim() : existing.model;
    const nextEndpoint = typeof body.endpointUrl === 'string' ? body.endpointUrl.trim() : existing.endpoint_url;
    const nextRuntime = typeof body.runtime === 'string' ? body.runtime : existing.runtime;
    const nextProvider = typeof body.provider === 'string' ? body.provider : existing.provider;
    const nextCategory = typeof body.category === 'string' ? body.category : existing.category;
    const nextDesc = typeof body.description === 'string'
      ? body.description.trim()
      : existing.description;
    const nextStatus =
      body.status === 'Active' || body.status === 'Idle' || body.status === 'Syncing'
        ? body.status
        : existing.status;
    const nextScore = typeof body.score === 'number' ? body.score : existing.score;
    const nextVote =
      body.userVote === 'up' || body.userVote === 'down' || body.userVote === null
        ? body.userVote
        : existing.user_vote;

    if (body.name !== undefined || body.modelId !== undefined || body.endpointUrl !== undefined) {
      const { valid, errors } = validateModelConnection({
        name: nextName, modelId: nextModel, endpointUrl: nextEndpoint,
        runtime: nextRuntime as ModelConnectionPayload['runtime'],
        provider: nextProvider as ModelConnectionPayload['provider'], category: nextCategory,
      });
      if (!valid) throw new WorkspaceActionError(400, 'Validation failed', errors);
    }

    const nextDomain = normalizeEndpointDomain(nextEndpoint);
    const nextFingerprint = generateConnectionFingerprint(`${nextEndpoint}|${nextModel}`);
    let nextEncryptedToken = existing.auth_token_encrypted;
    if (typeof body.authToken === 'string' && body.authToken.trim()) {
      nextEncryptedToken = encryptSecretToken(body.authToken, workspaceSecret);
    } else if (endpointOrigin(nextEndpoint) !== endpointOrigin(existing.endpoint_url) || nextProvider !== existing.provider) {
      // A saved credential belongs to its original provider and origin.
      nextEncryptedToken = '';
    }
    const connectionChanged = nextEndpoint !== existing.endpoint_url || nextModel !== existing.model ||
      nextProvider !== existing.provider || nextEncryptedToken !== existing.auth_token_encrypted;

    db.db
      .prepare(`
        UPDATE connected_models SET
          name = ?, description = ?, model = ?, endpoint_url = ?, runtime = ?,
          provider = ?, category = ?, status = ?, score = ?, user_vote = ?,
          domain = ?, e2ee_fingerprint = ?, auth_token_encrypted = ?, latency_ms = ?, last_ping_at = ?
        WHERE id = ?
      `)
      .run(
        nextName,
        nextDesc,
        nextModel,
        nextEndpoint,
        nextRuntime,
        nextProvider,
        nextCategory,
        connectionChanged ? 'Idle' : nextStatus,
        nextScore,
        nextVote,
        nextDomain,
        nextFingerprint,
        nextEncryptedToken,
        connectionChanged ? 0 : existing.latency_ms,
        connectionChanged ? 'Not checked' : existing.last_ping_at,
        existing.id
      );

    const updated = db.getModelRow(existing.id);
    return { model: updated ? db.mapModelRow(updated) : null };
  }

  function disconnectModel(id: string) {
    db.db.prepare('DELETE FROM connected_models WHERE id = ?').run(id);
    return { ok: true };
  }

  async function pingModel(id: string, signal?: AbortSignal) {
    const row = db.getModelRow(id);
    if (!row) {
      throw new WorkspaceActionError(404, 'Model not found');
    }

    const token = decryptSecretToken(row.auth_token_encrypted, workspaceSecret);
    const probe = await probeModelEndpoint(row.endpoint_url, row.provider, token || undefined, signal);
    signal?.throwIfAborted();

    db.db
      .prepare(`UPDATE connected_models SET latency_ms = ?, last_ping_at = ?
        WHERE id = ? AND endpoint_url = ? AND provider = ? AND auth_token_encrypted = ?`)
      .run(probe.reachable ? probe.latencyMs : 0, probe.reachable ? new Date().toISOString() : 'Check failed',
        row.id, row.endpoint_url, row.provider, row.auth_token_encrypted);

    const updated = db.getModelRow(row.id);
    return {
      probe,
      model: updated ? db.mapModelRow(updated) : null,
    };
  }

  async function runModel(id: string, promptText: string, signal?: AbortSignal, onSteps?: (steps: AgentStep[]) => void, attachments?: AgentAttachment[]) {
    const row = db.getModelRow(id);
    if (!row) {
      throw new WorkspaceActionError(404, 'Model not found');
    }

    if (!promptText) {
      throw new WorkspaceActionError(400, 'promptText is required');
    }

    const token = decryptSecretToken(row.auth_token_encrypted, workspaceSecret);
    const runResult = await runPromptAgainstModel({
      endpointUrl: row.endpoint_url,
      provider: row.provider,
      modelId: row.model,
      promptText,
      authToken: token || undefined,
      signal,
      onSteps,
      attachments,
    });
    signal?.throwIfAborted();

    if (runResult.ok) {
      db.db
        .prepare(`UPDATE connected_models SET tokens = tokens + ?, latency_ms = ?, status = ?, last_ping_at = ?
          WHERE id = ? AND endpoint_url = ? AND provider = ? AND model = ? AND auth_token_encrypted = ?`)
        .run(runResult.tokensUsed, runResult.latencyMs, 'Active', new Date().toISOString(),
          row.id, row.endpoint_url, row.provider, row.model, row.auth_token_encrypted);

      db.db
        .prepare(`
          INSERT INTO activities (id, date_label, title, snippet, model_tag, bg_color_class, text_color_class, tag_color_class, response, created_at)
          VALUES (?, 'Just now', ?, ?, ?, 'bg-[#e8eef6]', 'text-[#282820]', 'bg-[#2f5d8a] text-white', ?, ?)
        `)
        .run(
          `act_${randomUUID()}`,
          `${row.name.split(' ')[0]} Live Run`,
          promptText,
          row.provider || row.model,
          runResult.output,
          new Date().toISOString()
        );
    }

    const updated = db.getModelRow(row.id);
    return {
      ...runResult,
      model: updated ? db.mapModelRow(updated) : null,
    };
  }

  function createJob(b: JobInput) {
    const id = `job_${randomUUID()}`;
    const assignedType = b.assignedType || 'unassigned';
    const status = b.status || (assignedType === 'unassigned' ? 'queued' : 'in_progress');
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logs = [{ timestamp: nowTime, message: 'Job persisted to SQLite fleet queue.', level: 'info' }];

    db.db
      .prepare(`
        INSERT INTO jobs (
          id, title, description, status, priority, assigned_type, assigned_to_id,
          assigned_to_name, assigned_to_role, category, estimated_tokens, consumed_tokens,
          progress_percent, created_at, deadline, payload_spec, output_summary, logs_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, null, ?)
      `)
      .run(
        id,
        String(b.title || 'Untitled Fleet Task'),
        String(b.description || ''),
        status,
        String(b.priority || 'medium'),
        assignedType,
        b.assignedToId || null,
        b.assignedToName || null,
        b.assignedToRole || null,
        String(b.category || 'Engineering'),
        Number(b.estimatedTokens || 350),
        new Date().toISOString(),
        b.deadline || null,
        b.payloadSpec || null,
        JSON.stringify(logs)
      );

    linkAttachments(db, id, b.attachmentIds);
    if (assignedType === 'agent' && b.assignedToId) {
      db.db.prepare('UPDATE connected_models SET status = ? WHERE id = ?').run('Active', String(b.assignedToId));
    }

    return { jobId: id, jobs: db.listJobs(), models: db.listModels() };
  }

  function updateJob(id: string, b: JobInput) {
    const jobRow = db.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!jobRow) {
      throw new WorkspaceActionError(404, 'Job not found');
    }

    const currentLogs = JSON.parse(String(jobRow.logs_json || '[]')) as Array<Record<string, unknown>>;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const nextAssignedType = b.assignedType ?? jobRow.assigned_type;
    const nextAssignedToId = b.assignedToId !== undefined ? b.assignedToId : jobRow.assigned_to_id;
    const nextAssignedToName = b.assignedToName !== undefined ? b.assignedToName : jobRow.assigned_to_name;
    const nextStatus = b.status ?? jobRow.status;
    const nextProgress = nextStatus === 'completed' ? 100 : (b.progressPercent ?? jobRow.progress_percent);

    if (b.logMessage) {
      currentLogs.push({
        timestamp: nowTime,
        message: String(b.logMessage),
        level: b.logLevel || 'info',
      });
    }

    db.db
      .prepare(`
        UPDATE jobs SET
          assigned_type = ?, assigned_to_id = ?, assigned_to_name = ?,
          status = ?, progress_percent = ?, logs_json = ?
        WHERE id = ?
      `)
      .run(
        String(nextAssignedType),
        nextAssignedToId ? String(nextAssignedToId) : null,
        nextAssignedToName ? String(nextAssignedToName) : null,
        String(nextStatus),
        Number(nextProgress),
        JSON.stringify(currentLogs),
        id
      );

    if (nextAssignedType === 'agent' && nextAssignedToId) {
      db.db.prepare('UPDATE connected_models SET status = ? WHERE id = ?').run('Active', String(nextAssignedToId));
    }

    return { jobs: db.listJobs(), models: db.listModels() };
  }

  async function runJobMessage(id: string, input: unknown) {
    const job = db.listJobs().find(entry => entry.id === id);
    if (!job) throw new WorkspaceActionError(404, 'Job not found.');
    if (runningJobs.has(id)) throw new WorkspaceActionError(409, 'This job already has a reply in progress.');
    if (job.status === 'paused') throw new WorkspaceActionError(409, 'Resume the job before sending a message.');
    const agent = job.assignedType === 'agent' && job.assignedToId ? db.getModelRow(job.assignedToId) : null;
    if (!agent) throw new WorkspaceActionError(409, 'Assign a connected agent to run this job.');
    const message = typeof input === 'string' ? input.trim() : '';
    if (input !== undefined && (!message || message.length > 8000)) {
      throw new WorkspaceActionError(400, 'Enter a message between 1 and 8000 characters.');
    }
    const conversation = job.logs.filter(log => log.role === 'user' || log.role === 'agent');
    if (!message && conversation.length) throw new WorkspaceActionError(409, 'This job already started. Send a reply to continue.');
    const task = job.description.trim() || job.title;
    const history = conversation.slice(-8)
      .map(log => `${log.role === 'user' ? 'User' : 'Agent'}: ${log.message}`).join('\n\n').slice(-14000);
    const prompt = message
      ? [`Original job: ${task.slice(0, 8000)}`, history, `User follow-up: ${message}`].filter(Boolean).join('\n\n')
      : task;

    const setStatusAfterRun = db.db.prepare(`UPDATE jobs SET status = ?
      WHERE id = ? AND status = 'in_progress' AND assigned_to_id = ?`);
    runningJobs.add(id);
    liveSteps.set(id, []);
    try {
      db.db.prepare("UPDATE jobs SET status = 'in_progress', progress_percent = 0 WHERE id = ?").run(id);
      const reply = await runModel(agent.id, prompt, undefined, steps => liveSteps.set(id, steps), listJobAttachments(db, id));
      if (!reply.ok) throw new WorkspaceActionError(502, reply.error || 'The agent returned no reply.');
      const now = new Date().toISOString();
      const append = db.db.prepare("UPDATE jobs SET logs_json = json_insert(logs_json, '$[#]', json(?)) WHERE id = ?");
      db.db.exec('BEGIN IMMEDIATE');
      try {
        if (message) append.run(JSON.stringify({ timestamp: now, role: 'user', level: 'info', message }), id);
        append.run(JSON.stringify({ timestamp: now, role: 'agent', author: agent.name, level: 'success', message: reply.output, ...(reply.steps?.length ? { steps: reply.steps } : {}) }), id);
        db.db.prepare('UPDATE jobs SET consumed_tokens = COALESCE(consumed_tokens, 0) + ?, output_summary = ? WHERE id = ?')
          .run(reply.tokensUsed, reply.output, id);
        if (setStatusAfterRun.run('completed', id, agent.id).changes) {
          db.db.prepare('UPDATE jobs SET progress_percent = 100 WHERE id = ?').run(id);
        }
        db.db.exec('COMMIT');
      } catch (error) {
        db.db.exec('ROLLBACK');
        throw error;
      }
      return { jobs: db.listJobs(), models: db.listModels() };
    } catch (error) {
      setStatusAfterRun.run('failed', id, agent.id);
      throw error;
    } finally {
      runningJobs.delete(id);
      liveSteps.delete(id);
    }
  }

  /** Live steps for a job reply that is still running (polled by the job thread). */
  function getJobProgress(id: string) {
    return { running: runningJobs.has(id), steps: liveSteps.get(id) ?? [] };
  }

  return { probeConnection, createModel, updateModel, disconnectModel, pingModel, runModel, createJob, updateJob, runJobMessage, getJobProgress };
}

export type WorkspaceActions = ReturnType<typeof workspaceActions>;
