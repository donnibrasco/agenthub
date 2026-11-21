import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { installAuth } from './server/auth.ts';
import { ADMIN_USERNAME, AuthStore } from './server/authStore.ts';
import { registerCodexChat } from './server/codexChat.ts';
import { NeuroDatabase } from './server/db.ts';
import { WorkspaceActionError, workspaceActions, workspaceRoute } from './server/workspaceActions.ts';
import { registerAttachmentRoutes } from './server/attachments.ts';
import { DeviceHub } from './server/devices.ts';
import { DOWNLOAD_FILES, latestDesktopRelease, type DownloadOs } from './server/releases.ts';
import { configureLocalAgents } from './server/localAgents.ts';
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
  const workspace = workspaceActions(db, workspaceSecret);
  const deviceHub = new DeviceHub(db);
  configureLocalAgents(deviceHub);
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
  registerAttachmentRoutes(app, db);
  registerCodexChat(app, db, workspace, workspaceSecret);

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
      workflows: [],
      teamMembers: [{ id: ADMIN_USERNAME, name: ADMIN_USERNAME, role: 'Workspace administrator' }],
      improvements,
      deployInfo: {
        ingestKey,
        telemetryPath: '/api/telemetry/events',
        storageMode: 'sqlite',
      },
    });
  });

  // ── Desktop app downloads: always the latest GitHub release ──
  app.get('/download/:os', async (req, res) => {
    const os = String(req.params.os).toLowerCase() as DownloadOs;
    const release = os in DOWNLOAD_FILES ? await latestDesktopRelease() : null;
    const url = release?.urls[os];
    if (url) res.redirect(302, url);
    else res.redirect(302, '/download#download');
  });

  // ── Computers that run Codex / Claude Code (AgentHub connector) ──
  deviceHub.registerRoutes(app);
  app.get('/connector/agenthub-connector.mjs', (_req, res) => {
    res.set({ 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.sendFile(path.resolve('connector/agenthub-connector.mjs'));
  });

  // ── Probe an arbitrary endpoint before saving ──
  app.post('/api/probe', workspaceRoute(req => workspace.probeConnection(req.body ?? {})));

  // ── Connect a new already-created model ──
  app.post('/api/models', workspaceRoute(req => workspace.createModel(req.body ?? {}), 201));

  // ── Update model connection, status, or vote ──
  app.patch('/api/models/:id', workspaceRoute(req => workspace.updateModel(req.params.id, req.body ?? {})));

  // ── Disconnect model ──
  app.delete('/api/models/:id', workspaceRoute(req => workspace.disconnectModel(req.params.id)));

  // ── Real server-side ping to connected model endpoint ──
  app.post('/api/models/:id/ping', workspaceRoute(req => workspace.pingModel(req.params.id)));

  // ── Real server-side prompt proxy to connected model ──
  app.post('/api/models/:id/run', workspaceRoute(req => workspace.runModel(req.params.id, String(req.body?.promptText || '').trim())));

  // ── Jobs CRUD & Auto-Assignment ──
  app.post('/api/jobs', workspaceRoute(req => workspace.createJob(req.body ?? {}), 201));

  app.patch('/api/jobs/:id', workspaceRoute(req => workspace.updateJob(req.params.id, req.body ?? {})));
  app.post('/api/jobs/:id/messages', workspaceRoute(req => workspace.runJobMessage(req.params.id, req.body?.message)));
  app.get('/api/jobs/:id/progress', workspaceRoute(req => workspace.getJobProgress(req.params.id)));

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
    const receivedAt = new Date().toISOString();

    // Increment analyzed messages counter
    const currentMsgs = Number(db.getSetting('analyzed_messages_count') || '0');
    db.setSetting('analyzed_messages_count', String(currentMsgs + 1));
    db.recordDailyTelemetry(receivedAt, type);

    // Update model telemetry if matched
    if (modelRow) {
      db.db
        .prepare('UPDATE connected_models SET tokens = tokens + ?, latency_ms = ?, status = ?, last_ping_at = ? WHERE id = ?')
        .run(
          Math.max(0, tokensUsed),
          latencyMs > 0 ? latencyMs : modelRow.latency_ms,
          'Active',
          receivedAt,
          modelRow.id
        );
    }

    let promotedProposal = false;

    if (type === 'correction' || type === 'steering' || type === 'frustration') {
      const sigId = `sig_${randomUUID()}`;
      db.db
        .prepare(`
          INSERT INTO friction_signals (id, kind, agent_id, agent_name, repository, message, timestamp, day_label, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          sigId,
          type,
          modelRow?.id || 'external_agent',
          agentName,
          repository,
          message || `Captured ${type} signal from ${agentName}`,
          receivedAt,
          receivedAt.slice(0, 10),
          receivedAt
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
              `Triggered by ${occurrences} recorded ${type} events in ${repository}.`,
              modelRow?.id || 'external_agent',
              agentName,
              repository,
              occurrences,
              conversations,
              type,
              `- Prevent ${type}: ${message.slice(0, 110) || 'follow workspace rule invariants.'}`,
              '',
              `+ Prevent ${type}: ${message.slice(0, 110) || 'follow workspace rule invariants.'}`
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

  app.get('/api/improvements', (_req, res) => {
    res.json({ improvements: db.getImprovementsBundle() });
  });
  app.post('/api/improvements/scan', (_req, res) => {
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
    console.log(`AgentHub server running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'} · SQLite: ${db.dbPath})`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
