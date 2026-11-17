import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { installAuth } from './server/auth.ts';
import { AuthStore } from './server/authStore.ts';
import {
  NeuroDatabase,
  TEAM_MEMBERS_STATIC,
  WORKFLOWS_STATIC,
} from './server/db.ts';
import {
  encryptSecretToken,
  decryptSecretToken,
  probeModelEndpoint,
  runPromptAgainstModel,
} from './server/modelProxy.ts';
import {
  normalizeEndpointDomain,
  generateConnectionFingerprint,
  validateModelConnection,
} from './src/lib/modelConnection.ts';
import { findBestIdleAgent } from './src/lib/jobAssignment.ts';
import { shouldProposeImprovement } from './src/lib/improvementsEngine.ts';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);

  const db = new NeuroDatabase();
  const workspaceSecret = db.getWorkspaceSecret();
  const startedAt = Date.now();

  // ── Health check (returns agent count & SQLite connection status) ──
  app.get('/api/health', (_req, res) => {
    const health = db.checkHealth();
    const payload = {
      ...health,
      modelsCount: health.agentCount,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      checkedAt: new Date().toISOString(),
    };
    res.status(health.ok ? 200 : 503).json(payload);
  });

  const publicUrl = new URL(process.env.APP_URL || `http://localhost:${PORT}`);
  installAuth(app, new AuthStore(db.db), publicUrl);
  app.use(express.json({ limit: '2mb' }));

  // ── Bootstrap all persisted workspace state ──
  app.get('/api/bootstrap', (_req, res) => {
    const models = db.listModels();
    const jobs = db.listJobs();
    const activities = db.listActivities();
    const improvements = db.getImprovementsBundle();
    const ingestKey = db.getOrCreateIngestKey();

    res.json({
      models,
      jobs,
      activities,
      workflows: WORKFLOWS_STATIC,
      teamMembers: TEAM_MEMBERS_STATIC,
      improvements,
      deployInfo: {
        ingestKey,
        telemetryPath: '/api/telemetry/events',
        storageMode: 'sqlite',
      },
    });
  });

  // ── Probe an arbitrary endpoint before saving ──
  app.post('/api/probe', async (req, res) => {
    const { endpointUrl, provider, authToken } = req.body ?? {};
    if (!endpointUrl || typeof endpointUrl !== 'string') {
      res.status(400).json({ error: 'endpointUrl is required' });
      return;
    }
    const result = await probeModelEndpoint(
      endpointUrl,
      String(provider || 'OpenAI-Compatible'),
      typeof authToken === 'string' ? authToken : undefined
    );
    res.json(result);
  });

  // ── Connect a new already-created model ──
  app.post('/api/models', (req, res) => {
    const payload = req.body ?? {};
    const validation = validateModelConnection({
      name: String(payload.name || ''),
      modelId: String(payload.modelId || ''),
      endpointUrl: String(payload.endpointUrl || ''),
      runtime: payload.runtime || 'Local Workstation',
      provider: payload.provider || 'Ollama',
      category: String(payload.category || 'Engineering'),
      description: payload.description,
      authToken: payload.authToken,
    });

    if (!validation.valid) {
      res.status(400).json({ error: 'Validation failed', errors: validation.errors });
      return;
    }

    const now = new Date();
    const id = `model_${Date.now()}`;
    const formattedDate =
      now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ', ' +
      now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const domain = normalizeEndpointDomain(payload.endpointUrl);
    const fingerprint = generateConnectionFingerprint(`${payload.endpointUrl}|${payload.modelId}`);
    const encryptedToken = payload.authToken
      ? encryptSecretToken(String(payload.authToken), workspaceSecret)
      : '';
    const description =
      (payload.description && String(payload.description).trim()) ||
      `Connected ${payload.provider} endpoint (${payload.modelId}) running on ${payload.runtime} with encrypted telemetry.`;
    const initialLatency =
      typeof payload.latencyMs === 'number'
        ? payload.latencyMs
        : payload.runtime === 'Local Workstation'
        ? 16
        : 38;

    db.db
      .prepare(`
        INSERT INTO connected_models (
          id, name, description, model, endpoint_url, runtime, provider, category,
          status, tokens, score, user_vote, latency_ms, e2ee_fingerprint, auth_token_encrypted,
          author, subreddit, domain, comments_count, created_at, date_label, last_ping_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', 0, 1, 'up', ?, ?, ?, 'u/franklin_dev', ?, ?, 1, ?, ?, 'Just now')
      `)
      .run(
        id,
        String(payload.name).trim(),
        description,
        String(payload.modelId).trim(),
        String(payload.endpointUrl).trim(),
        String(payload.runtime || 'Local Workstation'),
        String(payload.provider || 'Ollama'),
        String(payload.category || 'Engineering'),
        initialLatency,
        fingerprint,
        encryptedToken,
        `r/${String(payload.category || 'engineering').toLowerCase()}`,
        domain,
        now.toISOString(),
        formattedDate
      );

    db.db
      .prepare(`
        INSERT INTO activities (id, date_label, title, snippet, model_tag, bg_color_class, text_color_class, tag_color_class, response, created_at)
        VALUES (?, 'Just now', ?, ?, ?, 'bg-[#EAF5E4] dark:bg-[#1F2B1F]', 'text-slate-900 dark:text-slate-100', 'bg-emerald-600 text-white', ?, ?)
      `)
      .run(
        `act_${Date.now()}`,
        `Model Connected: ${String(payload.name).trim()}`,
        `Registered ${domain} (${String(payload.modelId).trim()}) on ${String(payload.runtime)}.`,
        String(payload.provider || 'Model'),
        `Persisted to SQLite · Fingerprint ${fingerprint}.`,
        now.toISOString()
      );

    const created = db.getModelRow(id);
    res.status(201).json({ model: created ? db.mapModelRow(created) : null });
  });

  // ── Update model connection, status, or vote ──
  app.patch('/api/models/:id', (req, res) => {
    const existing = db.getModelRow(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    const body = req.body ?? {};
    const nextName = typeof body.name === 'string' ? body.name.trim() : existing.name;
    const nextModel = typeof body.modelId === 'string' ? body.modelId.trim() : existing.model;
    const nextEndpoint = typeof body.endpointUrl === 'string' ? body.endpointUrl.trim() : existing.endpoint_url;
    const nextRuntime = typeof body.runtime === 'string' ? body.runtime : existing.runtime;
    const nextProvider = typeof body.provider === 'string' ? body.provider : existing.provider;
    const nextCategory = typeof body.category === 'string' ? body.category : existing.category;
    const nextDesc = typeof body.description === 'string' && body.description.trim()
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

    const nextDomain = normalizeEndpointDomain(nextEndpoint);
    const nextFingerprint = generateConnectionFingerprint(`${nextEndpoint}|${nextModel}`);
    const nextEncryptedToken =
      typeof body.authToken === 'string' && body.authToken.trim()
        ? encryptSecretToken(body.authToken, workspaceSecret)
        : existing.auth_token_encrypted;

    db.db
      .prepare(`
        UPDATE connected_models SET
          name = ?, description = ?, model = ?, endpoint_url = ?, runtime = ?,
          provider = ?, category = ?, status = ?, score = ?, user_vote = ?,
          domain = ?, e2ee_fingerprint = ?, auth_token_encrypted = ?
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
        nextStatus,
        nextScore,
        nextVote,
        nextDomain,
        nextFingerprint,
        nextEncryptedToken,
        existing.id
      );

    const updated = db.getModelRow(existing.id);
    res.json({ model: updated ? db.mapModelRow(updated) : null });
  });

  // ── Disconnect model ──
  app.delete('/api/models/:id', (req, res) => {
    db.db.prepare('DELETE FROM connected_models WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ── Real server-side ping to connected model endpoint ──
  app.post('/api/models/:id/ping', async (req, res) => {
    const row = db.getModelRow(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    const token = decryptSecretToken(row.auth_token_encrypted, workspaceSecret);
    const probe = await probeModelEndpoint(row.endpoint_url, row.provider, token || undefined);

    const nextStatus = probe.reachable ? 'Active' : row.status;
    db.db
      .prepare('UPDATE connected_models SET latency_ms = ?, last_ping_at = ?, status = ? WHERE id = ?')
      .run(probe.latencyMs, probe.reachable ? 'Verified just now' : 'Unreachable', nextStatus, row.id);

    const updated = db.getModelRow(row.id);
    res.json({
      probe,
      model: updated ? db.mapModelRow(updated) : null,
    });
  });

  // ── Real server-side prompt proxy to connected model ──
  app.post('/api/models/:id/run', async (req, res) => {
    const row = db.getModelRow(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    const promptText = String(req.body?.promptText || '').trim();
    if (!promptText) {
      res.status(400).json({ error: 'promptText is required' });
      return;
    }

    const token = decryptSecretToken(row.auth_token_encrypted, workspaceSecret);
    const runResult = await runPromptAgainstModel({
      endpointUrl: row.endpoint_url,
      provider: row.provider,
      modelId: row.model,
      promptText,
      authToken: token || undefined,
    });

    if (runResult.ok) {
      db.db
        .prepare('UPDATE connected_models SET tokens = tokens + ?, latency_ms = ?, status = ? WHERE id = ?')
        .run(runResult.tokensUsed, runResult.latencyMs, 'Active', row.id);

      db.db
        .prepare(`
          INSERT INTO activities (id, date_label, title, snippet, model_tag, bg_color_class, text_color_class, tag_color_class, response, created_at)
          VALUES (?, 'Just now', ?, ?, ?, 'bg-[#EBF2FC] dark:bg-[#1E2530]', 'text-slate-900 dark:text-slate-100', 'bg-blue-600 text-white', ?, ?)
        `)
        .run(
          `act_${Date.now()}`,
          `${row.name.split(' ')[0]} Live Run`,
          promptText,
          row.provider || row.model,
          runResult.output,
          new Date().toISOString()
        );
    }

    const updated = db.getModelRow(row.id);
    res.json({
      ...runResult,
      model: updated ? db.mapModelRow(updated) : null,
    });
  });

  // ── Jobs CRUD & Auto-Assignment ──
  app.post('/api/jobs', (req, res) => {
    const b = req.body ?? {};
    const id = `job_${Date.now()}`;
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'Just now', ?, ?, null, ?)
      `)
      .run(
        id,
        String(b.title || 'Untitled Fleet Task'),
        String(b.description || 'Autonomous model orchestration task'),
        status,
        String(b.priority || 'medium'),
        assignedType,
        b.assignedToId || null,
        b.assignedToName || null,
        b.assignedToRole || null,
        String(b.category || 'Engineering'),
        Number(b.estimatedTokens || 350),
        String(b.deadline || 'ASAP'),
        String(b.payloadSpec || 'Input payload spec'),
        JSON.stringify(logs)
      );

    if (assignedType === 'agent' && b.assignedToId) {
      db.db.prepare('UPDATE connected_models SET status = ? WHERE id = ?').run('Active', String(b.assignedToId));
    }

    res.status(201).json({ jobs: db.listJobs(), models: db.listModels() });
  });

  app.patch('/api/jobs/:id', (req, res) => {
    const jobRow = db.db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!jobRow) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const b = req.body ?? {};
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
        req.params.id
      );

    if (nextAssignedType === 'agent' && nextAssignedToId) {
      db.db.prepare('UPDATE connected_models SET status = ? WHERE id = ?').run('Active', String(nextAssignedToId));
    }

    res.json({ jobs: db.listJobs(), models: db.listModels() });
  });

  app.post('/api/jobs/auto-assign', (_req, res) => {
    const models = db.listModels();
    const jobs = db.listJobs();
    const queued = jobs.filter(j => j.status === 'queued' || j.assignedType === 'unassigned');
    let mutableModels = [...models];
    let assignedCount = 0;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    for (const job of queued) {
      const idleModel = findBestIdleAgent(job, mutableModels);
      if (!idleModel) continue;

      mutableModels = mutableModels.map(m =>
        m.id === idleModel.id ? { ...m, status: 'Active', isRunning: true } : m
      );
      const nextLogs = [
        ...job.logs,
        {
          timestamp: nowTime,
          message: `Auto-assigned to dormant connected model "${idleModel.name}" (${idleModel.model}). Status awakened to ACTIVE.`,
          level: 'success',
        },
      ];

      db.db
        .prepare('UPDATE jobs SET assigned_type = ?, assigned_to_id = ?, assigned_to_name = ?, status = ?, logs_json = ? WHERE id = ?')
        .run('agent', idleModel.id, idleModel.name, 'in_progress', JSON.stringify(nextLogs), job.id);

      db.db.prepare('UPDATE connected_models SET status = ? WHERE id = ?').run('Active', idleModel.id);
      assignedCount++;
    }

    res.json({ assignedCount, jobs: db.listJobs(), models: db.listModels() });
  });

  // ── External Agent Telemetry Ingest Webhook ──
  // External agents (Claude Code hooks, LangGraph/Python workers, Ollama wrappers) POST here
  app.post('/api/telemetry/events', (req, res) => {
    const expectedKey = db.getOrCreateIngestKey();
    const authHeader = String(req.headers.authorization || '');
    const providedKey = authHeader.replace(/^Bearer\s+/i, '').trim() || String(req.headers['x-ingest-key'] || '').trim();

    if (providedKey !== expectedKey) {
      res.status(401).json({ error: 'Invalid or missing ingest Bearer key' });
      return;
    }

    const body = req.body ?? {};
    const type = String(body.type || 'heartbeat');
    const modelId = body.modelId ? String(body.modelId) : null;
    const modelRow = modelId ? db.getModelRow(modelId) : null;
    const agentName = String(body.agentName || modelRow?.name || 'External Agent');
    const repository = String(body.repository || 'workspace/default');
    const message = String(body.message || '').trim();
    const tokensUsed = Number(body.tokensUsed || 0);
    const latencyMs = Number(body.latencyMs || 0);

    // Increment analyzed messages counter
    const currentMsgs = Number(db.getSetting('analyzed_messages_count') || '0');
    db.setSetting('analyzed_messages_count', String(currentMsgs + 1));

    // Update model telemetry if matched
    if (modelRow) {
      db.db
        .prepare('UPDATE connected_models SET tokens = tokens + ?, latency_ms = ?, status = ?, last_ping_at = ? WHERE id = ?')
        .run(
          Math.max(0, tokensUsed),
          latencyMs > 0 ? latencyMs : modelRow.latency_ms,
          'Active',
          'Telemetry just now',
          modelRow.id
        );
    }

    let promotedProposal = false;

    if (type === 'correction' || type === 'steering' || type === 'frustration') {
      const sigId = `sig_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      db.db
        .prepare(`
          INSERT INTO friction_signals (id, kind, agent_id, agent_name, repository, message, timestamp, day_label, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'Just now', 'Today', ?)
        `)
        .run(
          sigId,
          type,
          modelRow?.id || 'external_agent',
          agentName,
          repository,
          message || `Captured ${type} signal from ${agentName}`,
          new Date().toISOString()
        );

      // Group cluster by kind + repository
      const clusterId = `cl_${type}_${repository.replace(/[^a-z0-9]/gi, '_')}`;
      const existingCluster = db.db
        .prepare('SELECT * FROM signal_clusters WHERE id = ?')
        .get(clusterId) as Record<string, unknown> | undefined;

      const occurrences = existingCluster ? Number(existingCluster.occurrences) + 1 : 1;
      const conversations = existingCluster ? Number(existingCluster.conversation_count) + 1 : 1;
      const ready = shouldProposeImprovement(occurrences, conversations);

      if (existingCluster) {
        db.db
          .prepare('UPDATE signal_clusters SET occurrences = ?, conversation_count = ?, status = ? WHERE id = ?')
          .run(occurrences, conversations, ready ? 'ready' : 'forming', clusterId);
      } else {
        db.db
          .prepare(`
            INSERT INTO signal_clusters (id, title, kind, occurrences, conversation_count, target_file, model_names_json, status)
            VALUES (?, ?, ?, 1, 1, 'AGENT_RULES.md', ?, 'forming')
          `)
          .run(clusterId, `${type} friction in ${repository}`, type, JSON.stringify([agentName]));
      }

      if (ready) {
        const existingProposal = db.db
          .prepare('SELECT id FROM improvement_proposals WHERE cluster_id = ? AND status = ?')
          .get(clusterId, 'pending');
        if (!existingProposal) {
          promotedProposal = true;
          db.db
            .prepare(`
              INSERT INTO improvement_proposals (
                id, cluster_id, title, summary, model_id, model_name, repository,
                target_file, occurrences, conversations, kind, rule_snippet,
                diff_before, diff_after, status, detected_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'AGENT_RULES.md', ?, ?, ?, ?, ?, ?, 'pending', 'Just now')
            `)
            .run(
              `imp_${Date.now()}`,
              clusterId,
              `Auto-rule for ${type} signals in ${repository}`,
              `Triggered by ${occurrences} recurring ${type} events across ${conversations} conversations.`,
              modelRow?.id || 'external_agent',
              agentName,
              repository,
              occurrences,
              conversations,
              type,
              `- Prevent ${type}: ${message.slice(0, 110) || 'follow workspace rule invariants.'}`,
              '# Agent Rules\n- Maintain repository invariants.',
              `# Agent Rules\n- Maintain repository invariants.\n+ Prevent ${type}: ${message.slice(0, 110) || 'follow workspace rule invariants.'}`
            );
        }
      }
    }

    res.status(201).json({
      ok: true,
      recordedType: type,
      promotedProposal,
    });
  });

  // ── Improvements UI Endpoints ──
  app.post('/api/improvements/:id/decision', (req, res) => {
    const decision = req.body?.decision === 'applied' ? 'applied' : 'dismissed';
    db.db
      .prepare('UPDATE improvement_proposals SET status = ? WHERE id = ?')
      .run(decision, req.params.id);
    res.json({ improvements: db.getImprovementsBundle() });
  });

  app.post('/api/improvements/scan', (_req, res) => {
    const models = db.listModels();
    const primary = models[0];
    const sigId = `sig_${Date.now()}`;
    db.db
      .prepare(`
        INSERT INTO friction_signals (id, kind, agent_id, agent_name, repository, message, timestamp, day_label, created_at)
        VALUES (?, 'steering', ?, ?, 'creativeprocess/core-platform', ?, 'Just now', 'Today', ?)
      `)
      .run(
        sigId,
        primary?.id || 'agent_coder',
        primary?.name || 'Connected Model',
        `Pinned ${primary?.model || 'model'} to verify E2EE payload schemas before endpoint commits.`,
        new Date().toISOString()
      );

    const currentMsgs = Number(db.getSetting('analyzed_messages_count') || '0');
    db.setSetting('analyzed_messages_count', String(currentMsgs === 0 ? 120 : currentMsgs + 32));

    const pendingCountRow = db.db
      .prepare('SELECT COUNT(*) as cnt FROM improvement_proposals WHERE status = ?')
      .get('pending') as { cnt: number };

    if (pendingCountRow.cnt === 0) {
      db.db
        .prepare(`
          INSERT INTO improvement_proposals (
            id, cluster_id, title, summary, model_id, model_name, repository,
            target_file, occurrences, conversations, kind, rule_snippet,
            diff_before, diff_after, status, detected_at
          ) VALUES (?, 'cl_scan', ?, ?, ?, ?, 'creativeprocess/core-platform', 'AGENT_RULES.md', 3, 2, 'steering', ?, ?, ?, 'pending', 'Just now')
        `)
        .run(
          `imp_${Date.now()}`,
          `Standardize E2EE schema check on ${primary?.model || 'model'}`,
          `Detected 3 recurring schema-steering interventions across 2 sessions on ${primary?.name || 'connected model'}.`,
          primary?.id || 'agent_coder',
          primary?.name || 'Connected Model',
          '- Validate encrypted payload schema headers before returning tool execution.',
          '# Connected Model Rules\n- Log execution latency per invocation.',
          '# Connected Model Rules\n- Log execution latency per invocation.\n+ Validate encrypted payload schema headers before returning tool execution.'
        );
    }

    const dailyCnt = db.db.prepare('SELECT COUNT(*) as cnt FROM daily_signal_series').get() as { cnt: number };
    if (dailyCnt.cnt <= 1) {
      const insertDaily = db.db.prepare(`
        INSERT OR REPLACE INTO daily_signal_series (date_label, corrections_pct, steering_pct, frustration_pct, message_count, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertDaily.run('Oct 13', 1.9, 1.4, 0.9, 68, 1);
      insertDaily.run('Oct 27', 1.5, 1.2, 0.7, 91, 2);
      insertDaily.run('Today', 1.0, 0.8, 0.4, 62, 3);
    }

    res.json({ improvements: db.getImprovementsBundle() });
  });

  app.post('/api/improvements/reset', (_req, res) => {
    db.db.prepare('DELETE FROM friction_signals').run();
    db.db.prepare('DELETE FROM signal_clusters').run();
    db.db.prepare('DELETE FROM daily_signal_series').run();
    db.db.prepare("UPDATE improvement_proposals SET status = 'dismissed' WHERE status = 'pending'").run();
    db.setSetting('analyzed_messages_count', '0');
    res.json({ improvements: db.getImprovementsBundle() });
  });

  app.post('/api/improvements/feedback', (req, res) => {
    const text = String(req.body?.message || '').trim();
    if (text) {
      db.db
        .prepare('INSERT INTO feedback_entries (id, text, submitted_at) VALUES (?, ?, ?)')
        .run(`fb_${Date.now()}`, text, 'Just now');
    }
    res.json({ improvements: db.getImprovementsBundle() });
  });

  // ── Frontend Serving (Vite middleware in dev, static dist/ in prod) ──
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NeuroNest server running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'} · SQLite: ${db.dbPath})`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
