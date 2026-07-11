import { decryptHeaders, ProtectedHeaders } from '@/lib/rfc9788';
import { decryptMessage } from '@/lib/pgp';

/**
 * Detects and decrypts RFC 9788 header-protected messages in the viewer.
 *
 * A protected message carries the marker header
 *   X-PrivMail-Header-Protection: RFC9788
 * and a multipart/encrypted body containing (1) the encrypted header block and
 * (2) the encrypted body block. This module extracts both parts and decrypts
 * them with the user's PGP private key + passphrase.
 */

export function isHeaderProtected(raw: string): boolean {
  return /X-PrivMail-Header-Protection:\s*RFC9788/i.test(raw);
}

interface ProtectedParts {
  headerBlock: string; // armored PGP for the headers JSON
  bodyBlock: string; // armored PGP for the body
}

/** Splits the multipart/encrypted wrapper into its two armored PGP blocks. */
export function extractProtectedParts(raw: string): ProtectedParts | null {
  const boundaryMatch = raw.match(/boundary="([^"]+)"/i);
  if (!boundaryMatch) return null;
  const boundary = `--${boundaryMatch[1]}`;
  const segments = raw
    .split(boundary)
    .map((s) => s.trim())
    .filter(Boolean);

  const pgpBlocks: string[] = [];
  for (const seg of segments) {
    const begin = seg.indexOf('-----BEGIN PGP MESSAGE-----');
    const end = seg.indexOf('-----END PGP MESSAGE-----');
    if (begin !== -1 && end !== -1) {
      pgpBlocks.push(seg.slice(begin, end + '-----END PGP MESSAGE-----'.length));
    }
  }
  if (pgpBlocks.length < 2) return null;
  return { headerBlock: pgpBlocks[0], bodyBlock: pgpBlocks[1] };
}

export interface UnprotectedMessage {
  headers: ProtectedHeaders;
  body: string;
}

/**
 * Decrypts a protected message: restores the real headers and the body using
 * the recipient's PGP private key + passphrase.
 */
export async function decryptProtectedMessage(
  raw: string,
  privateKey: string,
  passphrase: string,
): Promise<UnprotectedMessage> {
  const parts = extractProtectedParts(raw);
  if (!parts) throw new Error('Kein gültiger RFC-9788-Nachrichtenaufbau.');
  const headers = await decryptHeaders(parts.headerBlock, privateKey, passphrase);
  const body = await decryptMessage(parts.bodyBlock, privateKey, passphrase);
  return { headers, body };
}
