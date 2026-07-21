import * as crypto from 'crypto';

const KDF_ITERATIONS = 310_000;
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;

export interface PasswordEncryptedPayload {
  v: 1;
  alg: 'aes-256-gcm';
  kdf: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

/** Encrypt plaintext with a password (PBKDF2 + AES-256-GCM). Server stores only this payload. */
export function encryptWithPassword(plaintext: string, password: string): PasswordEncryptedPayload {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = crypto.pbkdf2Sync(password, salt, KDF_ITERATIONS, KEY_LEN, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: 'aes-256-gcm',
    kdf: 'pbkdf2-sha256',
    iterations: KDF_ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

/** Server-side decrypt for verification/tests only — production recipients decrypt in the browser. */
export function decryptWithPassword(payload: PasswordEncryptedPayload, password: string): string {
  const key = crypto.pbkdf2Sync(
    password,
    Buffer.from(payload.salt, 'base64'),
    payload.iterations,
    KEY_LEN,
    'sha256',
  );
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function serializePayload(payload: PasswordEncryptedPayload): string {
  return JSON.stringify(payload);
}

export function parsePayload(raw: string): PasswordEncryptedPayload {
  const parsed = JSON.parse(raw) as PasswordEncryptedPayload;
  if (parsed.v !== 1 || parsed.alg !== 'aes-256-gcm' || !parsed.ciphertext) {
    throw new Error('Invalid encrypted payload');
  }
  return parsed;
}
