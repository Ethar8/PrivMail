import { SMTPParser } from '../../mail/smtp/parser';
import { handleEhlo } from '../../mail/smtp/handlers/ehlo';
import { handleMail } from '../../mail/smtp/handlers/mail';
import { handleRcpt } from '../../mail/smtp/handlers/rcpt';
import { SMTPHandler } from '../../mail/smtp/handlers';
import { VirusRejectedError } from '../../mail/av/clamav';
import { createSMTPSession } from '../../mail/smtp/session';
import { parseMessage } from '../../mail/smtp/parser-message';
import * as net from 'net';

jest.mock('../../models/alias', () => ({
  resolveLocalRecipient: jest.fn(async (address: string) => {
    if (address.endsWith('@localhost') || address.endsWith('@example.com')) {
      return {
        kind: 'user',
        user: { id: 'u1', email: address },
        deliveredTo: address,
      };
    }
    return { kind: 'unknown' };
  }),
}));

function fakeSession() {
  const socket = { remoteAddress: '127.0.0.1', write: jest.fn() } as unknown as net.Socket;
  return createSMTPSession(socket);
}

describe('SMTPParser', () => {
  it('parses a verb with argument', () => {
    const cmd = SMTPParser.parse('MAIL FROM:<alice@example.com>');
    expect(cmd.verb).toBe('MAIL');
    expect(cmd.arg).toBe('FROM:<alice@example.com>');
  });

  it('parses a bare verb', () => {
    expect(SMTPParser.parse('QUIT').verb).toBe('QUIT');
  });

  it('extracts an address', () => {
    expect(SMTPParser.parseAddress('FROM:<bob@example.com>')).toBe('bob@example.com');
  });
});

describe('SMTP handlers', () => {
  it('responds to EHLO with extensions', () => {
    const session = fakeSession();
    const res = handleEhlo(SMTPParser.parse('EHLO client'), session);
    expect(res).toContain('250');
    expect(res).toContain('PIPELINING');
    expect(res).toContain('AUTH');
  });

  it('accepts a valid MAIL FROM', () => {
    const session = fakeSession();
    const res = handleMail(SMTPParser.parse('MAIL FROM:<alice@example.com>'), session);
    expect(res.startsWith('250')).toBe(true);
    expect(session.mailFrom).toBe('alice@example.com');
  });

  it('rejects RCPT without MAIL FROM', async () => {
    const session = fakeSession();
    const res = await handleRcpt(SMTPParser.parse('RCPT TO:<bob@example.com>'), session);
    expect(res.startsWith('503')).toBe(true);
  });

  it('accepts RCPT after MAIL FROM for a local domain', async () => {
    const session = fakeSession();
    handleMail(SMTPParser.parse('MAIL FROM:<alice@example.com>'), session);
    const res = await handleRcpt(SMTPParser.parse('RCPT TO:<bob@localhost>'), session);
    expect(res.startsWith('250')).toBe(true);
    expect(session.rcptTo).toContain('bob@localhost');
  });

  it('rejects RCPT for a foreign domain (no open relay)', async () => {
    const session = fakeSession();
    handleMail(SMTPParser.parse('MAIL FROM:<alice@example.com>'), session);
    const res = await handleRcpt(SMTPParser.parse('RCPT TO:<victim@other-domain.com>'), session);
    expect(res.startsWith('550')).toBe(true);
    expect(session.rcptTo).not.toContain('victim@other-domain.com');
  });
});

describe('parseMessage', () => {
  it('parses headers and body', () => {
    const raw = 'From: alice@example.com\r\nTo: bob@example.com\r\nSubject: Hi\r\n\r\nHello world';
    const msg = parseMessage(raw);
    expect(msg.from).toBe('alice@example.com');
    expect(msg.subject).toBe('Hi');
    expect(msg.body).toBe('Hello world');
  });
});

describe('SMTP DATA completion – antivirus reactions', () => {
  it('maps a virus infection to 554 5.7.1', async () => {
    const session = fakeSession();
    session.mailFrom = 'a@example.com';
    session.rcptTo = ['user@localhost'];
    const onMessage = async () => {
      throw new VirusRejectedError('Virus detected: Eicar-Test-Signature', {
        temporary: false,
        signature: 'Eicar-Test-Signature',
      });
    };
    const res = await SMTPHandler.completeData(session, onMessage);
    expect(res).toContain('554');
    expect(res).toContain('5.7.1');
    expect(res.toLowerCase()).toContain('virus');
  });

  it('maps scanner-unavailable (temporary) to 451', async () => {
    const session = fakeSession();
    session.mailFrom = 'a@example.com';
    session.rcptTo = ['user@localhost'];
    const onMessage = async () => {
      throw new VirusRejectedError('Virus scanner unavailable', { temporary: true });
    };
    const res = await SMTPHandler.completeData(session, onMessage);
    expect(res.startsWith('451')).toBe(true);
  });

  it('accepts a clean message with 250', async () => {
    const session = fakeSession();
    session.mailFrom = 'a@example.com';
    session.rcptTo = ['user@localhost'];
    const onMessage = async () => undefined;
    const res = await SMTPHandler.completeData(session, onMessage);
    expect(res.startsWith('250')).toBe(true);
  });
});
