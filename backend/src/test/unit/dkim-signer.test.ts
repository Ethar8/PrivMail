import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { signMessage, resetDkimKeyCache } from '../../mail/queue/dkim-signer';
import { config } from '../../config/config';
import { resolver } from '../../dns/resolver';
import { checkDKIM } from '../../dns/dkim';

const cfg = config as unknown as { dkimPrivateKeyPath: string; dkimSelector: string; domain: string };

describe('DKIM outbound signing', () => {
  let keyPath: string;
  let publicKeyPem: string;
  const origPath = cfg.dkimPrivateKeyPath;

  beforeAll(() => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    publicKeyPem = publicKey;
    keyPath = path.join(os.tmpdir(), `privmail-dkim-${Date.now()}.pem`);
    fs.writeFileSync(keyPath, privateKey);
    cfg.dkimPrivateKeyPath = keyPath;
    cfg.dkimSelector = 'test';
    resetDkimKeyCache();
  });

  afterAll(() => {
    cfg.dkimPrivateKeyPath = origPath;
    resetDkimKeyCache();
    try {
      fs.unlinkSync(keyPath);
    } catch {
      /* ignore */
    }
  });

  const raw =
    'From: alice@example.com\r\n' +
    'To: bob@remote.tld\r\n' +
    'Subject: Hallo\r\n' +
    'Date: Wed, 01 Jan 2025 00:00:00 +0000\r\n' +
    '\r\n' +
    'Dies ist der Nachrichtentext.\r\n';

  it('prepends a DKIM-Signature header', () => {
    const signed = signMessage(raw, 'example.com');
    expect(signed.startsWith('DKIM-Signature:')).toBe(true);
    expect(signed).toContain('d=example.com');
    expect(signed).toContain('s=test');
    expect(signed).toContain('a=rsa-sha256');
    expect(signed).toContain('bh=');
    expect(signed).toContain('b=');
  });

  it('computes a body hash that matches the canonicalized body', () => {
    const signed = signMessage(raw, 'example.com');
    const bh = signed.match(/bh=([^;]+);/)?.[1];
    expect(bh).toBeTruthy();
    const canon = 'Dies ist der Nachrichtentext.\r\n';
    const expected = crypto.createHash('sha256').update(canon, 'utf8').digest('base64');
    expect(bh).toBe(expected);
  });

  it('produces a signature verifiable end-to-end by the DKIM verifier', async () => {
    const signed = signMessage(raw, 'example.com');

    const p = publicKeyPem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s+/g, '');
    const spy = jest.spyOn(resolver, 'txt').mockResolvedValue([`v=DKIM1; k=rsa; p=${p}`]);

    const sepIdx = signed.indexOf('\r\n\r\n');
    const headerBlock = signed.slice(0, sepIdx);
    const body = signed.slice(sepIdx + 4);
    const headers: Record<string, string> = {};
    const lines = headerBlock.split('\r\n');
    const unfolded: string[] = [];
    for (const line of lines) {
      if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += ' ' + line.trim();
      else unfolded.push(line);
    }
    for (const line of unfolded) {
      const i = line.indexOf(':');
      if (i !== -1) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }

    const result = await checkDKIM({ headers, body, raw: signed });
    expect(result.pass).toBe(true);
    spy.mockRestore();
  });

  it('returns the message unchanged when signing is disabled', () => {
    cfg.dkimPrivateKeyPath = '';
    resetDkimKeyCache();
    const out = signMessage(raw, 'example.com');
    expect(out).toBe(raw);
    cfg.dkimPrivateKeyPath = keyPath;
    resetDkimKeyCache();
  });
});
