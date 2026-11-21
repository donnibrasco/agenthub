import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import type { Express, NextFunction, Request, Response } from 'express';
import type { NeuroDatabase } from './db.ts';

/**
 * Computers that run Codex / Claude Code for AgentHub. A small connector on the computer
 * polls this server for work, runs the CLI locally with the person's own sign-in, and streams
 * the output back. The server only ever sends structured requests; the connector builds the commands.
 */

export type Harness = 'codex' | 'claude';
export type DeviceAction = 'install' | 'update' | 'login' | 'check';

export interface HarnessReport {
  installed: boolean;
  version?: string;
  latest?: string;
  signedIn?: boolean;
  detail?: string;
}

export interface DeviceReport {
  hostname?: string;
  platform?: string;
  connectorVersion?: string;
  node?: string;
  harnesses?: Partial<Record<Harness, HarnessReport>>;
  activity?: string;
}

export interface Device {
  id: string;
  name: string;
  platform: string;
  connectorVersion: string;
  createdAt: string;
  lastSeenAt: string | null;
  online: boolean;
  paired: boolean;
  report: DeviceReport;
}

interface Command {
  id: string;
  deviceId: string;
  type: 'run' | DeviceAction | 'cancel';
  payload: Record<string, unknown>;
  createdAt: number;
  onOutput?: (chunk: string) => void;
  resolve?: (result: CommandResult) => void;
  timer?: NodeJS.Timeout;
  delivered: boolean;
}

export interface CommandResult {
  exitCode: number | null;
  error?: string;
  stderr?: string;
}

const POLL_WAIT_MS = 25_000;
const ONLINE_WINDOW_MS = 45_000;
const RUN_TIMEOUT_MS = 11 * 60_000;
export const CONNECTOR_VERSION = '1.0.0';

type Row = { id: string; name: string; platform: string; key_hash: string; created_at: string; last_seen_at: string | null; connector_version: string; report_json: string };

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

export class DeviceHub {
  private queues = new Map<string, Command[]>();
  private waiters = new Map<string, Response>();
  private commands = new Map<string, Command>();
  private db: NeuroDatabase;

