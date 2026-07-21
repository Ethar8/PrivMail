import { randomBytes } from 'crypto';
import { query } from '../database/connection';
import { config } from '../config/config';

export interface OidcClientRow {
  client_id: string;
  client_secret: string;
  name: string;
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface OidcClientPublic {
  clientId: string;
  name: string;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  scope: string;
  isActive: boolean;
  createdAt: string;
  /** Only returned once on create/rotate. */
  clientSecret?: string;
}

function toPublic(row: OidcClientRow, includeSecret = false): OidcClientPublic {
  return {
    clientId: row.client_id,
    name: row.name,
    redirectUris: row.redirect_uris,
    postLogoutRedirectUris: row.post_logout_redirect_uris,
    scope: row.scope,
    isActive: row.is_active,
    createdAt: new Date(row.created_at).toISOString(),
    ...(includeSecret ? { clientSecret: row.client_secret } : {}),
  };
}

/** Metadata shape expected by node-oidc-provider Client model. */
export function toProviderClient(row: OidcClientRow) {
  return {
    client_id: row.client_id,
    client_secret: row.client_secret,
    redirect_uris: row.redirect_uris,
    post_logout_redirect_uris: row.post_logout_redirect_uris,
    grant_types: row.grant_types,
    response_types: row.response_types,
    token_endpoint_auth_method: row.token_endpoint_auth_method,
    scope: row.scope,
  };
}

export async function listOidcClients(): Promise<OidcClientPublic[]> {
  const { rows } = await query<OidcClientRow>(
    `SELECT * FROM oidc_clients ORDER BY name ASC`,
  );
  return rows.map((r) => toPublic(r));
}

export async function getOidcClient(clientId: string): Promise<OidcClientRow | null> {
  const { rows } = await query<OidcClientRow>(
    `SELECT * FROM oidc_clients WHERE client_id = $1`,
    [clientId],
  );
  return rows[0] ?? null;
}

export async function listActiveProviderClients() {
  const { rows } = await query<OidcClientRow>(
    `SELECT * FROM oidc_clients WHERE is_active = true`,
  );
  return rows.map(toProviderClient);
}

export async function createOidcClient(input: {
  clientId?: string;
  name: string;
  redirectUris: string[];
  postLogoutRedirectUris?: string[];
  scope?: string;
}): Promise<OidcClientPublic> {
  const clientId = input.clientId?.trim() || `client_${randomBytes(8).toString('hex')}`;
  const clientSecret = randomBytes(32).toString('base64url');
  const { rows } = await query<OidcClientRow>(
    `INSERT INTO oidc_clients (
       client_id, client_secret, name, redirect_uris, post_logout_redirect_uris, scope
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      clientId,
      clientSecret,
      input.name.trim(),
      input.redirectUris,
      input.postLogoutRedirectUris ?? [],
      input.scope ?? 'openid profile email offline_access',
    ],
  );
  return toPublic(rows[0], true);
}

export async function updateOidcClient(
  clientId: string,
  patch: {
    name?: string;
    redirectUris?: string[];
    postLogoutRedirectUris?: string[];
    scope?: string;
    isActive?: boolean;
  },
): Promise<OidcClientPublic | null> {
  const existing = await getOidcClient(clientId);
  if (!existing) return null;
  const { rows } = await query<OidcClientRow>(
    `UPDATE oidc_clients SET
       name = $2,
       redirect_uris = $3,
       post_logout_redirect_uris = $4,
       scope = $5,
       is_active = $6,
       updated_at = NOW()
     WHERE client_id = $1
     RETURNING *`,
    [
      clientId,
      patch.name ?? existing.name,
      patch.redirectUris ?? existing.redirect_uris,
      patch.postLogoutRedirectUris ?? existing.post_logout_redirect_uris,
      patch.scope ?? existing.scope,
      patch.isActive ?? existing.is_active,
    ],
  );
  return toPublic(rows[0]);
}

export async function rotateOidcClientSecret(clientId: string): Promise<OidcClientPublic | null> {
  const secret = randomBytes(32).toString('base64url');
  const { rows } = await query<OidcClientRow>(
    `UPDATE oidc_clients SET client_secret = $2, updated_at = NOW()
     WHERE client_id = $1 RETURNING *`,
    [clientId, secret],
  );
  if (!rows[0]) return null;
  return toPublic(rows[0], true);
}

export async function deleteOidcClient(clientId: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM oidc_clients WHERE client_id = $1`, [clientId]);
  return (rowCount ?? 0) > 0;
}

/**
 * Seeds Vaultwarden + Immich clients from env if they don't exist yet.
 * Secrets from env are used when provided; otherwise a secret is generated once.
 */
export async function seedDefaultOidcClients(): Promise<void> {
  const vaultHost = config.vaultHost;
  const photosHost = config.photosHost;
  const vaultId = config.oidc.vaultwardenClientId;
  const vaultSecret = config.oidc.vaultwardenClientSecret;
  const immichId = config.oidc.immichClientId;
  const immichSecret = config.oidc.immichClientSecret;

  const defaults: {
    clientId: string;
    secret: string;
    name: string;
    redirectUris: string[];
  }[] = [
    {
      clientId: vaultId,
      secret: vaultSecret,
      name: 'Vaultwarden',
      redirectUris: [`https://${vaultHost}/identity/connect/oidc-signin`],
    },
    {
      clientId: immichId,
      secret: immichSecret,
      name: 'Immich',
      // HTTPS-only redirect URIs (OIDC "web" clients). Mobile uses Immich's
      // mobile-redirect override on the photos host.
      redirectUris: [
        `https://${photosHost}/auth/login`,
        `https://${photosHost}/user-settings`,
        `https://${photosHost}/api/oauth/mobile-redirect`,
      ],
    },
  ];

  for (const d of defaults) {
    const existing = await getOidcClient(d.clientId);
    if (existing) continue;
    const secret = d.secret || randomBytes(32).toString('base64url');
    await query(
      `INSERT INTO oidc_clients (client_id, client_secret, name, redirect_uris)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (client_id) DO NOTHING`,
      [d.clientId, secret, d.name, d.redirectUris],
    );
  }
}

export async function recordOidcLogin(
  clientId: string | undefined,
  accountId: string,
  success: boolean,
): Promise<void> {
  await query(
    `INSERT INTO oidc_login_audit (client_id, account_id, success) VALUES ($1, $2, $3)`,
    [clientId ?? null, accountId, success],
  );
}

export async function getLastSuccessfulOidcLogin(): Promise<string | null> {
  const { rows } = await query<{ created_at: Date }>(
    `SELECT created_at FROM oidc_login_audit
     WHERE success = true
     ORDER BY created_at DESC
     LIMIT 1`,
  );
  return rows[0] ? new Date(rows[0].created_at).toISOString() : null;
}
