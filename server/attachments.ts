import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import type { NeuroDatabase } from './db.ts';

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_JOB = 10;
const MAX_TEXT_BYTES_PER_FILE = 40_000;
const MAX_TEXT_BYTES_TOTAL = 120_000;
/** Images sent inline to HTTP model APIs (base64) are capped to keep requests reasonable. */
const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;

const STORED_EXTENSIONS: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'application/pdf': 'pdf',
};

export type AttachmentKind = 'image' | 'video' | 'text' | 'file';

export interface Attachment {
  id: string;
  jobId: string | null;
  name: string;
  mime: string;
  size: number;
  kind: AttachmentKind;
  createdAt: string;
}

export interface AgentAttachment extends Attachment {
  filePath: string;
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'yaml', 'yml', 'xml', 'html', 'htm', 'css', 'log', 'ini', 'toml', 'env.example',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'sh', 'sql', 'graphql', 'vue', 'svelte',
]);

export function uploadsDir(): string {
  const dbPath = process.env.NEURONEST_DB_PATH?.trim();
  return path.join(dbPath ? path.dirname(path.resolve(dbPath)) : path.resolve('data'), 'uploads');
}

/** Identifies images and videos by their bytes so a renamed file can't pose as media. */
export function detectMedia(head: Buffer): { kind: 'image' | 'video'; mime: string } | null {
  const hex = head.subarray(0, 12).toString('hex');
  const ascii = head.subarray(0, 12).toString('latin1');
  if (hex.startsWith('89504e470d0a1a0a')) return { kind: 'image', mime: 'image/png' };
  if (hex.startsWith('ffd8ff')) return { kind: 'image', mime: 'image/jpeg' };
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return { kind: 'image', mime: 'image/gif' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return { kind: 'image', mime: 'image/webp' };
  if (hex.startsWith('1a45dfa3')) return { kind: 'video', mime: 'video/webm' };
  if (ascii.slice(4, 8) === 'ftyp') {
    const brand = ascii.slice(8, 12);
    return { kind: 'video', mime: brand === 'qt  ' ? 'video/quicktime' : 'video/mp4' };
  }
  return null;
}

function looksLikeText(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

export function safeFileName(raw: string): string {
  const base = path.basename(raw.replace(/\\/g, '/')).normalize('NFC');
  const cleaned = base.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').replace(/^\.+/, '').trim().slice(0, 160);
  return cleaned || 'file';
}

function extensionOf(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.env.example')) return 'env.example';
  return lower.includes('.') ? lower.split('.').pop()! : '';
}

function classify(name: string, head: Buffer, sample: Buffer): { kind: AttachmentKind; mime: string } {
  const media = detectMedia(head);
  if (media) return media;
  if (extensionOf(name) === 'pdf' && head.subarray(0, 5).toString('latin1') === '%PDF-') return { kind: 'file', mime: 'application/pdf' };
  if ((TEXT_EXTENSIONS.has(extensionOf(name)) || !extensionOf(name)) && looksLikeText(sample)) return { kind: 'text', mime: 'text/plain' };
  return { kind: 'file', mime: 'application/octet-stream' };
}

type Row = { id: string; job_id: string | null; name: string; mime: string; size: number; kind: AttachmentKind; file_path: string; created_at: string };

const toAttachment = (r: Row): Attachment => ({ id: r.id, jobId: r.job_id, name: r.name, mime: r.mime, size: Number(r.size), kind: r.kind, createdAt: r.created_at });

export function ensureAttachmentSchema(db: NeuroDatabase) {
  db.db.exec(`
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
    CREATE INDEX IF NOT EXISTS attachments_job ON attachments(job_id);
  `);
}

export function listJobAttachments(db: NeuroDatabase, jobId: string): AgentAttachment[] {
  const rows = db.db.prepare('SELECT * FROM attachments WHERE job_id = ? ORDER BY created_at').all(jobId) as unknown as Row[];
  return rows.map(r => ({ ...toAttachment(r), filePath: r.file_path }));
}

export function attachmentsByJob(db: NeuroDatabase): Map<string, Attachment[]> {
  const rows = db.db.prepare('SELECT * FROM attachments WHERE job_id IS NOT NULL ORDER BY created_at').all() as unknown as Row[];
  const byJob = new Map<string, Attachment[]>();
  for (const row of rows) {
    const list = byJob.get(row.job_id!) ?? [];
    list.push(toAttachment(row));
    byJob.set(row.job_id!, list);
  }
  return byJob;
}

/** Links uploaded, not-yet-used attachments to a new job. Returns how many were linked. */
export function linkAttachments(db: NeuroDatabase, jobId: string, ids: unknown): number {
  if (!Array.isArray(ids) || !ids.length) return 0;
  const unique = [...new Set(ids.filter((id): id is string => typeof id === 'string'))].slice(0, MAX_ATTACHMENTS_PER_JOB);
  const link = db.db.prepare('UPDATE attachments SET job_id = ? WHERE id = ? AND job_id IS NULL');
  return unique.reduce((count, id) => count + Number(link.run(jobId, id).changes), 0);
}

export function deleteJobAttachments(db: NeuroDatabase, jobId: string) {
  for (const a of listJobAttachments(db, jobId)) fs.rmSync(path.dirname(a.filePath), { recursive: true, force: true });
  db.db.prepare('DELETE FROM attachments WHERE job_id = ?').run(jobId);
}

/** Removes uploads that were never attached to a job (abandoned drafts). */
export function pruneOrphanUploads(db: NeuroDatabase, olderThanMs = 24 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const rows = db.db.prepare('SELECT * FROM attachments WHERE job_id IS NULL AND created_at < ?').all(cutoff) as unknown as Row[];
  for (const r of rows) fs.rmSync(path.dirname(r.file_path), { recursive: true, force: true });
  db.db.prepare('DELETE FROM attachments WHERE job_id IS NULL AND created_at < ?').run(cutoff);
}

async function receiveUpload(req: Request, db: NeuroDatabase): Promise<Attachment> {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > MAX_ATTACHMENT_BYTES) throw Object.assign(new Error('Files can be up to 25 MB.'), { status: 413 });
  const rawName = typeof req.headers['x-file-name'] === 'string' ? decodeURIComponent(req.headers['x-file-name']) : 'file';
  const name = safeFileName(rawName);
  const id = `att_${randomUUID()}`;
  const dir = path.join(uploadsDir(), id);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const filePath = path.join(dir, 'blob');

  let size = 0;
  const sampleChunks: Buffer[] = [];
  let sampled = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(filePath, { mode: 0o600 });
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_ATTACHMENT_BYTES) {
          req.unpipe(out);
          out.destroy();
          req.resume();
          reject(Object.assign(new Error('Files can be up to 25 MB.'), { status: 413 }));
          return;
        }
        if (sampled < 64 * 1024) { sampleChunks.push(chunk); sampled += chunk.length; }
      });
      req.on('aborted', () => reject(new Error('Upload cancelled.')));
      out.on('error', reject);
      out.on('finish', resolve);
      req.pipe(out);
    });
    if (!size) throw Object.assign(new Error('The file is empty.'), { status: 400 });
    const sample = Buffer.concat(sampleChunks).subarray(0, 64 * 1024);
    // A sample cut mid-character is still text; trim to the last full line for the check.
    const textSample = sample.length === 64 * 1024 ? sample.subarray(0, Math.max(0, sample.lastIndexOf(10))) : sample;
    const { kind, mime } = classify(name, sample, textSample);
    // Name the stored file by its real type; tools like Codex infer image types from the extension.
    const storedPath = path.join(dir, `blob.${STORED_EXTENSIONS[mime] ?? (kind === 'text' ? 'txt' : 'bin')}`);
    fs.renameSync(filePath, storedPath);
    const createdAt = new Date().toISOString();
    db.db.prepare('INSERT INTO attachments (id, job_id, name, mime, size, kind, file_path, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)')
      .run(id, name, mime, size, kind, storedPath, createdAt);
    return { id, jobId: null, name, mime, size, kind, createdAt };
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