  constructor(db: NeuroDatabase) {
    this.db = db;
    db.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT '',
        key_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT,
        connector_version TEXT NOT NULL DEFAULT '',
        report_json TEXT NOT NULL DEFAULT '{}'
      );
    `);
  }

  private row(id: string) {
    return this.db.db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as unknown as Row | undefined;
  }

  private toDevice(r: Row): Device {
    const lastSeen = r.last_seen_at ? Date.parse(r.last_seen_at) : 0;
    let report: DeviceReport = {};
    try { report = JSON.parse(r.report_json || '{}'); } catch { /* keep empty */ }
    return {
      id: r.id, name: r.name, platform: r.platform, connectorVersion: r.connector_version, createdAt: r.created_at,
      lastSeenAt: r.last_seen_at, paired: Boolean(r.last_seen_at),
      online: this.waiters.has(r.id) || Date.now() - lastSeen < ONLINE_WINDOW_MS,
      report,
    };
  }

  list(): Device[] {
    const rows = this.db.db.prepare('SELECT * FROM devices ORDER BY created_at').all() as unknown as Row[];
    return rows.map(r => this.toDevice(r));
  }

  get(id: string): Device | undefined {
    const r = this.row(id);
    return r ? this.toDevice(r) : undefined;
  }

  /** A new computer slot and its one-time key (only the hash is stored). */
  pair(): { deviceId: string; key: string } {
    const deviceId = `dev_${randomUUID()}`;
    const key = `ahc_${randomBytes(32).toString('base64url')}`;
    this.db.db.prepare('INSERT INTO devices (id, name, key_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(deviceId, 'New computer', hashKey(key), new Date().toISOString());
    return { deviceId, key };
  }

  remove(id: string) {
    this.db.db.prepare('DELETE FROM devices WHERE id = ?').run(id);
    this.waiters.get(id)?.status(401).json({ error: 'This computer was removed from AgentHub.' });
    this.waiters.delete(id);
    for (const cmd of this.queues.get(id) ?? []) this.settle(cmd.id, { exitCode: null, error: 'This computer was removed.' });
    this.queues.delete(id);
  }

  /** Resolves the device for a connector request, or null. */
  authenticate(header: string | undefined): Row | null {
    const key = header?.match(/^Bearer\s+(ahc_[A-Za-z0-9_-]{20,})$/)?.[1];
    if (!key) return null;
    const hash = hashKey(key);
    const row = this.db.db.prepare('SELECT * FROM devices WHERE key_hash = ?').get(hash) as unknown as Row | undefined;
    if (!row || !timingSafeEqual(Buffer.from(row.key_hash), Buffer.from(hash))) return null;
    return row;
  }

  touch(id: string) {
    this.db.db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  }

  saveReport(id: string, report: DeviceReport) {
    const name = typeof report.hostname === 'string' && report.hostname.trim() ? report.hostname.trim().slice(0, 80) : undefined;
    this.db.db.prepare(`UPDATE devices SET report_json = ?, platform = ?, connector_version = ?, last_seen_at = ?${name ? ', name = ?' : ''} WHERE id = ?`)
      .run(JSON.stringify(report).slice(0, 20_000), String(report.platform || '').slice(0, 40), String(report.connectorVersion || '').slice(0, 20),
        new Date().toISOString(), ...(name ? [name] : []), id);
  }

  /** Queues work for a computer. Resolves when the connector reports it finished. */
  send(deviceId: string, type: Command['type'], payload: Record<string, unknown>, opts: { onOutput?: (chunk: string) => void; timeoutMs?: number; signal?: AbortSignal } = {}): { id: string; done: Promise<CommandResult> } {
    const id = `cmd_${randomUUID()}`;
    const done = new Promise<CommandResult>(resolve => {
      const cmd: Command = { id, deviceId, type, payload, createdAt: Date.now(), onOutput: opts.onOutput, resolve, delivered: false };
      cmd.timer = setTimeout(() => {
        this.settle(id, { exitCode: null, error: cmd.delivered ? 'Timed out waiting for your computer.' : 'Your computer did not pick up the job. Check that the AgentHub connector is running.' });
        if (cmd.delivered && type === 'run') this.send(deviceId, 'cancel', { commandId: id });
      }, opts.timeoutMs ?? RUN_TIMEOUT_MS);
      opts.signal?.addEventListener('abort', () => {
        this.settle(id, { exitCode: null, error: 'Cancelled' });
        if (cmd.delivered) this.send(deviceId, 'cancel', { commandId: id });
      }, { once: true });
      this.commands.set(id, cmd);
      const queue = this.queues.get(deviceId) ?? [];
      queue.push(cmd);
      this.queues.set(deviceId, queue);
    });
    this.flush(deviceId);
    return { id, done };
  }

  private settle(id: string, result: CommandResult) {
    const cmd = this.commands.get(id);
    if (!cmd) return;
    clearTimeout(cmd.timer);
    this.commands.delete(id);
    const queue = this.queues.get(cmd.deviceId);
    if (queue) this.queues.set(cmd.deviceId, queue.filter(c => c.id !== id));
    cmd.resolve?.(result);
  }

  private flush(deviceId: string) {
    const res = this.waiters.get(deviceId);
    const next = this.queues.get(deviceId)?.find(c => !c.delivered);
    if (!res || !next) return;
    this.waiters.delete(deviceId);
    next.delivered = true;
    // Actions that do not report back (cancel) are done once delivered.
    if (next.type === 'cancel') this.settle(next.id, { exitCode: 0 });
    res.json({ command: { id: next.id, type: next.type, payload: next.payload } });
  }

  commandFor(deviceId: string, commandId: string) {
    const cmd = this.commands.get(commandId);
    return cmd && cmd.deviceId === deviceId ? cmd : undefined;
  }

  registerRoutes(app: Express) {
    const device = (req: Request, res: Response, next: NextFunction) => {
      const row = this.authenticate(req.headers.authorization);
      if (!row) { res.status(401).json({ error: 'This computer is not connected to AgentHub. Add it again from Connections.' }); return; }
      (req as Request & { deviceId: string }).deviceId = row.id;
      this.touch(row.id);
      next();
    };
    const deviceId = (req: Request) => (req as Request & { deviceId: string }).deviceId;

    app.post('/api/connector/report', device, (req, res) => {
      this.saveReport(deviceId(req), (req.body ?? {}) as DeviceReport);
      res.json({ ok: true, serverConnectorVersion: CONNECTOR_VERSION });
    });

    app.get('/api/connector/poll', device, (req, res) => {
      const id = deviceId(req);
      this.waiters.get(id)?.status(204).end();
      this.waiters.set(id, res);
      const timer = setTimeout(() => {
        if (this.waiters.get(id) === res) { this.waiters.delete(id); res.status(204).end(); }
      }, POLL_WAIT_MS);
      res.on('close', () => { clearTimeout(timer); if (this.waiters.get(id) === res) this.waiters.delete(id); });
      this.flush(id);
    });

    app.post('/api/connector/commands/:id/output', device, (req, res) => {
      const cmd = this.commandFor(deviceId(req), req.params.id);
      if (cmd && typeof req.body?.chunk === 'string') cmd.onOutput?.(req.body.chunk);
      res.json({ ok: Boolean(cmd) });
    });

    app.post('/api/connector/commands/:id/done', device, (req, res) => {
      const cmd = this.commandFor(deviceId(req), req.params.id);
      if (cmd) {
        this.settle(cmd.id, {
          exitCode: typeof req.body?.exitCode === 'number' ? req.body.exitCode : null,
          error: typeof req.body?.error === 'string' ? req.body.error.slice(0, 2000) : undefined,
          stderr: typeof req.body?.stderr === 'string' ? req.body.stderr.slice(-4000) : undefined,
        });
      }
      res.json({ ok: Boolean(cmd) });
    });

    // Attachments for a running job, only to the computer running it.
    app.get('/api/connector/commands/:id/files/:fileId', device, (req, res) => {
      const cmd = this.commandFor(deviceId(req), req.params.id);
      const files = (cmd?.payload.files ?? []) as { id: string; filePath?: string }[];
      const file = files.find(f => f.id === req.params.fileId);
      const row = file && this.db.db.prepare('SELECT file_path FROM attachments WHERE id = ?').get(file.id) as { file_path: string } | undefined;
      if (!row || !fs.existsSync(row.file_path)) { res.status(404).json({ error: 'File not found.' }); return; }
      res.set('Content-Type', 'application/octet-stream');
      res.sendFile(row.file_path);
    });

    // ── Browser (signed-in) routes ──
    app.get('/api/devices', (_req, res) => { res.json({ devices: this.list() }); });
    app.post('/api/devices', (_req, res) => { res.status(201).json(this.pair()); });
    app.delete('/api/devices/:id', (req, res) => {
      if (!this.row(req.params.id)) { res.status(404).json({ error: 'Computer not found.' }); return; }
      this.remove(req.params.id);
      res.json({ ok: true });
    });
    app.post('/api/devices/:id/actions', (req, res) => {
      const action = req.body?.action as DeviceAction;
      const harness = req.body?.harness as Harness | undefined;
      if (!['install', 'update', 'login', 'check'].includes(action) || (action !== 'check' && harness !== 'codex' && harness !== 'claude')) {
        res.status(400).json({ error: 'Unknown action.' });
        return;
      }
      const dev = this.get(req.params.id);
      if (!dev) { res.status(404).json({ error: 'Computer not found.' }); return; }
      if (!dev.online) { res.status(409).json({ error: `${dev.name} is offline. Start the AgentHub connector on it first.` }); return; }
      this.send(dev.id, action, harness ? { harness } : {}, { timeoutMs: 15 * 60_000 });
      res.status(202).json({ ok: true });
    });
  }
}
