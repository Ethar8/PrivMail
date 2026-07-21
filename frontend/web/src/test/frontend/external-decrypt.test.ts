/**
 * @jest-environment jsdom
 */
import { TextEncoder } from 'util';

// Polyfill subtle crypto pieces if needed for Node/jsdom
const subtle = globalThis.crypto?.subtle;

describe('external-decrypt', () => {
  const password = 'correct-horse-battery';

  async function encryptLikeServer(plaintext: string, pwd: string) {
    const iterations = 100_000; // lower for test speed
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(pwd), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext)));
    // WebCrypto appends tag to ciphertext; Node password-message stores them split.
    // Mimic Node format: last 16 bytes = tag
    const tag = encrypted.slice(encrypted.length - 16);
    const ciphertext = encrypted.slice(0, encrypted.length - 16);
    const toB64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
    return JSON.stringify({
      v: 1,
      alg: 'aes-256-gcm',
      kdf: 'pbkdf2-sha256',
      iterations,
      salt: toB64(salt),
      iv: toB64(iv),
      tag: toB64(tag),
      ciphertext: toB64(ciphertext),
    });
  }

  it('round-trips password-protected payload in the browser', async () => {
    if (!subtle) return;
    const { decryptExternalMessage, parseEncryptedPayload } = await import('@/lib/external-decrypt');
    const raw = await encryptLikeServer('Geheimer Inhalt', password);
    parseEncryptedPayload(raw);
    const result = await decryptExternalMessage(raw, password);
    expect(result.body).toBe('Geheimer Inhalt');
  });

  it('rejects wrong password', async () => {
    if (!subtle) return;
    const { decryptExternalMessage } = await import('@/lib/external-decrypt');
    const raw = await encryptLikeServer('Secret', password);
    await expect(decryptExternalMessage(raw, 'wrong')).rejects.toThrow(/fehlgeschlagen|Passwort/i);
  });

  it('rejects invalid payload', async () => {
    const { parseEncryptedPayload } = await import('@/lib/external-decrypt');
    expect(() => parseEncryptedPayload(JSON.stringify({ v: 99 }))).toThrow(/Ungültig/i);
  });
});
