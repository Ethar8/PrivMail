import { query } from '../database/connection';

export interface WebAuthnCredential {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_type: string | null;
  created_at: Date;
}

export const CredentialModel = {
  async create(data: {
    userId: string;
    credentialId: string;
    publicKey: string;
    counter: number;
    deviceType?: string;
  }): Promise<WebAuthnCredential> {
    const { rows } = await query<WebAuthnCredential>(
      `INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, device_type)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.userId, data.credentialId, data.publicKey, data.counter, data.deviceType ?? null],
    );
    return rows[0];
  },

  async findByCredentialId(credentialId: string): Promise<WebAuthnCredential | null> {
    const { rows } = await query<WebAuthnCredential>(
      `SELECT * FROM webauthn_credentials WHERE credential_id = $1`,
      [credentialId],
    );
    return rows[0] ?? null;
  },

  async listByUser(userId: string): Promise<WebAuthnCredential[]> {
    const { rows } = await query<WebAuthnCredential>(
      `SELECT * FROM webauthn_credentials WHERE user_id = $1`,
      [userId],
    );
    return rows;
  },

  async updateCounter(id: string, counter: number): Promise<void> {
    await query(`UPDATE webauthn_credentials SET counter = $2 WHERE id = $1`, [id, counter]);
  },
};
