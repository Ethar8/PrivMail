import * as crypto from 'crypto';
import { resolver } from './resolver';

export interface DKIMResult {
  pass: boolean;
  domain: string | null;
  selector: string | null;
  reason: string;
}

interface EmailLike {
  headers: Record<string, string>;
  body: string;
  raw?: string;
}

function parseDKIMHeader(value: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of value.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair
      .slice(idx + 1)
      .trim()
      .replace(/\s+/g, '');
    if (key) params[key] = val;
  }
  return params;
}

function canonicalizeBodyRelaxed(body: string): string {
  return body.replace(/[ \t]+/g, ' ').replace(/[ \t]*\r\n/g, '\r\n').replace(/(\r\n)+$/, '') + '\r\n';
}

function canonicalizeHeaderRelaxed(name: string, value: string): string {
  return `${name.toLowerCase()}:${value.replace(/\s+/g, ' ').trim()}`;
}

/**
 * Full DKIM verification (rsa-sha256, relaxed/relaxed): DNS key lookup, body
 * hash comparison, header canonicalization and RSA signature verification.
 */
export async function checkDKIM(email: EmailLike): Promise<DKIMResult> {
  const dkimHeader = email.headers['dkim-signature'];
  if (!dkimHeader) {
    return { pass: false, domain: null, selector: null, reason: 'no DKIM signature' };
  }

  const params = parseDKIMHeader(dkimHeader);
  const { d, s, bh, b, h } = params;
  if (!d || !s || !bh || !b || !h) {
    return { pass: false, domain: d ?? null, selector: s ?? null, reason: 'incomplete signature' };
  }

  // 1. Body hash
  const bodyHash = crypto
    .createHash('sha256')
    .update(canonicalizeBodyRelaxed(email.body), 'utf8')
    .digest('base64');
  if (bodyHash !== bh) {
    return { pass: false, domain: d, selector: s, reason: 'body hash mismatch' };
  }

  // 2. Public key from DNS
  const txts = await resolver.txt(`${s}._domainkey.${d}`);
  const keyRecord = txts.find((r) => r.includes('p=')) ?? null;
  if (!keyRecord) {
    return { pass: false, domain: d, selector: s, reason: 'public key not found' };
  }
  const keyParams = parseDKIMHeader(keyRecord);
  const p = keyParams.p;
  if (!p) {
    return { pass: false, domain: d, selector: s, reason: 'public key empty (revoked)' };
  }

  // 3. Rebuild the signed header string
  const headerNames = h.split(':').map((x) => x.trim().toLowerCase());
  const signedHeaders = headerNames
    .map((name) => canonicalizeHeaderRelaxed(name, email.headers[name] ?? ''))
    .join('\r\n');

  // The DKIM-Signature header itself is included with an empty b= value.
  const dkimForSigning = canonicalizeHeaderRelaxed(
    'dkim-signature',
    dkimHeader.replace(/\bb=[^;]*/, 'b='),
  );
  const signedData = signedHeaders + '\r\n' + dkimForSigning;

  // 4. Verify RSA-SHA256 signature
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${p.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signedData);
    verifier.end();
    const valid = verifier.verify(publicKeyPem, Buffer.from(b, 'base64'));
    return {
      pass: valid,
      domain: d,
      selector: s,
      reason: valid ? 'signature valid' : 'signature invalid',
    };
  } catch (err) {
    return { pass: false, domain: d, selector: s, reason: `verify error: ${(err as Error).message}` };
  }
}
