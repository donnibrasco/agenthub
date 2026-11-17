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
  }

  async createAdmin(password: string, setupCode: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    this.database.prepare(`
      INSERT INTO admin_credentials (username, password_hash, setup_code_hash) VALUES (?, ?, ?)
    `).run(ADMIN_USERNAME, passwordHash, digest(setupCode));
  }

  getAdmin() {
    return this.database.prepare('SELECT password_hash, setup_code_hash FROM admin_credentials WHERE username = ?')
      .get(ADMIN_USERNAME) as { password_hash: string; setup_code_hash: string | null } | undefined;
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
    const admin = session && this.getAdmin();
    return admin ? { tokenHash, setupRequired: admin.setup_code_hash !== null } : undefined;
  }

  deleteSession(tokenHash: string) {
    this.database.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
  }

  async finishSetup(password: string, setupCode: string, token: string): Promise<string | undefined> {
    const setupCodeHash = this.getAdmin()?.setup_code_hash;
    if (!setupCodeHash || !timingSafeEqual(Buffer.from(digest(setupCode)), Buffer.from(setupCodeHash))) return;

    const passwordHash = await hashPassword(password);
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const session = this.getSession(token);
      if (!session?.setupRequired) {
        this.database.exec('ROLLBACK');
        return;
      }
      this.database.prepare(`
        UPDATE admin_credentials SET password_hash = ?, setup_code_hash = NULL WHERE username = ?
      `).run(passwordHash, ADMIN_USERNAME);
      this.database.exec('DELETE FROM admin_sessions');
      const newToken = this.createSession();
      this.database.exec('COMMIT');
      return newToken;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}
