import * as crypto from 'crypto';

/**
 * SRP-6a Client – N = 2048-bit Group aus RFC 5054 Appendix A (vollständig).
 * Muss bit-identisch zu backend/src/utils/crypto/srp.ts sein.
 */

// RFC 5054 Appendix A, §3 „2048-bit Group“
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
const N_PAD = 256;

function sha256(...buffers: Uint8Array[]): Uint8Array {
  const hash = crypto.createHash('sha256');
  for (const b of buffers) hash.update(Buffer.from(b));
  return new Uint8Array(hash.digest());
}

function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const len = Math.min(a.length, b.length);
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) result[i] = a[i] ^ b[i];
  return result;
}

function bigIntToBytes(n: bigint, padLen?: number): Uint8Array {
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  if (padLen && bytes.length < padLen) {
    const padded = new Uint8Array(padLen);
    padded.set(bytes, padLen - bytes.length);
    return padded;
  }
  return bytes;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  return BigInt('0x' + Buffer.from(bytes).toString('hex'));
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
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

function computeK(): bigint {
  return bytesToBigInt(sha256(bigIntToBytes(N, N_PAD), bigIntToBytes(g)));
}

function computeX(salt: Uint8Array, identity: string, password: string): bigint {
  const inner = sha256(new TextEncoder().encode(identity.toLowerCase() + ':' + password));
  return bytesToBigInt(sha256(salt, inner));
}

function generateClientSecret(): Uint8Array {
  return new Uint8Array(crypto.randomBytes(32));
}

export class SrpClient {
  private identity: string;
  private password: string;
  private a: bigint;
  private A: bigint;
  private salt: Uint8Array | null = null;
  /** Client-Beweis M aus processChallenge — für verifyServerProof. */
  private M: Uint8Array | null = null;

  constructor(identity: string, password: string) {
    this.identity = identity.toLowerCase();
    this.password = password;
    const secret = generateClientSecret();
    this.a = bytesToBigInt(secret) % N;
    this.A = modPow(g, this.a, N);
  }

  getClientPublicKey(): string {
    return this.A.toString();
  }

  async processChallenge(
    saltB64: string,
    serverPublicKey: string,
  ): Promise<{ clientProof: string; sharedKey: Uint8Array }> {
    this.salt = new Uint8Array(Buffer.from(saltB64, 'hex'));
    const B = BigInt(serverPublicKey);
    const k = computeK();

    if (B % N === 0n) throw new Error('Invalid server public key');

    const u = bytesToBigInt(sha256(bigIntToBytes(this.A, N_PAD), bigIntToBytes(B, N_PAD)));
    if (u === 0n) throw new Error('Invalid u parameter');

    const x = computeX(this.salt, this.identity, this.password);
    // Modular: (B - k·g^x) mod N — negative Basen brechen sonst die Client-S-Berechnung.
    const gx = modPow(g, x, N);
    const base = (B - ((k * gx) % N) + N) % N;
    if (base === 0n) throw new Error('Invalid SRP session base');
    const S = modPow(base, this.a + u * x, N);
    const Skey = sha256(bigIntToBytes(S, N_PAD));

    const Nbuf = bigIntToBytes(N, N_PAD);
    const gbuf = bigIntToBytes(g);
    const identityHash = sha256(new TextEncoder().encode(this.identity));
    this.M = sha256(
      xor(sha256(Nbuf), sha256(gbuf)),
      identityHash,
      this.salt,
      bigIntToBytes(this.A, N_PAD),
      bigIntToBytes(B, N_PAD),
      Skey,
    );

    return {
      clientProof: Buffer.from(this.M).toString('hex'),
      sharedKey: Skey,
    };
  }

  verifyServerProof(serverProof: string, sharedKey: Uint8Array): boolean {
    if (!this.M) return false;
    const Abuf = bigIntToBytes(this.A, N_PAD);
    const expected = Buffer.from(sha256(Abuf, this.M, sharedKey)).toString('hex');
    return serverProof === expected;
  }
}
