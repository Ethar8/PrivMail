import * as net from 'net';
import * as tls from 'tls';
import { SMTPServer } from '../../mail/smtp/server';
import { IMAPServer } from '../../mail/imap/server';
import { config } from '../../config/config';
import { resetSecureContextCache } from '../../mail/tls-context';

const tlsCfg = config.tls as {
  certPath: string;
  keyPath: string;
  smtpRequireTls: boolean;
  imapRequireTls: boolean;
};

const CERT = '/tmp/pm-tls.crt';
const KEY = '/tmp/pm-tls.key';

// Helper: read one CRLF line from a socket.
function readLine(sock: net.Socket | tls.TLSSocket, timeout = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('read timeout')), timeout);
    const onData = (d: Buffer) => {
      buf += d.toString();
      const idx = buf.indexOf('\r\n');
      if (idx !== -1) {
        clearTimeout(t);
        sock.removeListener('data', onData);
        resolve(buf.slice(0, idx));
      }
    };
    sock.on('data', onData);
  });
}

describe('STARTTLS integration (real socket upgrade)', () => {
  const orig = { ...tlsCfg };
  let smtp: SMTPServer;
  let imap: IMAPServer;
  const SMTP_PORT = 12525;
  const IMAP_PORT = 12143;

  beforeAll((done) => {
    tlsCfg.certPath = CERT;
    tlsCfg.keyPath = KEY;
    tlsCfg.smtpRequireTls = true;
    tlsCfg.imapRequireTls = true;
    resetSecureContextCache();
    smtp = new SMTPServer(async () => undefined, SMTP_PORT);
    imap = new IMAPServer(IMAP_PORT);
    smtp.start();
    imap.start();
    setTimeout(done, 400);
  });

  afterAll(() => {
    smtp.stop();
    imap.stop();
    Object.assign(tlsCfg, orig);
    resetSecureContextCache();
  });

  it('SMTP: upgrades to TLS and accepts MAIL only after STARTTLS', async () => {
    const sock = net.createConnection(SMTP_PORT, '127.0.0.1');
    await readLine(sock); // 220 greeting

    sock.write('EHLO tester\r\n');
    await readLine(sock); // 250-first line
    // drain the remaining EHLO lines
    await new Promise((r) => setTimeout(r, 150));

    // MAIL before TLS must be blocked (530)
    sock.write('MAIL FROM:<a@x.de>\r\n');
    const blocked = await readLine(sock);
    expect(blocked.startsWith('530')).toBe(true);

    // STARTTLS
    sock.write('STARTTLS\r\n');
    const ready = await readLine(sock);
    expect(ready.startsWith('220')).toBe(true);

    // Upgrade the client side
    const secure: tls.TLSSocket = await new Promise((resolve, reject) => {
      const s = tls.connect({ socket: sock, rejectUnauthorized: false }, () => resolve(s));
      s.on('error', reject);
    });
    expect(secure.encrypted).toBe(true);

    // Re-EHLO over TLS, then MAIL must now be accepted
    secure.write('EHLO tester\r\n');
    await readLine(secure);
    await new Promise((r) => setTimeout(r, 150));
    secure.write('MAIL FROM:<a@x.de>\r\n');
    const afterTls = await readLine(secure);
    expect(afterTls.startsWith('250')).toBe(true);

    secure.write('QUIT\r\n');
    secure.destroy();
  });

  it('IMAP: upgrades to TLS and allows LOGIN attempt only after STARTTLS', async () => {
    const sock = net.createConnection(IMAP_PORT, '127.0.0.1');
    await readLine(sock); // * OK greeting

    // LOGIN before TLS must be blocked
    sock.write('a1 LOGIN user secret\r\n');
    const blocked = await readLine(sock);
    expect(blocked).toContain('PRIVACYREQUIRED');

    // STARTTLS
    sock.write('a2 STARTTLS\r\n');
    const ok = await readLine(sock);
    expect(ok).toContain('a2 OK');

    const secure: tls.TLSSocket = await new Promise((resolve, reject) => {
      const s = tls.connect({ socket: sock, rejectUnauthorized: false }, () => resolve(s));
      s.on('error', reject);
    });
    expect(secure.encrypted).toBe(true);

    // CAPABILITY over TLS should no longer advertise LOGINDISABLED
    secure.write('a3 CAPABILITY\r\n');
    const cap = await readLine(secure);
    expect(cap).not.toContain('LOGINDISABLED');

    secure.write('a4 LOGOUT\r\n');
    secure.destroy();
  });
});
