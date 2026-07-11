import { parseMessage } from '../../mail/smtp/parser-message';
import { SpamFilter } from '../../spam/filter';

jest.mock('../../dns/spf', () => ({
  checkSPF: async () => ({ pass: true, result: 'pass', record: null, reason: 'test' }),
}));
jest.mock('../../dns/dkim', () => ({
  checkDKIM: async () => ({ pass: true, domain: null, selector: null, reason: 'test' }),
}));
jest.mock('../../dns/dmarc', () => ({
  checkDMARC: async () => ({ pass: true, policy: 'none', record: null, reason: 'test', action: 'accept' }),
}));

/**
 * Exercises the parse -> spam analysis pipeline that the SMTP ingest path uses,
 * without requiring a database (storage is covered separately).
 */
describe('mail flow: parse + analyze', () => {
  it('parses a raw message and analyzes it for spam', async () => {
    const raw =
      'From: sender@example.com\r\n' +
      'To: user@privmail\r\n' +
      'Subject: Hello\r\n' +
      'DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=sel; bh=x; b=y; h=from:to\r\n' +
      '\r\n' +
      'This is a normal message body.';

    const parsed = parseMessage(raw);
    expect(parsed.from).toContain('sender@example.com');
    expect(parsed.headers['dkim-signature']).toBeDefined();

    const filter = new SpamFilter();
    const analysis = await filter.analyze({
      from: parsed.from,
      senderIP: '1.2.3.4',
      subject: parsed.subject,
      body: parsed.body,
      headers: parsed.headers,
      raw,
    });
    expect(analysis).toHaveProperty('isSpam');
    expect(analysis).toHaveProperty('score');
    expect(analysis).toHaveProperty('cleanedBody');
  });
});
