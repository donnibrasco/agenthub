import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export const ADMIN_USERNAME = 'admin';
export const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function derivePassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await derivePassword(password, salt);
  return `${salt}:${key.toString('hex')}`;
}

export async function matchPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  return timingSafeEqual(await derivePassword(password, salt), Buffer.from(key, 'hex'));
}

export class AuthStore {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
    database.exec(`
      CREATE TABLE IF NOT EXISTS admin_credentials (
        username TEXT PRIMARY KEY CHECK (username = 'admin'),
        password_hash TEXT NOT NULL,
        setup_code_hash TEXT
      );
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
      );
    `);
    // Sessions issued under the old setup flow never had dashboard access.
    database.exec(`
      BEGIN IMMEDIATE;
      DELETE FROM admin_sessions WHERE EXISTS (
        SELECT 1 FROM admin_credentials WHERE setup_code_hash IS NOT NULL
      );
      UPDATE admin_credentials SET setup_code_hash = NULL WHERE setup_code_hash IS NOT NULL;
      COMMIT;
    `);
  }

  async createAdmin(password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    this.database.prepare(`
      INSERT INTO admin_credentials (username, password_hash) VALUES (?, ?)
    `).run(ADMIN_USERNAME, passwordHash);
  }

  getAdmin() {
    return this.database.prepare('SELECT password_hash FROM admin_credentials WHERE username = ?')
      .get(ADMIN_USERNAME) as { password_hash: string } | undefined;
  }

  createSession() {
    const token = randomBytes(32).toString('hex');
    this.database.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(Date.now());
    this.database.prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)')
      .run(digest(token), Date.now() + SESSION_LIFETIME_MS);
    return token;
  }

  getSession(token: string | undefined) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return undefined;
    const tokenHash = digest(token);
    const session = this.database.prepare('SELECT 1 FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
      .get(tokenHash, Date.now());
    return session ? { tokenHash } : undefined;
  }

  deleteSession(tokenHash: string) {
    this.database.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
  }
}
