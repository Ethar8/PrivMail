import { encryptWithPassword, decryptWithPassword, serializePayload, parsePayload } from '../../utils/crypto/password-message';
import { generateHybridKeyPair, hybridEncrypt, hybridDecrypt, computeKeyFingerprint } from '../../utils/crypto/hybrid';

describe('password-message', () => {
  it('encrypts and decrypts with password', () => {
    const payload = encryptWithPassword('Hallo Geheim', 'passwort123');
    expect(payload.alg).toBe('aes-256-gcm');
    expect(decryptWithPassword(payload, 'passwort123')).toBe('Hallo Geheim');
    expect(() => decryptWithPassword(payload, 'wrong')).toThrow();
  });

  it('serializes and parses', () => {
    const payload = encryptWithPassword('x', 'y' + 'z'.repeat(8));
    const again = parsePayload(serializePayload(payload));
    expect(again.ciphertext).toBe(payload.ciphertext);
  });
});

describe('hybrid ML-KEM', () => {
  jest.setTimeout(60_000);

  it('generates hybrid keys and encrypts/decrypts via classical path', async () => {
    const keys = await generateHybridKeyPair('Test', 't@example.com', 'passphrase-long');
    expect(keys.type).toBe('hybrid');
    expect(keys.pqAlgorithm).toBe('ml-kem-768');
    expect(keys.pqPublicKey.length).toBeGreaterThan(32);

    const enc = await hybridEncrypt('secret message', keys.publicKey, keys.pqPublicKey);
    expect(enc.ciphertext).toContain('BEGIN PGP MESSAGE');
    expect(enc.wrappedKeys.length).toBe(1);
    expect(JSON.parse(enc.wrappedKeys[0]).alg).toBe('ml-kem-768');

    const plain = await hybridDecrypt(
      enc.ciphertext,
      enc.wrappedKeys,
      keys.privateKey,
      keys.pqPrivateKey,
      'passphrase-long',
    );
    expect(plain).toBe('secret message');
    expect(computeKeyFingerprint(keys.publicKey).length).toBe(40);
  });
});
