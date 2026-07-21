import * as openpgp from 'openpgp';
import * as crypto from 'crypto';

export interface HybridKeyPair {
  publicKey: string;
  privateKey: string;
  pqPublicKey: string;
  pqPrivateKey: string;
  type: 'hybrid';
  /** FIPS-203 ML-KEM-768, oder Legacy-Tag für ältere secp521r1-Nachrichten. */
  pqAlgorithm: 'ml-kem-768' | 'secp521r1-classical-secondary';
}

export interface HybridEncryptionResult {
  ciphertext: string;
  wrappedKeys: string[];
}

/**
 * Hybridverschlüsselung: klassisches OpenPGP (Curve25519) + FIPS-203 ML-KEM-768
 * (`@noble/post-quantum`) als echte gitterbasierte Post-Quantum-Schicht.
 *
 * Legacy: Ältere Payloads mit `alg: secp521r1-interim` / `secp521r1-classical-secondary`
 * nutzen ECDH auf secp521r1 — das ist eine zusätzliche klassische Schicht
 * (Defense in Depth), KEINE Post-Quantum-Sicherheit. Entschlüsselung bleibt
 * aus Kompatibilität erhalten; neue Schlüsselpaare erfordern ML-KEM.
 */

type MlKemApi = {
  keygen: (seed?: Uint8Array) => { publicKey: Uint8Array; secretKey: Uint8Array };
  encapsulate: (publicKey: Uint8Array) => { cipherText: Uint8Array; sharedSecret: Uint8Array };
  decapsulate: (cipherText: Uint8Array, secretKey: Uint8Array) => Uint8Array;
};

const dynamicImport = new Function('m', 'return import(m)') as (
  m: string,
) => Promise<{ ml_kem768: MlKemApi }>;

let mlKemCache: MlKemApi | null | undefined;

async function loadMlKem(): Promise<MlKemApi> {
  if (mlKemCache) return mlKemCache;
  if (mlKemCache === null) {
    throw new Error('ML-KEM nicht verfügbar — @noble/post-quantum installieren');
  }
  try {
    const mod = await dynamicImport('@noble/post-quantum/ml-kem.js');
    if (!mod.ml_kem768) throw new Error('ml_kem768 export fehlt');
    mlKemCache = mod.ml_kem768;
    return mlKemCache;
  } catch (err) {
    mlKemCache = null;
    throw new Error(
      `ML-KEM-Laden fehlgeschlagen (${(err as Error).message}). npm i @noble/post-quantum`,
    );
  }
}

/** Legacy ECDH — nur für Entschlüsselung alter Nachrichten; keine PQ-Zusage. */
function generateClassicalSecondaryShare(): { publicKey: Buffer; privateKey: Buffer } {
  const ecdh = crypto.createECDH('secp521r1');
  ecdh.generateKeys();
  return { publicKey: ecdh.getPublicKey(), privateKey: ecdh.getPrivateKey() };
}

export async function generateHybridKeyPair(
  name: string,
  email: string,
  passphrase: string,
): Promise<HybridKeyPair> {
  const classical = await openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ name, email }],
    passphrase,
    format: 'armored',
  });

  const mlkem = await loadMlKem();
  const pq = mlkem.keygen();
  return {
    publicKey: classical.publicKey,
    privateKey: classical.privateKey,
    pqPublicKey: Buffer.from(pq.publicKey).toString('base64'),
    pqPrivateKey: Buffer.from(pq.secretKey).toString('base64'),
    type: 'hybrid',
    pqAlgorithm: 'ml-kem-768',
  };
}