export function registerAttachmentRoutes(app: Express, db: NeuroDatabase) {
  ensureAttachmentSchema(db);
  pruneOrphanUploads(db);
  setInterval(() => pruneOrphanUploads(db), 6 * 60 * 60 * 1000).unref();

  app.post('/api/uploads', async (req: Request, res: Response) => {
    try {
      res.status(201).json({ attachment: await receiveUpload(req, db) });
    } catch (error) {
      const status = (error as { status?: number }).status ?? 400;
      if (!res.headersSent) res.status(status).json({ error: error instanceof Error ? error.message : 'Upload failed.' });
    }
  });

  app.get('/api/uploads/:id', (req: Request, res: Response) => {
    const row = db.db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id) as unknown as Row | undefined;
    if (!row || !fs.existsSync(row.file_path)) { res.status(404).json({ error: 'File not found.' }); return; }
    const media = row.kind === 'image' || row.kind === 'video';
    res.set({
      'Content-Type': media ? row.mime : row.kind === 'text' ? 'text/plain; charset=utf-8' : 'application/octet-stream',
      'Content-Disposition': `${media && req.query.download === undefined ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, max-age=3600',
    });
    res.sendFile(row.file_path); // keeps the Content-Type set above
  });

  app.delete('/api/uploads/:id', (req: Request, res: Response) => {
    const row = db.db.prepare('SELECT * FROM attachments WHERE id = ? AND job_id IS NULL').get(req.params.id) as unknown as Row | undefined;
    if (row) {
      fs.rmSync(path.dirname(row.file_path), { recursive: true, force: true });
      db.db.prepare('DELETE FROM attachments WHERE id = ?').run(row.id);
    }
    res.json({ ok: true });
  });
}

export interface PreparedAttachments {
  /** Text appended to the prompt: inlined text files and notes about the rest. */
  promptAppendix: string;
  /** Images the model can look at. `data` is base64 for HTTP APIs; CLI agents use `filePath`. */
  images: { name: string; mime: string; filePath: string; data?: string }[];
}

/** Turns a job's attachments into prompt text and images for the agent. */
export function prepareAttachments(attachments: AgentAttachment[], opts: { inlineImages: boolean; readableDir?: string }): PreparedAttachments {
  // Agents that can open files themselves (Claude Code) get images and PDFs copied into their folder.
  if (opts.readableDir) {
    const dir = path.join(opts.readableDir, 'attachments');
    fs.mkdirSync(dir, { recursive: true });
    const used = new Set<string>();
    const notes: string[] = [];
    let textBudget = MAX_TEXT_BYTES_TOTAL;
    for (const a of attachments) {
      if (!fs.existsSync(a.filePath)) continue;
      if (a.kind === 'image' || a.mime === 'application/pdf' || a.kind === 'text') {
        let name = a.name;
        for (let i = 2; used.has(name.toLowerCase()); i++) name = a.name.replace(/(\.[^.]*)?$/, ` (${i})$1`);
        used.add(name.toLowerCase());
        fs.copyFileSync(a.filePath, path.join(dir, name));
        if (a.kind === 'text' && textBudget > 0) {
          const take = Math.min(MAX_TEXT_BYTES_PER_FILE, textBudget);
          textBudget -= take;
          notes.push(`- File "attachments/${name}" (text${a.size > take ? `, ${Math.round(a.size / 1000)} KB` : ''}).`);
        } else {
          notes.push(`- ${a.kind === 'image' ? 'Image' : 'PDF'} "attachments/${name}".`);
        }
      } else if (a.kind === 'video') {
        notes.push(`- Video "${a.name}" (${Math.round(a.size / 1e6)} MB): you can't watch videos, so rely on the user's description.`);
      } else {
        notes.push(`- File "${a.name}" (binary, ${Math.max(1, Math.round(a.size / 1000))} KB): you can't open it.`);
      }
    }
    return {
      promptAppendix: notes.length ? `\n\nAttachments from the user (in your working folder; open them with the Read tool):\n${notes.join('\n')}` : '',
      images: [],
    };
  }

  const notes: string[] = [];
  const images: PreparedAttachments['images'] = [];
  let textBudget = MAX_TEXT_BYTES_TOTAL;
  for (const a of attachments) {
    if (!fs.existsSync(a.filePath)) continue;
    if (a.kind === 'image') {
      if (opts.inlineImages && a.size > MAX_INLINE_IMAGE_BYTES) {
        notes.push(`- Image "${a.name}" is too large to send to this agent (over 5 MB).`);
        continue;
      }
      images.push({ name: a.name, mime: a.mime, filePath: a.filePath, data: opts.inlineImages ? fs.readFileSync(a.filePath).toString('base64') : undefined });
      notes.push(`- Image "${a.name}" (attached).`);
    } else if (a.kind === 'text' && textBudget > 0) {
      const take = Math.min(MAX_TEXT_BYTES_PER_FILE, textBudget);
      const content = fs.readFileSync(a.filePath).subarray(0, take).toString('utf8');
      textBudget -= take;
      const cut = a.size > take ? `\n[…truncated: showing the first ${Math.round(take / 1000)} KB of ${Math.round(a.size / 1000)} KB]` : '';
      notes.push(`- File "${a.name}":\n\`\`\`\`\n${content}${cut}\n\`\`\`\``);
    } else if (a.kind === 'video') {
      notes.push(`- Video "${a.name}" (${Math.round(a.size / 1e6)} MB): this agent can't watch videos, so rely on the user's description.`);
    } else {
      notes.push(`- File "${a.name}" (${a.mime === 'application/pdf' ? 'PDF' : 'binary'}, ${Math.max(1, Math.round(a.size / 1000))} KB): this agent can't open it.`);
    }
  }
  return { promptAppendix: notes.length ? `\n\nAttachments from the user:\n${notes.join('\n')}` : '', images };
}
