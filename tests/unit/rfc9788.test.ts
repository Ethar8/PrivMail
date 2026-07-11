import { encryptHeadersRFC9788, decryptHeadersRFC9788 } from '../../backend/src/utils/crypto/rfc9788';
import { generatePGPKey } from '../../backend/src/utils/crypto/pgp';

describe('RFC 9788 header protection (round-trip)', () => {
  jest.setTimeout(30000);

  it('encrypts and decrypts headers', async () => {
    const passphrase = 'test-pass';
    const { publicKey, privateKey } = await generatePGPKey('Bob', 'bob@example.com', passphrase);

    const encrypted = await encryptHeadersRFC9788(
      { subject: 'Vertraulich', from: 'alice@example.com', to: 'bob@example.com' },
      publicKey,
    );
    expect(encrypted).toContain('BEGIN PGP MESSAGE');

    const decrypted = await decryptHeadersRFC9788(encrypted, privateKey, passphrase);
    expect(decrypted.subject).toBe('Vertraulich');
    expect(decrypted.to).toBe('bob@example.com');
  });
});
