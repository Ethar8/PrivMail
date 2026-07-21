/**
 * Client-side decryption for password-protected external messages.
 * Uses Web Crypto PBKDF2 + AES-GCM — plaintext never leaves the browser.
 */

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

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

export function parseEncryptedPayload(raw: string): PasswordEncryptedPayload {
  const parsed = JSON.parse(raw) as PasswordEncryptedPayload;
  if (parsed.v !== 1 || parsed.alg !== 'aes-256-gcm') {
    throw new Error('Ungültiges Verschlüsselungsformat');
  }
  return parsed;
}

export async function decryptPayloadInBrowser(
  payload: PasswordEncryptedPayload,
  password: string,
): Promise<string> {
  const key = await deriveKey(password, b64ToBytes(payload.salt), payload.iterations);
  const ciphertext = b64ToBytes(payload.ciphertext);
  const tag = b64ToBytes(payload.tag);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(payload.iv) },
      key,
      combined,
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('Entschlüsselung fehlgeschlagen – Passwort prüfen');
  }
}

export async function decryptExternalMessage(
  encryptedBodyJson: string,
  password: string,
  encryptedSubjectJson?: string | null,
): Promise<{ body: string; subject: string | null }> {
  const body = await decryptPayloadInBrowser(parseEncryptedPayload(encryptedBodyJson), password);
  let subject: string | null = null;
  if (encryptedSubjectJson) {
    subject = await decryptPayloadInBrowser(parseEncryptedPayload(encryptedSubjectJson), password);
  }
  return { body, subject };
}
