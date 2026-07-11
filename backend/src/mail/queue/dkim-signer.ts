import * as fs from 'fs';
import * as crypto from 'crypto';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';

let cachedKey: string | null | undefined;

function loadPrivateKey(): string | null {
  if (cachedKey !== undefined) return cachedKey;
  const path = config.dkimPrivateKeyPath;
  if (!path) {
    cachedKey = null;
    return null;
  }
  try {
    cachedKey = fs.readFileSync(path, 'utf8');
    logger.info('DKIM: signing key loaded; outbound mail will be signed');
  } catch (err) {
    logger.error(`DKIM: failed to load signing key: ${(err as Error).message}`);
    cachedKey = null;
  }
  return cachedKey;
}

export function isDkimSigningEnabled(): boolean {
  return loadPrivateKey() !== null;
}

/** Test-only cache reset. */
export function resetDkimKeyCache(): void {
  cachedKey = undefined;
}

function splitMessage(raw: string): { headerBlock: string; body: string } {
  const idx = raw.indexOf('\r\n\r\n');
  if (idx === -1) return { headerBlock: raw, body: '' };
  return { headerBlock: raw.slice(0, idx), body: raw.slice(idx + 4) };
}

/** Relaxed body canonicalization (RFC 6376 §3.4.4). */
function canonicalizeBody(body: string): string {
  let b = body.replace(/[ \t]+/g, ' ').replace(/[ \t]*\r\n/g, '\r\n');
  b = b.replace(/(\r\n)+$/, '');
  return b.length ? b + '\r\n' : '\r\n';
}

/** Relaxed header canonicalization for a single "name: value" header. */
function canonicalizeHeader(name: string, value: string): string {
  return `${name.toLowerCase()}:${value.replace(/\s+/g, ' ').trim()}`;
}

interface ParsedHeaders {
  order: { name: string; value: string }[];
  get(name: string): string | undefined;
}

function parseHeaders(headerBlock: string): ParsedHeaders {
  const lines = headerBlock.split('\r\n');
  const unfolded: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += ' ' + line.trim();
    } else {
      unfolded.push(line);
    }
  }
  const order = unfolded
    .map((l) => {
      const i = l.indexOf(':');
      if (i === -1) return null;
      return { name: l.slice(0, i).trim(), value: l.slice(i + 1).trim() };
    })
    .filter((x): x is { name: string; value: string } => x !== null);

  return {
    order,
    get(name: string) {
      return order.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
    },
  };
}

/**
 * Signs a raw RFC 5322 message with DKIM (rsa-sha256, relaxed/relaxed) and
 * returns the message with a prepended DKIM-Signature header. If signing is not
 * configured, the original message is returned unchanged.
 */
export function signMessage(raw: string, fromDomain?: string): string {
  const key = loadPrivateKey();
  if (!key) return raw;

  const { headerBlock, body } = splitMessage(raw);
  const headers = parseHeaders(headerBlock);
  const domain = fromDomain ?? config.domain;
  const selector = config.dkimSelector;

  // Headers to sign (only those present).
  const candidateNames = ['from', 'to', 'cc', 'subject', 'date', 'message-id', 'mime-version', 'content-type'];
  const signedNames = candidateNames.filter((n) => headers.get(n) !== undefined);

  const bodyHash = crypto.createHash('sha256').update(canonicalizeBody(body), 'utf8').digest('base64');

  // Build the DKIM-Signature header value with an empty b=.
  const dkimFields =
    `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${domain}; s=${selector}; ` +
    `t=${Math.floor(Date.now() / 1000)}; bh=${bodyHash}; ` +
    `h=${signedNames.join(':')}; b=`;

  // Data to sign = canonicalized signed headers + the DKIM-Signature header
  // (with empty b= and no trailing CRLF).
  const signedHeaderLines = signedNames
    .map((n) => canonicalizeHeader(n, headers.get(n) ?? ''))
    .join('\r\n');
  const dkimHeaderForSigning = canonicalizeHeader('dkim-signature', dkimFields);
  const toSign = signedHeaderLines + '\r\n' + dkimHeaderForSigning;

  let signature: string;
  try {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(toSign);
    signer.end();
    signature = signer.sign(key, 'base64');
  } catch (err) {
    logger.error(`DKIM: signing failed: ${(err as Error).message}`);
    return raw;
  }

  const dkimHeader = `DKIM-Signature: ${dkimFields}${signature}`;
  return `${dkimHeader}\r\n${raw}`;
}
