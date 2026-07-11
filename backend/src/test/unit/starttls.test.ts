import { SMTPHandler } from '../../mail/smtp/handlers';
import { IMAPHandler } from '../../mail/imap/handlers';
import { SMTPParser } from '../../mail/smtp/parser';
import { IMAPParser } from '../../mail/imap/parser';
import { createSMTPSession } from '../../mail/smtp/session';
import { createIMAPSession } from '../../mail/imap/session';
import { config } from '../../config/config';
import { resetSecureContextCache } from '../../mail/tls-context';
import * as net from 'net';

jest.mock('../../models/user', () => ({
  verifyCredentials: jest.fn(async () => null),
}));

const tlsCfg = config.tls as {
  certPath: string;
  keyPath: string;
  smtpRequireTls: boolean;
  imapRequireTls: boolean;
};

function fakeSmtp() {
  const socket = { remoteAddress: '127.0.0.1', write: jest.fn() } as unknown as net.Socket;
  return createSMTPSession(socket);
}
function fakeImap() {
  const socket = { remoteAddress: '127.0.0.1', write: jest.fn() } as unknown as net.Socket;
  return createIMAPSession(socket);
}
const noop = async () => undefined;

describe('SMTP STARTTLS enforcement (No Plaintext)', () => {
  const orig = { ...tlsCfg };
  beforeEach(() => {
    tlsCfg.smtpRequireTls = true;
    tlsCfg.certPath = '';
    tlsCfg.keyPath = '';
    resetSecureContextCache();
  });
  afterAll(() => Object.assign(tlsCfg, orig));

  it('blocks MAIL before STARTTLS with 530', async () => {
    const s = fakeSmtp();
    const res = await SMTPHandler.handle(SMTPParser.parse('MAIL FROM:<a@x.de>'), s, noop);
    expect(res.response.startsWith('530')).toBe(true);
  });

  it('blocks RCPT before STARTTLS with 530', async () => {
    const s = fakeSmtp();
    const res = await SMTPHandler.handle(SMTPParser.parse('RCPT TO:<a@localhost>'), s, noop);
    expect(res.response.startsWith('530')).toBe(true);
  });

  it('blocks DATA before STARTTLS with 530', async () => {
    const s = fakeSmtp();
    const res = await SMTPHandler.handle(SMTPParser.parse('DATA'), s, noop);
    expect(res.response.startsWith('530')).toBe(true);
  });

  it('allows EHLO, NOOP and QUIT before STARTTLS', async () => {
    const s = fakeSmtp();
    const ehlo = await SMTPHandler.handle(SMTPParser.parse('EHLO client'), s, noop);
    expect(ehlo.response).toContain('250');
    const noopRes = await SMTPHandler.handle(SMTPParser.parse('NOOP'), s, noop);
    expect(noopRes.response.startsWith('250')).toBe(true);
    const quit = await SMTPHandler.handle(SMTPParser.parse('QUIT'), s, noop);
    expect(quit.response.startsWith('221')).toBe(true);
  });

  it('STARTTLS without a certificate returns 454 (not available)', async () => {
    const s = fakeSmtp();
    const res = await SMTPHandler.handle(SMTPParser.parse('STARTTLS'), s, noop);
    expect(res.response.startsWith('454')).toBe(true);
    expect(res.startTls).toBeFalsy();
  });

  it('does not advertise STARTTLS/AUTH in EHLO without a certificate', async () => {
    const s = fakeSmtp();
    const ehlo = await SMTPHandler.handle(SMTPParser.parse('EHLO client'), s, noop);
    expect(ehlo.response).not.toContain('STARTTLS');
    expect(ehlo.response).not.toContain('AUTH');
  });

  it('allows MAIL once the session is marked TLS-active', async () => {
    const s = fakeSmtp();
    s.tlsActive = true;
    const res = await SMTPHandler.handle(SMTPParser.parse('MAIL FROM:<a@x.de>'), s, noop);
    expect(res.response.startsWith('250')).toBe(true);
  });
});

describe('IMAP STARTTLS enforcement (No Plaintext)', () => {
  const orig = { ...tlsCfg };
  beforeEach(() => {
    tlsCfg.imapRequireTls = true;
    tlsCfg.certPath = '';
    tlsCfg.keyPath = '';
    resetSecureContextCache();
  });
  afterAll(() => Object.assign(tlsCfg, orig));

  it('blocks LOGIN before STARTTLS with NO [PRIVACYREQUIRED]', async () => {
    const s = fakeImap();
    const res = await IMAPHandler.handle(IMAPParser.parse('a1 LOGIN user secret'), s);
    expect(res.response).toContain('NO [PRIVACYREQUIRED]');
  });

  it('allows CAPABILITY and NOOP before STARTTLS', async () => {
    const s = fakeImap();
    const cap = await IMAPHandler.handle(IMAPParser.parse('a1 CAPABILITY'), s);
    expect(cap.response).toContain('CAPABILITY');
    const noopRes = await IMAPHandler.handle(IMAPParser.parse('a2 NOOP'), s);
    expect(noopRes.response).toContain('OK');
  });

  it('advertises LOGINDISABLED before TLS', async () => {
    const s = fakeImap();
    const cap = await IMAPHandler.handle(IMAPParser.parse('a1 CAPABILITY'), s);
    expect(cap.response).toContain('LOGINDISABLED');
  });

  it('STARTTLS without a certificate returns NO (not available)', async () => {
    const s = fakeImap();
    const res = await IMAPHandler.handle(IMAPParser.parse('a1 STARTTLS'), s);
    expect(res.response).toContain('NO');
    expect(res.startTls).toBeFalsy();
  });

  it('allows LOGIN once the session is TLS-active', async () => {
    const s = fakeImap();
    s.tlsActive = true;
    // handler proceeds to credential check (will fail without DB) but is not
    // blocked by the privacy gate.
    const res = await IMAPHandler.handle(IMAPParser.parse('a1 LOGIN user secret'), s);
    expect(res.response).not.toContain('PRIVACYREQUIRED');
  });
});