export async function hybridEncrypt(
  plaintext: string,
  recipientClassicalKey: string,
  recipientPQPublicKey: string,
): Promise<HybridEncryptionResult> {
  const classicalResult = await openpgp.encrypt({
    message: await openpgp.createMessage({ text: plaintext }),
    encryptionKeys: [await openpgp.readKey({ armoredKey: recipientClassicalKey })],
    format: 'armored',
  });

  const sessionKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const mlkem = await loadMlKem();
  const pqPub = new Uint8Array(Buffer.from(recipientPQPublicKey, 'base64'));
  const { cipherText: kemCiphertext, sharedSecret } = mlkem.encapsulate(pqPub);
  const wrappingKey = Buffer.from(
    crypto.hkdfSync('sha512', Buffer.from(sharedSecret), Buffer.alloc(0), 'privmail-mlkem-wrap', 32),
  );
  const wrapIv = crypto.randomBytes(12);
  const wrapCipher = crypto.createCipheriv('aes-256-gcm', wrappingKey, wrapIv);
  const wrappedKey = Buffer.concat([wrapCipher.update(sessionKey), wrapCipher.final()]);
  const wrapTag = wrapCipher.getAuthTag();
  const pqPayload = {
    v: 2,
    alg: 'ml-kem-768',
    kem_ct: Buffer.from(kemCiphertext).toString('base64'),
    wrapped_key: wrappedKey.toString('base64'),
    wrap_iv: wrapIv.toString('base64'),
    wrap_tag: wrapTag.toString('base64'),
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
  return { ciphertext: classicalResult as string, wrappedKeys: [JSON.stringify(pqPayload)] };
}

export async function hybridDecrypt(
  hybridCiphertext: string,
  wrappedKeys: string[],
  classicalPrivateKey: string,
  pqPrivateKey: string,
  passphrase: string,
): Promise<string> {
  try {
    const decKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: classicalPrivateKey }),
      passphrase,
    });
    const message = await openpgp.readMessage({ armoredMessage: hybridCiphertext });
    const { data } = await openpgp.decrypt({ message, decryptionKeys: decKey });
    return data as string;
  } catch {
    if (wrappedKeys.length === 0) throw new Error('Hybrid decryption failed: no PQ wrapped keys');
    const pqPayload = JSON.parse(wrappedKeys[0]) as {
      v?: number;
      alg?: string;
      kem_ct?: string;
      ephemeral_pk?: string;
      wrapped_key: string;
      wrap_iv?: string;
      wrap_tag?: string;
      iv: string;
      tag: string;
      ciphertext: string;
    };

    if ((pqPayload.v === 2 || pqPayload.alg === 'ml-kem-768') && pqPayload.kem_ct) {
      const mlkem = await loadMlKem();
      const secretKey = new Uint8Array(Buffer.from(pqPrivateKey, 'base64'));
      const kemCt = new Uint8Array(Buffer.from(pqPayload.kem_ct, 'base64'));
      const sharedSecret = mlkem.decapsulate(kemCt, secretKey);
      const wrappingKey = Buffer.from(
        crypto.hkdfSync('sha512', Buffer.from(sharedSecret), Buffer.alloc(0), 'privmail-mlkem-wrap', 32),
      );
      const unwrapCipher = crypto.createDecipheriv(
        'aes-256-gcm',
        wrappingKey,
        Buffer.from(pqPayload.wrap_iv!, 'base64'),
      );
      unwrapCipher.setAuthTag(Buffer.from(pqPayload.wrap_tag!, 'base64'));
      const sessionKey = Buffer.concat([
        unwrapCipher.update(Buffer.from(pqPayload.wrapped_key, 'base64')),
        unwrapCipher.final(),
      ]);
      const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey, Buffer.from(pqPayload.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(pqPayload.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(pqPayload.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    }

    // Legacy: secp521r1 ECDH — zusätzliche klassische Schicht, kein PQ.
    const legacyAlg = pqPayload.alg === 'secp521r1-interim' || pqPayload.alg === 'secp521r1-classical-secondary';
    if (!pqPayload.ephemeral_pk || (!legacyAlg && pqPayload.v !== 1)) {
      throw new Error('Hybrid decryption failed: unsupported payload');
    }
    const ecdh = crypto.createECDH('secp521r1');
    ecdh.setPrivateKey(Buffer.from(pqPrivateKey, 'base64'));
    const sharedSecret = ecdh.computeSecret(Buffer.from(pqPayload.ephemeral_pk, 'base64'));
    const wrappingKey = Buffer.from(
      crypto.hkdfSync('sha512', sharedSecret, Buffer.alloc(0), 'privmail-pq-wrap', 32),
    );
    const iv = Buffer.from(pqPayload.iv, 'base64');
    const unwrapCipher = crypto.createDecipheriv('aes-256-gcm', wrappingKey, iv);
    const sessionKey = Buffer.concat([
      unwrapCipher.update(Buffer.from(pqPayload.wrapped_key, 'base64')),
      unwrapCipher.final(),
    ]);
    const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey, iv);
    decipher.setAuthTag(Buffer.from(pqPayload.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(pqPayload.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}

export function computeKeyFingerprint(publicKey: string): string {
  const normalized = publicKey.replace(/\r\n/g, '\n').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 40);
}

/** Exported for tests that need to build legacy classical-secondary material. */
export const _testOnly = { generateClassicalSecondaryShare };
