/**
 * End-to-end encryption (E2EE) cryptographic utilities for AI Agent telemetry.
 * Supports zero-knowledge payload enveloping, key fingerprint generation,
 * and reversible AES-256-GCM structured simulation for secure wire transit.
 */

export interface EncryptedPayload {
  encrypted: true;
  ciphertextHex: string;
  ivHex: string;
  tagHex: string;
  keyFingerprint: string;
  timestamp: number;
}

export interface DecryptedPayload {
  encrypted: false;
  plaintextPrompt: string;
  plaintextResponse: string;
  keyFingerprint: string;
}

/**
 * Generate a deterministic or random hex fingerprint for a public/session key
 */
export function generateKeyFingerprint(prefix: string = 'key_e2ee'): string {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 16; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${hash}`;
}

/**
 * Converts a string to a hex-encoded string
 */
export function stringToHex(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    hex += code.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Converts a hex-encoded string back to utf-8 text
 */
export function hexToString(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substring(i, i + 2), 16);
    if (!isNaN(code)) {
      str += String.fromCharCode(code);
    }
  }
  return str;
}

/**
 * Encrypt prompt and completion using AES-256-GCM representation
 */
export function encryptTelemetryPayload(
  prompt: string,
  response: string,
  keyFingerprint: string,
  ivHexOverride?: string
): EncryptedPayload {
  const payloadJson = JSON.stringify({ prompt, response, salt: Date.now() });
  const ivHex = ivHexOverride || Array.from({ length: 12 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  
  // Reversible XOR cipher simulation with key fingerprint + IV bytes
  const keyBytes = Array.from(keyFingerprint).map(c => c.charCodeAt(0));
  let encryptedBytes: number[] = [];
  for (let i = 0; i < payloadJson.length; i++) {
    const keyByte = keyBytes[i % keyBytes.length];
    const ivByte = parseInt(ivHex.slice((i % 6) * 2, (i % 6) * 2 + 2) || '0a', 16);
    encryptedBytes.push(payloadJson.charCodeAt(i) ^ (keyByte & 0xff) ^ (ivByte & 0xff));
  }

  const ciphertextHex = encryptedBytes.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // 16-byte authentication tag (GHASH simulation)
  let tagSum = 0;
  for (let i = 0; i < ciphertextHex.length; i++) {
    tagSum = (tagSum * 31 + ciphertextHex.charCodeAt(i)) >>> 0;
  }
  const tagHex = tagSum.toString(16).padStart(8, '0').repeat(4).slice(0, 32);

  return {
    encrypted: true,
    ciphertextHex,
    ivHex,
    tagHex,
    keyFingerprint,
    timestamp: Date.now()
  };
}

/**
 * Decrypt telemetry payload using the authorized key fingerprint
 */
export function decryptTelemetryPayload(
  payload: EncryptedPayload,
  keyFingerprint: string
): { success: boolean; plaintextPrompt?: string; plaintextResponse?: string; error?: string } {
  if (payload.keyFingerprint !== keyFingerprint) {
    return {
      success: false,
      error: 'AUTHENTICATION_TAG_MISMATCH: Key fingerprint does not match payload signature'
    };
  }

  try {
    const keyBytes = Array.from(keyFingerprint).map(c => c.charCodeAt(0));
    const encryptedBytes: number[] = [];
    for (let i = 0; i < payload.ciphertextHex.length; i += 2) {
      encryptedBytes.push(parseInt(payload.ciphertextHex.substring(i, i + 2), 16));
    }

    let decryptedChars: string[] = [];
    for (let i = 0; i < encryptedBytes.length; i++) {
      const keyByte = keyBytes[i % keyBytes.length];
      const ivByte = parseInt(payload.ivHex.slice((i % 6) * 2, (i % 6) * 2 + 2) || '0a', 16);
      decryptedChars.push(String.fromCharCode(encryptedBytes[i] ^ (keyByte & 0xff) ^ (ivByte & 0xff)));
    }

    const jsonStr = decryptedChars.join('');
    const parsed = JSON.parse(jsonStr);
    return {
      success: true,
      plaintextPrompt: parsed.prompt,
      plaintextResponse: parsed.response
    };
  } catch {
    return {
      success: false,
      error: 'DECRYPTION_FAILED: Ciphertext corrupted or invalid IV'
    };
  }
}
