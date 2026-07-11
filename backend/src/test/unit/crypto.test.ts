import { generatePGPKey, encryptMessage, decryptMessage } from '../../utils/crypto/pgp';
import { encryptHeadersRFC9788, decryptHeadersRFC9788 } from '../../utils/crypto/rfc9788';
import { sha256, sha256Base64 } from '../../utils/crypto/hash';

describe('PGP crypto (round-trip)', () => {
  jest.setTimeout(30000);

  it('generates a key pair, encrypts and decrypts', async () => {
    const passphrase = 'secret-pass';
    const { publicKey, privateKey } = await generatePGPKey('Bob', 'bob@example.com', passphrase);
    expect(publicKey).toContain('BEGIN PGP PUBLIC KEY');

    const encrypted = await encryptMessage('Hallo Welt', publicKey);
    expect(encrypted).toContain('BEGIN PGP MESSAGE');

    const decrypted = await decryptMessage(encrypted, privateKey, passphrase);
    expect(decrypted).toBe('Hallo Welt');
  });
});

describe('RFC 9788 header protection', () => {
  jest.setTimeout(30000);

  it('encrypts and decrypts headers', async () => {
    const passphrase = 'hdr-pass';
    const { publicKey, privateKey } = await generatePGPKey('Bob', 'bob@example.com', passphrase);
    const encrypted = await encryptHeadersRFC9788(
      { subject: 'Vertraulich', from: 'alice@example.com', to: 'bob@example.com' },
      publicKey,
    );
    const decrypted = await decryptHeadersRFC9788(encrypted, privateKey, passphrase);
    expect(decrypted.subject).toBe('Vertraulich');
    expect(decrypted.to).toBe('bob@example.com');
  });
});

describe('hash utils', () => {
  it('produces stable sha256 hex and base64', () => {
    expect(sha256('abc')).toHaveLength(64);
    expect(typeof sha256Base64('abc')).toBe('string');
  });
});
