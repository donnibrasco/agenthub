import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { attachmentsByJob } from './attachments.ts';
import type {
  NeuroAgent,
  NeuroJob,
  RecentActivity,
  ImproveFeedbackEntry,
} from '../src/context/NeuroContext.tsx';
import type {
  FrictionSignal,
  SignalCluster,
  ImprovementProposal,
  DailySignalPoint,
} from '../src/lib/improvementsEngine.ts';

export interface StoredModelRow {
  id: string;
  name: string;
  description: string;
  model: string;
  endpoint_url: string;
  runtime: string;
  provider: string;
  category: string;
  status: 'Active' | 'Idle' | 'Syncing';
  tokens: number;
  score: number;
  user_vote: 'up' | 'down' | null;
  latency_ms: number;
  e2ee_fingerprint: string;
  auth_token_encrypted: string;
  author: string;
  subreddit: string;
  domain: string;
  comments_count: number;
  created_at: string;
  date_label: string;
  last_ping_at: string;
}

const DEFAULT_DB_PATH = process.env.NEURONEST_DB_PATH || path.join(process.cwd(), 'data', 'neuronest.sqlite');

export class NeuroDatabase {
  public readonly db: DatabaseSync;
  public readonly dbPath: string;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.createSchema();
    this.removeLegacySampleData();
  }

  private createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS connected_models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        model TEXT NOT NULL,
        endpoint_url TEXT NOT NULL,
        runtime TEXT NOT NULL,
        provider TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Idle',
        tokens INTEGER NOT NULL DEFAULT 0,
        score INTEGER NOT NULL DEFAULT 0,
        user_vote TEXT,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        e2ee_fingerprint TEXT NOT NULL,
        auth_token_encrypted TEXT NOT NULL DEFAULT '',
        author TEXT NOT NULL DEFAULT 'admin',
        subreddit TEXT NOT NULL DEFAULT 'r/engineering',
        domain TEXT NOT NULL,
        comments_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        date_label TEXT NOT NULL,
        last_ping_at TEXT NOT NULL DEFAULT 'Not checked'
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        assigned_type TEXT NOT NULL,
        assigned_to_id TEXT,
        assigned_to_name TEXT,
        assigned_to_role TEXT,
        category TEXT NOT NULL,
        estimated_tokens INTEGER NOT NULL DEFAULT 350,
        consumed_tokens INTEGER DEFAULT 0,
        progress_percent INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        deadline TEXT,
        payload_spec TEXT,
        output_summary TEXT,
        logs_json TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        job_id TEXT,
        name TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        kind TEXT NOT NULL,
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        date_label TEXT NOT NULL,
        title TEXT NOT NULL,
        snippet TEXT NOT NULL,
        model_tag TEXT NOT NULL,
        bg_color_class TEXT NOT NULL,
        text_color_class TEXT NOT NULL,
        tag_color_class TEXT NOT NULL,
        response TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS friction_signals (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        repository TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        day_label TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS signal_clusters (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        occurrences INTEGER NOT NULL,
        conversation_count INTEGER NOT NULL,
        target_file TEXT NOT NULL,
        model_names_json TEXT NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS improvement_proposals (
        id TEXT PRIMARY KEY,
        cluster_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        model_id TEXT NOT NULL,
        model_name TEXT NOT NULL,
        repository TEXT NOT NULL,
        target_file TEXT NOT NULL,
        occurrences INTEGER NOT NULL,
        conversations INTEGER NOT NULL,
        kind TEXT NOT NULL,
        rule_snippet TEXT NOT NULL,
        diff_before TEXT NOT NULL,
        diff_after TEXT NOT NULL,
        status TEXT NOT NULL,
        detected_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_signal_series (
        date_label TEXT PRIMARY KEY,
        corrections_pct REAL NOT NULL,
        steering_pct REAL NOT NULL,
        frustration_pct REAL NOT NULL,
        message_count INTEGER NOT NULL,
        sort_order INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS feedback_entries (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        submitted_at TEXT NOT NULL
      );
    `);
  }

  public getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM workspace_settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? row.value : null;
  }

  public setSetting(key: string, value: string) {
    this.db
      .prepare('INSERT INTO workspace_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);
  }

  public getOrCreateIngestKey(): string {
    if (process.env.NEURONEST_INGEST_KEY && process.env.NEURONEST_INGEST_KEY.trim()) {
      return process.env.NEURONEST_INGEST_KEY.trim();
    }
    const existing = this.getSetting('ingest_api_key');
    if (existing) return existing;
    const generated = `nr_ingest_${crypto.randomBytes(16).toString('hex')}`;
    this.setSetting('ingest_api_key', generated);
    return generated;
  }

  public getWorkspaceSecret(): string {
    if (process.env.NEURONEST_SECRET && process.env.NEURONEST_SECRET.trim()) {
      return process.env.NEURONEST_SECRET.trim();
    }
    const existing = this.getSetting('workspace_secret');
    if (existing) return existing;
    const generated = crypto.randomBytes(24).toString('hex');
    this.setSetting('workspace_secret', generated);
    return generated;
  }

  private removeLegacySampleData() {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.getSetting('sample_data_removed_v1') !== 'true') {
        const seededModels = "('agent_coder', 'agent_email', 'agent_design', 'agent_voice', 'agent_crawler', 'agent_docs', 'agent_sql')";
        const seededSignals = "('sig_1', 'sig_2', 'sig_3', 'sig_4', 'sig_5', 'sig_6', 'sig_7', 'sig_8', 'sig_9')";
        const simulatedScan = `id GLOB 'sig_[0-9]*' AND substr(id, 5) NOT GLOB '*[^0-9]*'
          AND kind = 'steering' AND repository = 'creativeprocess/core-platform'
          AND message GLOB 'Pinned * to verify E2EE payload schemas before endpoint commits.'`;
        const scan = this.db.prepare(`SELECT COUNT(*) AS count, MIN(created_at) AS first
          FROM friction_signals WHERE ${simulatedScan}`).get() as { count: number; first: string | null };
        const seededCount = this.db.prepare(`SELECT COUNT(*) AS count FROM friction_signals WHERE id IN ${seededSignals}`)
          .get() as { count: number };

        this.db.exec(`
          DELETE FROM connected_models WHERE id IN ${seededModels};
          UPDATE connected_models SET author = 'admin', comments_count = CASE WHEN comments_count = 1 THEN 0 ELSE comments_count END
          WHERE id GLOB 'model_*' AND author = 'u/franklin_dev';
          UPDATE connected_models SET latency_ms = 0, last_ping_at = 'Not checked'
          WHERE id GLOB 'model_*' AND tokens = 0 AND last_ping_at = 'Just now'
            AND latency_ms = CASE WHEN runtime = 'Local Workstation' THEN 16 ELSE 38 END;
          DELETE FROM jobs WHERE id IN ('job_1', 'job_2', 'job_3', 'job_4', 'job_5', 'job_6');
          UPDATE jobs SET assigned_type = 'unassigned', assigned_to_id = NULL, assigned_to_name = NULL,
            assigned_to_role = NULL, status = CASE WHEN status = 'in_progress' THEN 'queued' ELSE status END
          WHERE (assigned_type = 'agent' AND assigned_to_id IN ${seededModels})
            OR (assigned_type = 'user' AND assigned_to_id IN ('user_franklin', 'user_sarah', 'user_alex', 'user_marcus'));
          DELETE FROM activities WHERE id IN ('act_1', 'act_2', 'act_3');
          DELETE FROM friction_signals WHERE id IN ${seededSignals} OR (${simulatedScan});
          DELETE FROM signal_clusters WHERE id IN ('cl_1', 'cl_2', 'cl_3');
          DELETE FROM improvement_proposals WHERE id IN ('imp_1', 'imp_2') OR cluster_id = 'cl_scan';
          DELETE FROM daily_signal_series WHERE date_label IN ('Oct 13', 'Oct 17', 'Oct 21', 'Oct 27', 'Nov 03', 'Nov 09', 'Today');
        `);

        if (seededCount.count || scan.count) {
          const remaining = this.db.prepare('SELECT COUNT(*) AS count, MIN(created_at) AS first FROM friction_signals')
            .get() as { count: number; first: string | null };
          const total = Number(this.getSetting('analyzed_messages_count') || '0');
          const seededBaseline = seededCount.count ? 360 : 0;
          const firstScanStartedFromZero = !seededBaseline && scan.first &&
            (!remaining.first || remaining.first >= scan.first) && total >= 120 + (scan.count - 1) * 32;
          // Older versions stored only a combined count, so unrecorded events before a scan cannot be recovered.
          const scanBaseline = scan.count * 32 + (firstScanStartedFromZero ? 88 : 0);
          this.setSetting('analyzed_messages_count', String(Math.max(remaining.count, total - seededBaseline - scanBaseline)));
        }
        this.db.prepare("DELETE FROM workspace_settings WHERE key = 'initial_seed_v1'").run();
        this.setSetting('sample_data_removed_v1', 'true');
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  public recordDailyTelemetry(receivedAt: string, type: string) {
    this.db.prepare(`
      INSERT INTO daily_signal_series (date_label, corrections_pct, steering_pct, frustration_pct, message_count, sort_order)
      VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(date_label) DO UPDATE SET
        corrections_pct = (corrections_pct * message_count + excluded.corrections_pct) / (message_count + 1),
        steering_pct = (steering_pct * message_count + excluded.steering_pct) / (message_count + 1),
        frustration_pct = (frustration_pct * message_count + excluded.frustration_pct) / (message_count + 1),
        message_count = message_count + 1
    `).run(
      receivedAt.slice(0, 10),
      type === 'correction' ? 100 : 0,
      type === 'steering' ? 100 : 0,
      type === 'frustration' ? 100 : 0,
      Math.floor(Date.parse(receivedAt) / 86_400_000)
    );
  }

  public mapModelRow(row: StoredModelRow): NeuroAgent {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      model: row.model,
      date: row.date_label,
      createdAt: row.created_at,
      status: row.status,
      tokens: row.tokens,
      isRunning: row.status === 'Active',
      category: row.category,
      score: row.score,
      userVote: row.user_vote,
      author: row.author,
      subreddit: row.subreddit,
      domain: row.domain,
      commentsCount: row.comments_count,
      endpointUrl: row.endpoint_url,
      runtime: row.runtime as NeuroAgent['runtime'],
      provider: row.provider as NeuroAgent['provider'],
      latencyMs: row.latency_ms,
      e2eeFingerprint: row.e2ee_fingerprint,
      lastPingAt: row.last_ping_at,
    };
  }

  public listModels(): NeuroAgent[] {
    const rows = this.db.prepare('SELECT * FROM connected_models ORDER BY created_at DESC').all() as unknown as StoredModelRow[];
    return rows.map(r => this.mapModelRow(r));
  }

  public getModelRow(id: string): StoredModelRow | null {
    const row = this.db.prepare('SELECT * FROM connected_models WHERE id = ?').get(id) as unknown as StoredModelRow | undefined;
    return row ?? null;
  }

  public listJobs(): NeuroJob[] {
    const rows = this.db.prepare('SELECT * FROM jobs').all() as Array<Record<string, unknown>>;
    const attachments = attachmentsByJob(this);
    return rows.map(r => ({
      attachments: attachments.get(String(r.id)) ?? [],
      id: String(r.id),
      title: String(r.title),
      description: String(r.description),
      status: r.status as NeuroJob['status'],
      priority: r.priority as NeuroJob['priority'],
      assignedType: r.assigned_type as NeuroJob['assignedType'],
      assignedToId: r.assigned_to_id ? String(r.assigned_to_id) : undefined,
      assignedToName: r.assigned_to_name ? String(r.assigned_to_name) : undefined,
      assignedToRole: r.assigned_to_role ? String(r.assigned_to_role) : undefined,
      category: r.category as NeuroJob['category'],
      estimatedTokens: Number(r.estimated_tokens || 0),
      consumedTokens: r.consumed_tokens ? Number(r.consumed_tokens) : undefined,
      progressPercent: Number(r.progress_percent || 0),
      createdAt: String(r.created_at),
      deadline: r.deadline ? String(r.deadline) : undefined,
      payloadSpec: r.payload_spec ? String(r.payload_spec) : undefined,
      outputSummary: r.output_summary ? String(r.output_summary) : undefined,
      logs: JSON.parse(String(r.logs_json || '[]')),
    }));
  }

  public listActivities(): RecentActivity[] {
    const rows = this.db
      .prepare('SELECT * FROM activities ORDER BY created_at DESC LIMIT 30')
      .all() as Array<Record<string, unknown>>;
    return rows.map(r => ({
      id: String(r.id),
      date: String(r.date_label),
      title: String(r.title),
      snippet: String(r.snippet),
      modelTag: String(r.model_tag),
      bgColorClass: String(r.bg_color_class),
      textColorClass: String(r.text_color_class),
      tagColorClass: String(r.tag_color_class),
      response: String(r.response),
      createdAt: r.created_at ? String(r.created_at) : undefined,
    }));
  }

  public getImprovementsBundle(): {
    frictionSignals: FrictionSignal[];
    signalClusters: SignalCluster[];
    improvementProposals: ImprovementProposal[];
    totalAnalyzedMessages: number;
    dailySignalSeries: DailySignalPoint[];
    feedbackLog: ImproveFeedbackEntry[];
  } {
    const signalsRows = this.db
      .prepare('SELECT * FROM friction_signals ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>>;
    const frictionSignals: FrictionSignal[] = signalsRows.map(r => ({
      id: String(r.id),
      kind: r.kind as FrictionSignal['kind'],
      agentId: String(r.agent_id),
      agentName: String(r.agent_name),
      repository: String(r.repository),
      message: String(r.message),
      timestamp: String(r.timestamp),
      dayLabel: String(r.day_label),
    }));

    const clusterRows = this.db.prepare('SELECT * FROM signal_clusters').all() as Array<Record<string, unknown>>;
    const signalClusters: SignalCluster[] = clusterRows.map(r => ({
      id: String(r.id),
      title: String(r.title),
      kind: r.kind as SignalCluster['kind'],
      occurrences: Number(r.occurrences),
      conversationCount: Number(r.conversation_count),
      targetFile: String(r.target_file),
      modelNames: JSON.parse(String(r.model_names_json || '[]')),
      status: r.status as SignalCluster['status'],
    }));

    const proposalRows = this.db.prepare('SELECT * FROM improvement_proposals').all() as Array<Record<string, unknown>>;
    const improvementProposals: ImprovementProposal[] = proposalRows.map(r => ({
      id: String(r.id),
      clusterId: String(r.cluster_id),
      title: String(r.title),
      summary: String(r.summary),
      modelId: String(r.model_id),
      modelName: String(r.model_name),
      repository: String(r.repository),
      targetFile: r.target_file as ImprovementProposal['targetFile'],
      occurrences: Number(r.occurrences),
      conversations: Number(r.conversations),
      kind: r.kind as ImprovementProposal['kind'],
      ruleSnippet: String(r.rule_snippet),
      diffBefore: String(r.diff_before),
      diffAfter: String(r.diff_after),
      status: r.status as ImprovementProposal['status'],
      detectedAt: String(r.detected_at),
    }));

    const seriesRows = this.db
      .prepare('SELECT * FROM daily_signal_series ORDER BY sort_order ASC')
      .all() as Array<Record<string, unknown>>;
    const dailySignalSeries: DailySignalPoint[] = seriesRows.map(r => ({
      dateLabel: String(r.date_label),
      correctionsPct: Number(r.corrections_pct),
      steeringPct: Number(r.steering_pct),
      frustrationPct: Number(r.frustration_pct),
      messageCount: Number(r.message_count),
    }));

    const feedbackRows = this.db.prepare('SELECT * FROM feedback_entries').all() as Array<Record<string, unknown>>;
    const feedbackLog: ImproveFeedbackEntry[] = feedbackRows.map(r => ({
      id: String(r.id),
      text: String(r.text),
      submittedAt: String(r.submitted_at),
    }));

    const totalAnalyzedMessages = Number(this.getSetting('analyzed_messages_count') || '0');

    return {
      frictionSignals,
      signalClusters,
      improvementProposals,
      totalAnalyzedMessages,
      dailySignalSeries,
      feedbackLog,
    };
  }

  public checkHealth(): {
    ok: boolean;
    status: 'healthy' | 'degraded';
    database: 'connected' | 'disconnected';
    storage: 'sqlite';
    dbPath: string;
    agentCount: number;
    activeAgentCount: number;
    error?: string;
  } {
    try {
      this.db.prepare('SELECT 1 AS ok').get();
      const totalRow = this.db
        .prepare('SELECT COUNT(*) AS count FROM connected_models')
        .get() as { count: number } | undefined;
      const activeRow = this.db
        .prepare("SELECT COUNT(*) AS count FROM connected_models WHERE status = 'Active'")
        .get() as { count: number } | undefined;

      return {
        ok: true,
        status: 'healthy',
        database: 'connected',
        storage: 'sqlite',
        dbPath: this.dbPath,
        agentCount: Number(totalRow?.count ?? 0),
        activeAgentCount: Number(activeRow?.count ?? 0),
      };
    } catch (err) {
      return {
        ok: false,
        status: 'degraded',
        database: 'disconnected',
        storage: 'sqlite',
        dbPath: this.dbPath,
        agentCount: 0,
        activeAgentCount: 0,
        error: err instanceof Error ? err.message : 'Database connection check failed',
      };
    }
  }
}
