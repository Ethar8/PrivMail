import {
  generateVerifier,
  getServerChallenge,
  verifyClientProof,
  storeSrpVerifier,
  SRP_N,
} from '../../utils/crypto/srp';
import { clearSrpChallengeStore } from '../../utils/crypto/srp-challenge-store';
import * as crypto from 'crypto';

/**
 * Minimal client-side SRP computation mirroring frontend/web/src/lib/srp.ts
 * (kept local so backend unit tests do not depend on the Next app).
 */
function clientProcess(
  identity: string,
  password: string,
  saltHex: string,
  Bstr: string,
  a: bigint,
  A: bigint,
): { Mhex: string; Skey: Buffer } {
  const N = SRP_N;
  const g = 2n;
  const N_PAD = 256;
  const sha256 = (...bufs: Buffer[]) => {
    const h = crypto.createHash('sha256');
    for (const b of bufs) h.update(b);
    return h.digest();
  };
  const toBuf = (n: bigint, pad?: number) => {
    let hex = n.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    const buf = Buffer.from(hex, 'hex');
    if (pad && buf.length < pad) {
      const p = Buffer.alloc(pad);
      buf.copy(p, pad - buf.length);
      return p;
    }
    return buf;
  };
  const toBI = (b: Buffer) => BigInt('0x' + b.toString('hex'));
  const modPow = (base: bigint, exp: bigint, mod: bigint) => {
    let r = 1n;
    let b = base % mod;
    let e = exp;
    while (e > 0n) {
      if (e & 1n) r = (r * b) % mod;
      b = (b * b) % mod;
      e >>= 1n;
    }
    return r;
  };
  const xor = (x: Buffer, y: Buffer) => {
    const out = Buffer.alloc(Math.min(x.length, y.length));
    for (let i = 0; i < out.length; i++) out[i] = x[i] ^ y[i];
    return out;
  };

  const salt = Buffer.from(saltHex, 'hex');
  const B = BigInt(Bstr);
  const k = toBI(sha256(toBuf(N, N_PAD), toBuf(g)));
  const u = toBI(sha256(toBuf(A, N_PAD), toBuf(B, N_PAD)));
  const inner = sha256(Buffer.from(identity.toLowerCase() + ':' + password, 'utf8'));
  const x = toBI(sha256(salt, inner));
  const gx = modPow(2n, x, N);
  const base = (B - ((k * gx) % N) + N) % N;
  const S = modPow(base, a + u * x, N);
  const Skey = sha256(toBuf(S, N_PAD));
  const M = sha256(
    xor(sha256(toBuf(N, N_PAD)), sha256(toBuf(g))),
    sha256(Buffer.from(identity.toLowerCase(), 'utf8')),
    salt,
    toBuf(A, N_PAD),
    toBuf(B, N_PAD),
    Skey,
  );
  return { Mhex: M.toString('hex'), Skey };
}

describe('SRP-6a RFC 5054 modulus', () => {
  it('N is the full 2048-bit odd prime group (sanity)', () => {
    expect(SRP_N & 1n).toBe(1n);
    expect(SRP_N.toString(16).length).toBeGreaterThanOrEqual(512); // 2048 bit hex
    for (const p of [3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n]) {
      expect(SRP_N % p).not.toBe(0n);
    }
  });
});

describe('SRP client↔server handshake (in-memory)', () => {
  const email = 'srp-vector@privmail.test';
  const password = 'TestPassw0rd-SRP!';

  beforeEach(() => clearSrpChallengeStore());

  it('agrees on proofs when b is cached under challengeId', async () => {
    // Mock DB via monkey-patching query is heavy; exercise pure math + store:
    const { salt, verifier } = generateVerifier(email, password);
    // Simulate DB row by calling store functions through a fake challenge:
    // We reimplement getServerChallenge math inline using the same modules.
    const { storeSrpChallengeSecret, takeSrpChallengeSecret } = await import(
      '../../utils/crypto/srp-challenge-store'
    );

    const secret = crypto.randomBytes(32);
    const b = BigInt('0x' + secret.toString('hex')) % SRP_N;
    const sha256 = (...bufs: Buffer[]) => {
      const h = crypto.createHash('sha256');
      for (const x of bufs) h.update(x);
      return h.digest();
    };
    const toBuf = (n: bigint, pad?: number) => {
      let hex = n.toString(16);
      if (hex.length % 2) hex = '0' + hex;
      const buf = Buffer.from(hex, 'hex');
      if (pad && buf.length < pad) {
        const p = Buffer.alloc(pad);
        buf.copy(p, pad - buf.length);
        return p;
      }
      return buf;
    };
    const toBI = (buf: Buffer) => BigInt('0x' + buf.toString('hex'));
    const modPow = (base: bigint, exp: bigint, mod: bigint) => {
      let r = 1n;
      let bb = base % mod;
      let e = exp;
      while (e > 0n) {
        if (e & 1n) r = (r * bb) % mod;
        bb = (bb * bb) % mod;
        e >>= 1n;
      }
      return r;
    };
    const k = toBI(sha256(toBuf(SRP_N, 256), toBuf(2n)));
    const B = (k * verifier + modPow(2n, b, SRP_N)) % SRP_N;
    const challengeId = crypto.randomBytes(16).toString('hex');
    storeSrpChallengeSecret(challengeId, toBuf(b).toString('hex'));

    const aSecret = crypto.randomBytes(32);
    const a = BigInt('0x' + aSecret.toString('hex')) % SRP_N;
    const A = modPow(2n, a, SRP_N);
    const { Mhex, Skey } = clientProcess(email, password, salt.toString('hex'), B.toString(), a, A);

    // Server-side verify math (same as verifyClientProof)
    const taken = takeSrpChallengeSecret(challengeId);
    expect(taken).toBeTruthy();
    const b2 = BigInt('0x' + taken!);
    const u = toBI(sha256(toBuf(A, 256), toBuf(B, 256)));
    const S = modPow(A * modPow(verifier, u, SRP_N), b2, SRP_N);
    const SkeyServer = sha256(toBuf(S, 256));
    expect(SkeyServer.equals(Skey)).toBe(true);

    const xor = (x: Buffer, y: Buffer) => {
      const out = Buffer.alloc(Math.min(x.length, y.length));
      for (let i = 0; i < out.length; i++) out[i] = x[i] ^ y[i];
      return out;
    };
    const Mserver = sha256(
      xor(sha256(toBuf(SRP_N, 256)), sha256(toBuf(2n))),
      sha256(Buffer.from(email.toLowerCase(), 'utf8')),
      salt,
      toBuf(A, 256),
      toBuf(B, 256),
      SkeyServer,
    );
    expect(Mserver.toString('hex')).toBe(Mhex);

    const serverProof = sha256(toBuf(A, 256), Mserver, SkeyServer).toString('hex');
    const clientExpected = sha256(toBuf(A, 256), Buffer.from(Mhex, 'hex'), Skey).toString('hex');
    expect(serverProof).toBe(clientExpected);

    // Replay: secret already consumed
    expect(takeSrpChallengeSecret(challengeId)).toBeNull();
  });

  it('generateVerifier is deterministic for fixed salt', () => {
    const salt = Buffer.alloc(32, 0x42);
    const a = generateVerifier(email, password, salt);
    const b = generateVerifier(email, password, salt);
    expect(a.verifier).toBe(b.verifier);
  });
});

// Silence unused imports when DB-backed helpers are present for typing/export checks
void getServerChallenge;
void verifyClientProof;
void storeSrpVerifier;
