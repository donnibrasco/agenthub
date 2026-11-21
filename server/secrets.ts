import crypto from 'node:crypto';

function deriveAesKey(secretSeed: string): Buffer {
  return crypto.createHash('sha256').update(secretSeed || 'neuronest-local-workspace-key').digest();
}

export function encryptSecretToken(plain: string, secretSeed: string): string {
  const trimmed = plain.trim();
  if (!trimmed) return '';
  const iv = crypto.randomBytes(12);
  const key = deriveAesKey(secretSeed);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecretToken(encoded: string, secretSeed: string): string {
  if (!encoded) return '';
  const parts = encoded.split(':');
  if (parts.length !== 3) return '';
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const ciphertext = Buffer.from(parts[2], 'hex');
    const key = deriveAesKey(secretSeed);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}
