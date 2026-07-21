/**
 * Persistent RSA signing keys for node-oidc-provider (JWKS).
 * Uses Node's built-in crypto — key material only; all token signing
 * is performed by oidc-provider / jose, not by custom code.
 */
import { generateKeyPairSync } from 'crypto';
import { query } from '../database/connection';

interface JwkRecord {
  jwks: { keys: Record<string, unknown>[] };
}

export async function loadOrCreateOidcJwks(): Promise<{ keys: Record<string, unknown>[] }> {
  const { rows } = await query<JwkRecord>(`SELECT jwks FROM oidc_jwks WHERE id = 1`);
  if (rows[0]?.jwks?.keys?.length) {
    return rows[0].jwks;
  }

  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const jwk = privateKey.export({ format: 'jwk' }) as Record<string, unknown>;
  jwk.kid = `privmail-${Date.now().toString(36)}`;
  jwk.use = 'sig';
  jwk.alg = 'RS256';

  const jwks = { keys: [jwk] };
  await query(
    `INSERT INTO oidc_jwks (id, jwks) VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET jwks = EXCLUDED.jwks, updated_at = NOW()`,
    [JSON.stringify(jwks)],
  );
  return jwks;
}
