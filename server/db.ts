import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  NeuroAgent,
  NeuroJob,
  RecentActivity,
  TeamMember,
  WorkflowItem,
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
    this.seedIfEmpty();
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
        status TEXT NOT NULL DEFAULT 'Active',
        tokens INTEGER NOT NULL DEFAULT 0,
        score INTEGER NOT NULL DEFAULT 1,
        user_vote TEXT,
        latency_ms INTEGER NOT NULL DEFAULT 32,
        e2ee_fingerprint TEXT NOT NULL,
        auth_token_encrypted TEXT NOT NULL DEFAULT '',
        author TEXT NOT NULL DEFAULT 'u/franklin_dev',
        subreddit TEXT NOT NULL DEFAULT 'r/engineering',
        domain TEXT NOT NULL,
        comments_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        date_label TEXT NOT NULL,
        last_ping_at TEXT NOT NULL DEFAULT 'Just now'
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

  private seedIfEmpty() {
    this.getOrCreateIngestKey();
    this.getWorkspaceSecret();

    const modelCountRow = this.db.prepare('SELECT COUNT(*) as cnt FROM connected_models').get() as { cnt: number };
    const seededAlready = this.getSetting('initial_seed_v1');
    if (modelCountRow.cnt > 0 || seededAlready === 'true') {
      return;
    }

    this.setSetting('analyzed_messages_count', '360');

    const insertModel = this.db.prepare(`
      INSERT INTO connected_models (
        id, name, description, model, endpoint_url, runtime, provider, category,
        status, tokens, score, user_vote, latency_ms, e2ee_fingerprint, auth_token_encrypted,
        author, subreddit, domain, comments_count, created_at, date_label, last_ping_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedModels = [
      ['agent_coder', 'Codebase Invariant & Drift Refiner', 'Connected self-hosted vLLM reasoning node analyzing commit diffs, AST rules against .cursorrules, and architectural drift before PRs.', 'deepseek-r1-distill-32b', 'http://cluster.vllm.local:8000/v1', 'Self-Hosted vLLM', 'vLLM', 'Engineering', 'Active', 842, 342, null, 38, 'e2ee:9a4f...c12b', 'u/franklin_dev', 'r/engineering', 'cluster.vllm.local:8000', 28, '2025-05-25T15:30:00Z', 'May 25, 2025, 3:30 PM', 'Just now'],
      ['agent_email', 'Smart Email Triage & Voice Model', 'Connected Cloud Gemini Flash endpoint scanning incoming team threads, detecting intent, and drafting contextual replies aligned with CreativeProcess voice.', 'gemini-2.5-flash', 'https://generativelanguage.googleapis.com/v1beta', 'Cloud API', 'Gemini', 'Communication', 'Active', 156, 189, null, 64, 'e2ee:7b21...e804', 'u/sarah_pm', 'r/communication', 'generativelanguage.googleapis.com', 14, '2025-05-25T10:15:00Z', 'May 25, 2025, 10:15 AM', '2m ago'],
      ['agent_design', 'Figma Design Token Critic', 'Connected Anthropic Claude model auditing vector typography scales, contrast ratios, and single-elevation radius math across CreativeProcess boards.', 'claude-3-7-sonnet', 'https://api.anthropic.com/v1', 'Cloud API', 'Anthropic', 'Design', 'Active', 390, 147, null, 92, 'e2ee:3d19...a50c', 'u/alex_design', 'r/designsystems', 'api.anthropic.com', 19, '2025-05-24T18:20:00Z', 'May 24, 2025, 6:20 PM', '5m ago'],
      ['agent_voice', 'Live Meeting Diarizer & Summarizer', 'Connected real-time multimodal stream ingesting WebRTC audio chunks from standups and outputting action items directly into Jira.', 'gemini-2.5-pro-live', 'https://live.gemini.google.com/v1alpha', 'Cloud API', 'Gemini', 'Communication', 'Active', 615, 98, null, 54, 'e2ee:4c8e...19f2', 'u/marcus_lead', 'r/communication', 'live.gemini.google.com', 9, '2025-05-22T09:00:00Z', 'May 22, 2025, 9:00 AM', '1m ago'],
      ['agent_crawler', 'API & Docs Embedding Worker', 'Connected Kubernetes Qwen inference pod indexing SDK documentation, OpenAPI schemas, and changelogs into vector storage.', 'qwen2.5-coder:32b', 'http://qwen-worker.k8s.internal:8080/v1', 'Kubernetes Cluster', 'OpenAI-Compatible', 'Search', 'Idle', 120, 64, null, 22, 'e2ee:81f0...44d9', 'u/data_crawler', 'r/knowledgebase', 'qwen-worker.k8s.internal:8080', 6, '2025-05-25T17:00:00Z', 'May 25, 2025, 5:00 PM', '14m ago'],
      ['agent_docs', 'Local Workstation Qwen Assistant', 'Connected local Ollama model running on developer M-series GPU for zero-egress private runbook retrieval and offline prototyping.', 'qwen2.5:14b-instruct', 'http://localhost:11434/v1', 'Local Workstation', 'Ollama', 'Search', 'Idle', 520, 83, null, 14, 'e2ee:0f6a...7e11', 'u/franklin_dev', 'r/search', 'localhost:11434', 11, '2025-05-23T14:00:00Z', 'May 23, 2025, 2:00 PM', '22m ago'],
      ['agent_sql', 'PostgreSQL EXPLAIN Query Diagnostician', 'Connected DeepSeek Coder V2 endpoint inspecting pg_stat_statements, EXPLAIN ANALYZE traces, and missing composite indexes.', 'deepseek-coder-v2', 'http://deepseek.internal:9000/v1', 'Self-Hosted vLLM', 'DeepSeek', 'Engineering', 'Idle', 280, 41, null, 47, 'e2ee:5b92...d30a', 'u/db_admin', 'r/engineering', 'deepseek.internal:9000', 5, '2025-05-19T11:30:00Z', 'May 19, 2025, 11:30 AM', '40m ago'],
    ] as const;

    for (const m of seedModels) {
      insertModel.run(...m);
    }

    const insertJob = this.db.prepare(`
      INSERT INTO jobs (
        id, title, description, status, priority, assigned_type, assigned_to_id,
        assigned_to_name, assigned_to_role, category, estimated_tokens, consumed_tokens,
        progress_percent, created_at, deadline, payload_spec, output_summary, logs_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedJobs = [
      ['job_1', 'Audit Postgres EXPLAIN queries on checkout endpoint', 'Inspect pg_stat_statements for slow table scans, analyze index selectivity on order_items table, and prepare migration script.', 'queued', 'high', 'unassigned', null, null, null, 'Engineering', 380, 0, 0, 'May 25, 2025, 4:10 PM', 'Within 2 hours', 'Target database: postgresql://prod-cluster.internal:5432/core\nThreshold: queries > 120ms', null, JSON.stringify([{ timestamp: '4:10 PM', message: 'Job registered from automated SRE latency alert.', level: 'info' }, { timestamp: '4:12 PM', message: 'Queued in fleet backlog. Waiting for connected model assignment.', level: 'warn' }])],
      ['job_2', 'Synchronize Figma Design Variables into Tailwind 4 CSS config', 'Extract color hex palettes, typography scale tokens, and shadow elevations from creativeprocess.io canvas and generate zero-drift CSS variables.', 'in_progress', 'medium', 'agent', 'agent_design', 'Figma Design Token Critic', null, 'Design', 420, 260, 65, 'May 25, 2025, 2:30 PM', 'Today, 6:00 PM', 'Figma File ID: 9x8f0d_creativeprocess_v3\nTarget: src/index.css @theme block', null, JSON.stringify([{ timestamp: '2:30 PM', message: 'Job scheduled by design system CI pipeline.', level: 'info' }, { timestamp: '2:35 PM', message: 'Assigned to Figma Design Token Critic (claude-3-7-sonnet).', level: 'info' }])],
      ['job_3', 'Crawl Next.js 15 & Tailwind 4 docs for semantic index', 'Extract API changelog differences, breaking changes, and migration recipes into vector storage with sub-50ms query latency.', 'queued', 'medium', 'unassigned', null, null, null, 'Search', 550, 0, 0, 'May 25, 2025, 3:00 PM', 'Tomorrow, 9:00 AM', 'Sitemaps: https://nextjs.org/docs/sitemap.xml\nChunk size: 512 tokens', null, JSON.stringify([{ timestamp: '3:00 PM', message: 'Job created via documentation sync schedule.', level: 'info' }])],
      ['job_4', 'Validate AST invariant compliance on PR #249 (Zero Drift Check)', 'Run deep AST verification against .cursorrules across commit 8f912c. Verify no inline styles, verify single-elevation radius math.', 'in_progress', 'critical', 'agent', 'agent_coder', 'Codebase Invariant & Drift Refiner', null, 'Engineering', 842, 680, 85, 'May 25, 2025, 3:45 PM', 'Before Merge (Blocking)', 'PR #249: refactor/reddit-agent-feed\nRules: .cursorrules @section-anti-slop', null, JSON.stringify([{ timestamp: '3:45 PM', message: 'PR webhook triggered drift verification.', level: 'info' }, { timestamp: '3:50 PM', message: 'Zero styling drift detected. Running unit tests.', level: 'success' }])],
      ['job_5', 'Draft executive customer reply for enterprise SOC2 compliance review', 'Synthesize vendor security questionnaire, confirm E2E telemetry encryption invariants, and prepare signing pack for enterprise customer.', 'in_progress', 'high', 'user', 'user_franklin', 'Franklin Eugene', 'Lead Systems Engineer', 'Communication', 310, 120, 40, 'May 25, 2025, 11:15 AM', 'Today, 5:00 PM', 'Customer: FinTech Global Security Office\nArtifact: SOC2 Type II Telemetry Whitepaper', null, JSON.stringify([{ timestamp: '11:15 AM', message: 'Ticket escalated to Lead Systems Engineer.', level: 'info' }])],
      ['job_6', 'Weekly vLLM GPU cluster cost & utilization report', 'Aggregate inference request throughput, GPU temperature telemetry, and cost delta vs cloud API fallback routing.', 'completed', 'low', 'agent', 'agent_coder', 'Codebase Invariant & Drift Refiner', null, 'DataOps', 290, 290, 100, 'May 24, 2025, 8:00 AM', null, null, 'Report finalized: Local vLLM cluster absorbed 82% of load. $412 in cloud inference saved.', JSON.stringify([{ timestamp: '8:00 AM', message: 'Scheduled cron started.', level: 'info' }, { timestamp: '8:05 AM', message: 'Execution finished successfully. Artifact published.', level: 'success' }])],
    ] as const;

    for (const j of seedJobs) {
      insertJob.run(...j);
    }

    const insertAct = this.db.prepare(`
      INSERT INTO activities (id, date_label, title, snippet, model_tag, bg_color_class, text_color_class, tag_color_class, response, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAct.run('act_1', 'May 25, 2025', 'Marketing Trends 2025', "Hi NeuroNest, I've attached an article I'd like you to read. Can you give me an executive summary and 5 high-impact takeaways for the team...", 'Deepseek R1', 'bg-[#EBF2FC] dark:bg-[#1E2530]', 'text-slate-900 dark:text-slate-100', 'bg-blue-600 text-white', 'Executive Summary: Multi-model routing + local GPU nodes cut inference costs by 68%.', '2025-05-25T15:00:00Z');
    insertAct.run('act_2', 'May 25, 2025', 'Design System Tokens Sync', 'Hi NeuroNest, review the newly added header component and check for contrast compliance with WCAG AA and single-elevation card math...', 'Claude 3.7', 'bg-[#EAF5E4] dark:bg-[#1F2B1F]', 'text-slate-900 dark:text-slate-100', 'bg-emerald-600 text-white', 'Audit Complete: Contrast ratio is 6.2:1 against charcoal background.', '2025-05-25T12:00:00Z');
    insertAct.run('act_3', 'May 24, 2025', 'Weekly GPU Cost Allocation', 'Generate breakdown of vLLM node utilization on Kubernetes vs Gemini API cloud invocations for Q2 budget report...', 'Gemini 2.5 Flash', 'bg-[#FDF6D8] dark:bg-[#2B271A]', 'text-slate-900 dark:text-slate-100', 'bg-amber-600 text-white', 'Summary: On-premise GPU cluster absorbed 78% of inference load.', '2025-05-24T10:00:00Z');

    const insertSignal = this.db.prepare(`
      INSERT INTO friction_signals (id, kind, agent_id, agent_name, repository, message, timestamp, day_label, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const signals = [
      ['sig_1', 'correction', 'agent_coder', 'Codebase Invariant & Drift Refiner', 'creativeprocess/neuronest-web', 'No, do not use inline style={{}} props; always express spacing and colors with Tailwind CSS utility classes.', '2 hours ago', 'Today', '2025-05-25T14:00:00Z'],
      ['sig_2', 'correction', 'agent_coder', 'Codebase Invariant & Drift Refiner', 'creativeprocess/neuronest-web', 'You added an inline style attribute again on the card wrapper — use Tailwind utilities instead.', '1 day ago', 'May 24', '2025-05-24T14:00:00Z'],
      ['sig_3', 'correction', 'agent_design', 'Figma Design Token Critic', 'creativeprocess/ui-tokens', 'Stop writing raw CSS margin rules when bg- / p- / gap- Tailwind classes are configured.', '2 days ago', 'May 23', '2025-05-23T14:00:00Z'],
      ['sig_4', 'steering', 'agent_coder', 'Codebase Invariant & Drift Refiner', 'creativeprocess/neuronest-web', 'Remember to run tsc --noEmit and unit tests before claiming the refactor passes.', '3 hours ago', 'Today', '2025-05-25T13:00:00Z'],
      ['sig_5', 'steering', 'agent_docs', 'Local Workstation Qwen Assistant', 'creativeprocess/core-sdk', 'Always verify package exports with npm run build before editing downstream imports.', '3 days ago', 'May 22', '2025-05-22T12:00:00Z'],
      ['sig_6', 'steering', 'agent_sql', 'PostgreSQL EXPLAIN Query Diagnostician', 'creativeprocess/core-sdk', 'Check workspace root relative paths first rather than guessing module locations.', '4 days ago', 'May 21', '2025-05-21T12:00:00Z'],
      ['sig_7', 'frustration', 'agent_crawler', 'API & Docs Embedding Worker', 'creativeprocess/docs-indexer', 'Again?! You re-indexed localhost URLs into production vector embeddings without stripping dev ports.', '5 hours ago', 'Today', '2025-05-25T11:00:00Z'],
      ['sig_8', 'frustration', 'agent_sql', 'PostgreSQL EXPLAIN Query Diagnostician', 'creativeprocess/core-api', 'Do not propose DROP INDEX without checking concurrent read replicas first!', '6 days ago', 'May 19', '2025-05-19T11:00:00Z'],
      ['sig_9', 'correction', 'agent_email', 'Smart Email Triage & Voice Model', 'creativeprocess/ops-comms', 'Keep customer replies under 120 words and drop robotic phrasing.', '1 day ago', 'May 24', '2025-05-24T09:00:00Z'],
    ] as const;
    for (const s of signals) insertSignal.run(...s);

    const insertCluster = this.db.prepare(`
      INSERT INTO signal_clusters (id, title, kind, occurrences, conversation_count, target_file, model_names_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCluster.run('cl_1', 'Inline style overrides replacing Tailwind utilities', 'correction', 3, 3, '.cursorrules', JSON.stringify(['deepseek-r1-distill-32b', 'claude-3-7-sonnet']), 'ready');
    insertCluster.run('cl_2', 'Skipping typecheck & unit tests before reporting completion', 'steering', 3, 2, 'CLAUDE.md', JSON.stringify(['deepseek-r1-distill-32b', 'qwen2.5:14b-instruct']), 'ready');
    insertCluster.run('cl_3', 'Local dev ports leaking into production embeddings & SQL specs', 'frustration', 2, 2, 'AGENT_RULES.md', JSON.stringify(['qwen2.5-coder:32b', 'deepseek-coder-v2']), 'forming');

    const insertProposal = this.db.prepare(`
      INSERT INTO improvement_proposals (
        id, cluster_id, title, summary, model_id, model_name, repository,
        target_file, occurrences, conversations, kind, rule_snippet,
        diff_before, diff_after, status, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertProposal.run(
      'imp_1', 'cl_1',
      'Enforce Tailwind CSS utilities (zero inline style props)',
      'Recorded 3 corrections across 3 sessions where connected coding models fell back to inline style objects instead of Tailwind 4 tokens.',
      'agent_coder', 'Codebase Invariant & Drift Refiner', 'creativeprocess/neuronest-web',
      '.cursorrules', 3, 3, 'correction',
      '- Strictly use Tailwind CSS utility classes; never emit JSX style={{...}} attributes.',
      '# Styling Rules\n- Prefer Tailwind CSS classes when building UI components.',
      '# Styling Rules\n- Prefer Tailwind CSS classes when building UI components.\n+ Strictly use Tailwind CSS utility classes; never emit JSX style={{...}} attributes.',
      'pending', '2 hours ago'
    );
    insertProposal.run(
      'imp_2', 'cl_2',
      'Require build & test verification prior to final response',
      'Users steered connected models 3 times across 2 conversations to execute npx tsc --noEmit and unit tests before declaring work done.',
      'agent_docs', 'Local Workstation Qwen Assistant', 'creativeprocess/core-sdk',
      'CLAUDE.md', 3, 2, 'steering',
      '- Always run `npm run build` and `npm test` after final file edits before summarizing.',
      '## Verification\n- Inspect modified files before finishing.',
      '## Verification\n- Inspect modified files before finishing.\n+ Always run `npm run build` and `npm test` after final file edits before summarizing.',
      'pending', '3 hours ago'
    );

    const insertDaily = this.db.prepare(`
      INSERT INTO daily_signal_series (date_label, corrections_pct, steering_pct, frustration_pct, message_count, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const series = [
      ['Oct 13', 1.9, 1.4, 0.9, 68, 1],
      ['Oct 17', 1.7, 1.5, 0.8, 74, 2],
      ['Oct 21', 2.1, 1.3, 1.1, 82, 3],
      ['Oct 27', 1.5, 1.2, 0.7, 91, 4],
      ['Nov 03', 1.4, 1.1, 0.6, 88, 5],
      ['Nov 09', 1.2, 1.0, 0.5, 95, 6],
      ['Today', 1.0, 0.8, 0.4, 62, 7],
    ] as const;
    for (const d of series) insertDaily.run(...d);

    this.setSetting('initial_seed_v1', 'true');
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
    return rows.map(r => ({
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

export const TEAM_MEMBERS_STATIC: TeamMember[] = [
  {
    id: 'user_franklin',
    name: 'Franklin Eugene',
    email: 'eug.frank01@lain.com',
    role: 'Lead Systems Engineer',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  },
  {
    id: 'user_sarah',
    name: 'Sarah Chen',
    email: 'sarah.c@creativeprocess.io',
    role: 'Product Ops & Compliance',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
  },
  {
    id: 'user_alex',
    name: 'Alex Rivera',
    email: 'alex.r@creativeprocess.io',
    role: 'Design Systems Architect',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  },
  {
    id: 'user_marcus',
    name: 'Marcus Vance',
    email: 'marcus.v@creativeprocess.io',
    role: 'Infrastructure & SRE Lead',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
  },
];

export const WORKFLOWS_STATIC: WorkflowItem[] = [
  {
    id: 'wf_1',
    title: 'Customer Inquiry Multi-Model Router',
    description: 'Classify incoming ticket -> Retrieve knowledge embeddings -> Draft response with Gemini Flash -> Edge guardrail check',
    stepsCount: 4,
    lastRun: '10m ago',
    status: 'success',
  },
  {
    id: 'wf_2',
    title: 'Code Invariant & AST Lint Automation',
    description: 'Ingest Git commit diff -> Execute Python code sandbox -> Validate schema invariants -> Push commit note',
    stepsCount: 5,
    lastRun: '1h ago',
    status: 'success',
  },
  {
    id: 'wf_3',
    title: 'Figma Vector Tokens to Tailwind CSS',
    description: 'Pull Figma nodes API -> Parse color & typography tokens -> Generate Tailwind config -> Verify zero layout clipping',
    stepsCount: 3,
    lastRun: '4h ago',
    status: 'idle',
  },
];
