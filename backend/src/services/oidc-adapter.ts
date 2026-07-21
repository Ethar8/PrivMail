/**
 * PostgreSQL Adapter for node-oidc-provider.
 * Persists Authorization Codes, Tokens, Sessions, Grants, and Clients.
 * Based on the official panva adapter contract — no custom crypto.
 */
import { query } from '../database/connection';
import type { Adapter, AdapterPayload } from 'oidc-provider';

const grantable = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
]);

function expiresAt(expiresIn?: number): Date | null {
  if (!expiresIn) return null;
  return new Date(Date.now() + expiresIn * 1000);
}

export function createOidcAdapter(): new (name: string) => Adapter {
  return class PostgresAdapter implements Adapter {
    constructor(public name: string) {}

    async upsert(id: string, payload: AdapterPayload, expiresIn?: number): Promise<void> {
      const grantId = typeof payload.grantId === 'string' ? payload.grantId : null;
      const userCode = typeof payload.userCode === 'string' ? payload.userCode : null;
      const uid = typeof payload.uid === 'string' ? payload.uid : null;

      await query(
        `INSERT INTO oidc_payloads (id, model, payload, expires_at, grant_id, user_code, uid)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
         ON CONFLICT (id, model) DO UPDATE SET
           payload = EXCLUDED.payload,
           expires_at = EXCLUDED.expires_at,
           grant_id = EXCLUDED.grant_id,
           user_code = EXCLUDED.user_code,
           uid = EXCLUDED.uid,
           consumed_at = NULL`,
        [id, this.name, JSON.stringify(payload), expiresAt(expiresIn), grantId, userCode, uid],
      );
    }

    async find(id: string): Promise<AdapterPayload | undefined> {
      const { rows } = await query<{
        payload: AdapterPayload;
        expires_at: Date | null;
        consumed_at: Date | null;
      }>(
        `SELECT payload, expires_at, consumed_at FROM oidc_payloads
         WHERE id = $1 AND model = $2`,
        [id, this.name],
      );
      const row = rows[0];
      if (!row) return undefined;
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        await this.destroy(id);
        return undefined;
      }
      const payload = row.payload;
      if (row.consumed_at) {
        (payload as { consumed?: number }).consumed = Math.floor(
          new Date(row.consumed_at).getTime() / 1000,
        );
      }
      return payload;
    }

    async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
      const { rows } = await query<{ id: string }>(
        `SELECT id FROM oidc_payloads WHERE user_code = $1 AND model = $2 LIMIT 1`,
        [userCode, this.name],
      );
      if (!rows[0]) return undefined;
      return this.find(rows[0].id);
    }

    async findByUid(uid: string): Promise<AdapterPayload | undefined> {
      const { rows } = await query<{ id: string }>(
        `SELECT id FROM oidc_payloads WHERE uid = $1 AND model = $2 LIMIT 1`,
        [uid, this.name],
      );
      if (!rows[0]) return undefined;
      return this.find(rows[0].id);
    }

    async destroy(id: string): Promise<void> {
      await query(`DELETE FROM oidc_payloads WHERE id = $1 AND model = $2`, [id, this.name]);
    }

    async revokeByGrantId(grantId: string): Promise<void> {
      if (!grantable.has(this.name)) return;
      await query(`DELETE FROM oidc_payloads WHERE grant_id = $1`, [grantId]);
    }

    async consume(id: string): Promise<void> {
      await query(
        `UPDATE oidc_payloads SET consumed_at = NOW() WHERE id = $1 AND model = $2`,
        [id, this.name],
      );
    }
  };
}
