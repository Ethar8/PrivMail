import * as crypto from 'crypto';
import { query } from '../../database/connection';
import { storeSrpChallengeSecret, takeSrpChallengeSecret } from './srp-challenge-store';

export interface SrpEnrollment {
  srpSalt: string;
  srpVerifier: string;
}

/**
 * SRP-6a (Secure Remote Password) – Zero-Knowledge Password Proof
 *
 * Ersetzt/ergänzt den bestehenden bcrypt-Login durch einen SRP-Handshake,
 * bei dem das Klartext-Passwort NIE an den Server übertragen wird.
 *
 * Bestehende bcrypt-Passwort-Hashes bleiben erhalten; Nutzer werden beim
 * nächsten erfolgreichen Login automatisch auf SRP migriert.
 *
 * N = 2048-bit Group aus RFC 5054 Appendix A (vollständig, nicht gekürzt)
 * g = 2
 * k = SHA256(N || g)
 * Hash = SHA256
 *
 * Sanity (kein Ersatz für die RFC-Quelle): N ist ungerade (N & 1 === 1) und
 * nicht durch kleine Primzahlen 3,5,7,11 teilbar — siehe Unit-Test.
 */

// RFC 5054 Appendix A, §3 „2048-bit Group“ — exakt, ohne Null-Padding/Kürzung.
const N_BYTES = `
AC6BDB41 324A9A9B F166DE5E 1389582F AF72B665 1987EE07 FC319294
3DB56050 A37329CB B4A099ED 8193E075 7767A13D D52312AB 4B03310D
CD7F48A9 DA04FD50 E8083969 EDB767B0 CF609517 9A163AB3 661A05FB
D5FAAAE8 2918A996 2F0B93B8 55F97993 EC975EEA A80D740A DBF4FF74
7359D041 D5C33EA7 1D281E44 6B14773B CA97B43A 23FB8016 76BD207A
436C6481 F1D2B907 8717461A 5B9D32E6 88F87748 544523B5 24B0D57D
5EA77A27 75D2ECFA 032CFBDB F52FB378 61602790 04E57AE6 AF874E73
03CE5329 9CCC041C 7BC308D8 2A5698F3 A8D0C382 71AE35F8 E9DBFBB6
94B5C803 D89F7AE4 35DE236D 525F5475 9B65E372 FCD68EF2 0FA7111F
9E4AFF73
`.replace(/\s+/g, '');

export const SRP_N = BigInt('0x' + N_BYTES);
export const SRP_G = 2n;
const N = SRP_N;
const g = SRP_G;
/** Byte-Länge von N (2048 bit → 256 bytes) für gepaddete Hashes. */
const N_PAD = 256;

function sha256(...buffers: Buffer[]): Buffer {
  const hash = crypto.createHash('sha256');
  for (const b of buffers) hash.update(b);
  return hash.digest();
}

function bigIntToBuffer(n: bigint, padLen?: number): Buffer {
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const buf = Buffer.from(hex, 'hex');
  if (padLen && buf.length < padLen) {
    const padded = Buffer.alloc(padLen, 0);
    buf.copy(padded, padLen - buf.length);
    return padded;
  }
  return buf;
}

function bufferToBigInt(buf: Buffer): bigint {
  return BigInt('0x' + buf.toString('hex'));
}

function randomSalt(): Buffer {
  return crypto.randomBytes(32);
}

function computeK(): bigint {
  return bufferToBigInt(sha256(bigIntToBuffer(N, N_PAD), bigIntToBuffer(g)));
}

function computeX(salt: Buffer, identity: string, password: string): bigint {
  const inner = sha256(Buffer.from(identity.toLowerCase() + ':' + password, 'utf8'));
  return bufferToBigInt(sha256(salt, inner));
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (exponent === 0n) return 1n;
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

export function generateVerifier(
  identity: string,
  password: string,
  salt?: Buffer,
): { salt: Buffer; verifier: bigint } {
  const s = salt ?? randomSalt();
  const x = computeX(s, identity, password);
  const v = modPow(g, x, N);
  return { salt: s, verifier: v };
}

/**
 * Erzeugt Server-Challenge (B) und speichert den geheimen Exponenten b
 * unter challengeId (kurzlebiger Cache). Der challengeId ist NICHT b.
 */
export async function getServerChallenge(
  email: string,
): Promise<{ challengeId: string; salt: string; serverPublicKey: string } | null> {
  const { rows } = await query<{ srp_salt: string; srp_verifier: string }>(
    `SELECT srp_salt, srp_verifier FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );
  const user = rows[0];
  if (!user?.srp_salt || !user?.srp_verifier) return null;

  const secret = crypto.randomBytes(32);
  const b = bufferToBigInt(secret) % N;
  const k = computeK();
  const v = BigInt(user.srp_verifier);
  const B = (k * v + modPow(g, b, N)) % N;

  const challengeId = crypto.randomBytes(16).toString('hex');
  storeSrpChallengeSecret(challengeId, bigIntToBuffer(b).toString('hex'));

  return {
    challengeId,
    salt: user.srp_salt,
    serverPublicKey: B.toString(),
  };
}

export async function verifyClientProof(
  email: string,
  clientPublicKey: string,
  clientProof: string,
  challengeId: string,
): Promise<{ valid: boolean; serverProof: string; userId: string } | null> {
  const serverSecret = takeSrpChallengeSecret(challengeId);
  if (!serverSecret) return null;

  const { rows } = await query<{ id: string; srp_salt: string; srp_verifier: string }>(
    `SELECT id, srp_salt, srp_verifier FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );
  const user = rows[0];
  if (!user?.srp_salt) return null;

  const A = BigInt(clientPublicKey);
  const b = bufferToBigInt(Buffer.from(serverSecret, 'hex'));
  const k = computeK();
  const v = BigInt(user.srp_verifier);
  const B = (k * v + modPow(g, b, N)) % N;
  const salt = Buffer.from(user.srp_salt, 'hex');

  const u = bufferToBigInt(sha256(bigIntToBuffer(A, N_PAD), bigIntToBuffer(B, N_PAD)));
  const S = modPow(A * modPow(v, u, N), b, N);
  const Skey = sha256(bigIntToBuffer(S, N_PAD));

  const Nbuf = bigIntToBuffer(N, N_PAD);
  const gbuf = bigIntToBuffer(g);
  const identityHash = sha256(Buffer.from(email.toLowerCase(), 'utf8'));
  const M = sha256(
    xor(sha256(Nbuf), sha256(gbuf)),
    identityHash,
    salt,
    bigIntToBuffer(A, N_PAD),
    bigIntToBuffer(B, N_PAD),
    Skey,
  );

  const expected = M.toString('hex');
  if (clientProof !== expected) return null;

  const Abuf = bigIntToBuffer(A, N_PAD);
  const serverProof = sha256(Abuf, M, Skey).toString('hex');

  return { valid: true, serverProof, userId: user.id };
}

function xor(a: Buffer, b: Buffer): Buffer {
  const len = Math.min(a.length, b.length);
  const result = Buffer.alloc(len);
  for (let i = 0; i < len; i++) result[i] = a[i] ^ b[i];
  return result;
}

export async function storeSrpVerifier(
  userId: string,
  salt: Buffer,
  verifier: bigint,
): Promise<void> {
  await query(
    `UPDATE users SET srp_salt = $2, srp_verifier = $3 WHERE id = $1`,
    [userId, salt.toString('hex'), verifier.toString()],
  );
}
