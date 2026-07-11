import * as net from 'net';
import { config } from '../../config/config';
import { CLAMAV_TIMEOUT_MS, CLAMAV_CHUNK_SIZE, CLAMAV_MAX_SCAN_SIZE } from '../../config/constants';
import { logger } from '../../utils/logger';

export type ScanStatus = 'clean' | 'infected' | 'unavailable' | 'skipped';

export interface ScanResult {
  status: ScanStatus;
  signature?: string; // set when status === 'infected'
  detail?: string;
}

/**
 * Error thrown by the ingest pipeline when a message must be rejected because
 * of the antivirus verdict (infected, or scanner unavailable under the
 * fail-closed policy). The SMTP layer maps this to a 5xx/4xx reply.
 */
export class VirusRejectedError extends Error {
  readonly temporary: boolean;
  readonly signature?: string;

  constructor(message: string, opts: { temporary: boolean; signature?: string }) {
    super(message);
    this.name = 'VirusRejectedError';
    this.temporary = opts.temporary;
    this.signature = opts.signature;
  }
}

/**
 * Minimal ClamAV client using the INSTREAM command over TCP (clamd, port 3310).
 *
 * Wire protocol (INSTREAM):
 *   -> "zINSTREAM\0"
 *   -> for each chunk: <uint32 BE length><chunk bytes>
 *   -> <uint32 BE 0>            (zero-length chunk terminates the stream)
 *   <- "stream: OK\0"                     => clean
 *   <- "stream: <Signature> FOUND\0"      => infected
 *   <- "... ERROR\0"                      => scanner error
 *
 * No third-party dependency is used; the protocol is implemented directly.
 */
export function scanBuffer(data: Buffer): Promise<ScanResult> {
  const { host, port } = config.av;

  return new Promise<ScanResult>((resolve) => {
    let settled = false;
    const finish = (result: ScanResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };

    const socket = net.createConnection({ host, port });
    let response = '';

    const timer = setTimeout(() => {
      logger.warn(`ClamAV scan timed out after ${CLAMAV_TIMEOUT_MS}ms`);
      finish({ status: 'unavailable', detail: 'timeout' });
    }, CLAMAV_TIMEOUT_MS);

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');

      // Stream the data in fixed-size chunks with a 4-byte big-endian length
      // prefix, followed by the zero-length terminator.
      for (let offset = 0; offset < data.length; offset += CLAMAV_CHUNK_SIZE) {
        const chunk = data.subarray(offset, offset + CLAMAV_CHUNK_SIZE);
        const size = Buffer.allocUnsafe(4);
        size.writeUInt32BE(chunk.length, 0);
        socket.write(size);
        socket.write(chunk);
      }
      const terminator = Buffer.allocUnsafe(4);
      terminator.writeUInt32BE(0, 0);
      socket.write(terminator);
    });

    socket.on('data', (buf) => {
      response += buf.toString('utf8');
      if (response.includes('\0') || response.includes('\n')) {
        finish(parseClamResponse(response));
      }
    });

    socket.on('error', (err) => {
      logger.warn(`ClamAV connection error: ${err.message}`);
      finish({ status: 'unavailable', detail: err.message });
    });

    socket.on('close', () => {
      if (!settled) finish({ status: 'unavailable', detail: 'connection closed' });
    });
  });
}

function parseClamResponse(raw: string): ScanResult {
  const line = raw.replace(/\0/g, '').trim();
  if (/\bOK$/.test(line)) {
    return { status: 'clean' };
  }
  const found = line.match(/^stream:\s*(.+?)\s+FOUND$/i);
  if (found) {
    return { status: 'infected', signature: found[1] };
  }
  return { status: 'unavailable', detail: line || 'unknown response' };
}

/**
 * Scans a raw email. Applies size limits and the fail-closed policy. Throws a
 * VirusRejectedError when the message must be rejected; returns the verdict
 * otherwise (clean/skipped).
 */
export async function scanEmailOrThrow(raw: string): Promise<ScanResult> {
  if (!config.av.enabled) {
    return { status: 'skipped', detail: 'AV disabled' };
  }

  const data = Buffer.from(raw, 'utf8');

  // Messages larger than clamd can accept are unscannable.
  if (data.length > CLAMAV_MAX_SCAN_SIZE) {
    if (config.av.failClosed) {
      throw new VirusRejectedError('Message too large to scan for viruses', {
        temporary: true,
      });
    }
    logger.warn('Message exceeds AV scan size; passing through (fail-open)');
    return { status: 'skipped', detail: 'too large' };
  }

  const result = await scanBuffer(data);

  if (result.status === 'infected') {
    throw new VirusRejectedError(`Virus detected: ${result.signature}`, {
      temporary: false,
      signature: result.signature,
    });
  }

  if (result.status === 'unavailable') {
    if (config.av.failClosed) {
      throw new VirusRejectedError('Virus scanner unavailable', { temporary: true });
    }
    logger.warn('AV scanner unavailable; passing through (fail-open)');
    return { status: 'skipped', detail: 'scanner unavailable' };
  }

  return result;
}
