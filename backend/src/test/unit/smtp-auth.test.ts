import { SMTPHandler } from '../../mail/smtp/handlers';
import { SMTPParser } from '../../mail/smtp/parser';
import { createSMTPSession } from '../../mail/smtp/session';
import { config } from '../../config/config';
import * as net from 'net';

jest.mock('../../models/user', () => ({
  verifyCredentials: jest.fn(async (email: string, password: string) =>
    email === 'alice@localhost' && password === 'correct-horse'
      ? { id: 'u1', email, displayName: null, isAdmin: false, tokenVersion: 0 }
      : null,
  ),
}));

const tlsCfg = config.tls as { smtpRequireTls: boolean };

function sess() {
  const socket = { remoteAddress: '127.0.0.1', write: jest.fn() } as unknown as net.Socket;
  const s = createSMTPSession(socket);
  s.tlsActive = true; // AUTH requires TLS; simulate post-STARTTLS
  return s;
}

const b64 = (s: string) => Buffer.from(s).toString('base64');
const onMsg = async () => undefined;

describe('SMTP AUTH', () => {
  it('AUTH PLAIN with inline credentials succeeds (235)', async () => {
    const s = sess();
    const payload = b64(`\u0000alice@localhost\u0000correct-horse`);
    const res = await SMTPHandler.handle(SMTPParser.parse(`AUTH PLAIN ${payload}`), s, onMsg);
    expect(res.response.startsWith('235')).toBe(true);
    expect(s.authenticated).toBe(true);
    expect(s.user).toBe('alice@localhost');
  });

  it('AUTH PLAIN with wrong password fails (535)', async () => {
    const s = sess();
    const payload = b64(`\u0000alice@localhost\u0000wrong`);
    const res = await SMTPHandler.handle(SMTPParser.parse(`AUTH PLAIN ${payload}`), s, onMsg);
    expect(res.response.startsWith('535')).toBe(true);
    expect(s.authenticated).toBe(false);
  });

  it('AUTH LOGIN performs the challenge/response exchange', async () => {
    const s = sess();
    const start = await SMTPHandler.handle(SMTPParser.parse('AUTH LOGIN'), s, onMsg);
    expect(start.response.startsWith('334')).toBe(true);
    expect(s.authState?.mechanism).toBe('LOGIN');

    const afterUser = await SMTPHandler.completeAuth(b64('alice@localhost'), s);
    expect(afterUser.response.startsWith('334')).toBe(true);

    const afterPass = await SMTPHandler.completeAuth(b64('correct-horse'), s);
    expect(afterPass.response.startsWith('235')).toBe(true);
    expect(s.authenticated).toBe(true);
  });

  it('AUTH is blocked before STARTTLS when TLS is required', async () => {
    const prev = tlsCfg.smtpRequireTls;
    tlsCfg.smtpRequireTls = true;
    const socket = { remoteAddress: '127.0.0.1', write: jest.fn() } as unknown as net.Socket;
    const s = createSMTPSession(socket); // tlsActive = false
    const res = await SMTPHandler.handle(SMTPParser.parse('AUTH LOGIN'), s, onMsg);
    expect(res.response.startsWith('530')).toBe(true);
    tlsCfg.smtpRequireTls = prev;
  });
});
