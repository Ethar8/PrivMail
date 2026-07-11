import * as net from 'net';
import { scanBuffer, scanEmailOrThrow, VirusRejectedError } from '../../mail/av/clamav';
import { config } from '../../config/config';

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

// Mutable view of the AV config for test-time overrides.
const avConfig = config.av as {
  enabled: boolean;
  host: string;
  port: number;
  failClosed: boolean;
};

/**
 * Protocol-accurate mock of clamd's INSTREAM command. It reassembles the
 * length-prefixed chunk stream exactly like real clamd, then replies with the
 * matching wire response. This lets us verify our client deterministically
 * without a real ClamAV daemon.
 */
function startMockClamd(mode: 'clean' | 'eicar' | 'error'): Promise<net.Server> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let buf = Buffer.alloc(0);
      let started = false;
      let payload = Buffer.alloc(0);

      socket.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);

        // Expect the "zINSTREAM\0" command first.
        if (!started) {
          const idx = buf.indexOf(0x00);
          if (idx === -1) return;
          const cmd = buf.subarray(0, idx).toString('utf8');
          if (!/INSTREAM/i.test(cmd)) {
            socket.end('UNKNOWN COMMAND\0');
            return;
          }
          started = true;
          buf = buf.subarray(idx + 1);
        }

        // Parse <uint32 length><bytes> frames until the zero-length terminator.
        for (;;) {
          if (buf.length < 4) return;
          const len = buf.readUInt32BE(0);
          if (len === 0) {
            // Stream complete -> decide verdict based on scanned payload.
            const text = payload.toString('utf8');
            if (mode === 'error') socket.end('INSTREAM size limit exceeded. ERROR\0');
            else if (mode === 'eicar' && text.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'))
              socket.end('stream: Eicar-Test-Signature FOUND\0');
            else socket.end('stream: OK\0');
            return;
          }
          if (buf.length < 4 + len) return; // wait for the full frame
          payload = Buffer.concat([payload, buf.subarray(4, 4 + len)]);
          buf = buf.subarray(4 + len);
        }
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function port(server: net.Server): number {
  return (server.address() as net.AddressInfo).port;
}

describe('ClamAV INSTREAM client', () => {
  const orig = { host: process.env.CLAMAV_HOST, port: process.env.CLAMAV_PORT, fc: process.env.AV_FAIL_CLOSED };

  afterAll(() => {
    process.env.CLAMAV_HOST = orig.host;
    process.env.CLAMAV_PORT = orig.port;
    process.env.AV_FAIL_CLOSED = orig.fc;
  });

  it('reports clean for a harmless message', async () => {
    const server = await startMockClamd('clean');
    try {
      avConfig.host = '127.0.0.1';
      avConfig.port = port(server);
      const res = await scanBuffer(Buffer.from('Hello, this is a normal email.'));
      expect(res.status).toBe('clean');
    } finally {
      server.close();
    }
  });

  it('detects the EICAR test signature', async () => {
    const server = await startMockClamd('eicar');
    try {
      avConfig.host = '127.0.0.1';
      avConfig.port = port(server);
      const res = await scanBuffer(Buffer.from(`Subject: test\r\n\r\n${EICAR}\r\n`));
      expect(res.status).toBe('infected');
      expect(res.signature).toMatch(/Eicar/i);
    } finally {
      server.close();
    }
  });

  it('throws a permanent VirusRejectedError for EICAR via scanEmailOrThrow', async () => {
    const server = await startMockClamd('eicar');
    try {
      avConfig.enabled = true;
      avConfig.host = '127.0.0.1';
      avConfig.port = port(server);
      avConfig.failClosed = true;
      await expect(scanEmailOrThrow(`Subject: x\r\n\r\n${EICAR}`)).rejects.toMatchObject({
        name: 'VirusRejectedError',
        temporary: false,
      });
    } finally {
      server.close();
    }
  });

  it('fail-closed: throws a TEMPORARY error when the scanner is unavailable', async () => {
    avConfig.enabled = true;
    avConfig.host = '127.0.0.1';
    avConfig.port = 1; // nothing listening -> connection refused
    avConfig.failClosed = true;
    let thrown: VirusRejectedError | null = null;
    try {
      await scanEmailOrThrow('Subject: x\r\n\r\nhello');
    } catch (e) {
      thrown = e as VirusRejectedError;
    }
    expect(thrown).not.toBeNull();
    expect(thrown!.name).toBe('VirusRejectedError');
    expect(thrown!.temporary).toBe(true);
  });

  it('fail-open: passes through (skipped) when scanner is unavailable and failClosed=false', async () => {
    avConfig.enabled = true;
    avConfig.host = '127.0.0.1';
    avConfig.port = 1;
    avConfig.failClosed = false;
    const res = await scanEmailOrThrow('Subject: x\r\n\r\nhello');
    expect(res.status).toBe('skipped');
  });
});
