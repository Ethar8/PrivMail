/**
 * PrivMail OIDC Provider — powered exclusively by `oidc-provider`
 * (node-oidc-provider). No custom token/signature/PKCE implementation.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type Provider from 'oidc-provider';
import { config } from '../config/config';
import { findById } from '../models/user';
import { createOidcAdapter } from './oidc-adapter';
import { loadOrCreateOidcJwks } from './oidc-jwks';
import {
  listActiveProviderClients,
  seedDefaultOidcClients,
  getOidcClient,
  toProviderClient,
} from './oidc-clients';
import { logger } from '../utils/logger';

let providerInstance: Provider | null = null;

export function getOidcProvider(): Provider {
  if (!providerInstance) {
    throw new Error('OIDC provider is not initialized');
  }
  return providerInstance;
}

export function getOidcIssuer(): string {
  return config.oidc.issuer;
}

function isOidcRequestPath(path: string): boolean {
  if (path === '/.well-known/openid-configuration') return true;
  if (path === '/.well-known/oauth-authorization-server') return true;
  if (path.startsWith('/oidc/')) return true;
  return false;
}

export async function initOidcProvider(): Promise<Provider> {
  // Dynamic ESM import: oidc-provider is ESM-only; PrivMail backend is CommonJS.
  // Avoid ts-node rewriting `import()` → `require()` which throws ERR_REQUIRE_ESM.
  const importEsm = new Function('m', 'return import(m)') as (m: string) => Promise<{
    default: new (issuer: string, configuration?: unknown) => Provider;
  }>;
  const oidc = await importEsm('oidc-provider');
  const ProviderCtor = oidc.default;

  await seedDefaultOidcClients();
  const jwks = await loadOrCreateOidcJwks();
  const bootClients = await listActiveProviderClients();

  const issuer = config.oidc.issuer;

  const configuration = {
    adapter: createOidcAdapter(),
    // Seed into static client cache at boot; adapter keeps DB-backed clients in sync
    // for admin CRUD and multi-process reloads.
    clients: bootClients,
    jwks,
    cookies: {
      keys: [config.sessionSecret, config.jwtSecret].filter(Boolean),
      long: {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: config.isProduction,
        path: '/',
      },
      short: {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: config.isProduction,
        path: '/',
      },
    },
    features: {
      devInteractions: { enabled: false },
      rpInitiatedLogout: { enabled: true },
      revocation: { enabled: true },
      introspection: { enabled: true },
    },
    // PKCE: library-native — require for all clients (Vaultwarden sets SSO_PKCE=true).
    pkce: {
      methods: ['S256'],
      required: () => true,
    },
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    claims: {
      openid: ['sub'],
      email: ['email', 'email_verified'],
      profile: ['name', 'preferred_username'],
    },
    // Keep protocol endpoints under /oidc/* to avoid clashing with the web UI,
    // while Discovery remains at /.well-known/openid-configuration (issuer root).
    routes: {
      authorization: '/oidc/auth',
      backchannel_authentication: '/oidc/backchannel',
      code_verification: '/oidc/device',
      device_authorization: '/oidc/device/auth',
      end_session: '/oidc/session/end',
      introspection: '/oidc/token/introspection',
      jwks: '/oidc/jwks',
      pushed_authorization_request: '/oidc/request',
      registration: '/oidc/reg',
      revocation: '/oidc/token/revocation',
      token: '/oidc/token',
      userinfo: '/oidc/userinfo',
    },
    interactions: {
      url(_ctx: unknown, interaction: { uid: string }) {
        // Reuse the existing PrivMail login UI (SRP / WebAuthn) — no second login page.
        return `/login?interaction=${encodeURIComponent(interaction.uid)}`;
      },
    },
    findAccount: async (_ctx: unknown, id: string) => {
      const user = await findById(id);
      if (!user) return undefined;
      return {
        accountId: user.id,
        async claims() {
          return {
            sub: user.id,
            email: user.email,
            email_verified: true,
            name: user.display_name || user.email,
            preferred_username: user.email,
          };
        },
      };
    },
    // Prefer DB clients (admin CRUD / seed) over the static snapshot when looking up.
    // node-oidc-provider still uses the Adapter for Client when not in static cache;
    // we also reload static clients via refreshOidcClients() after admin changes.
    clientBasedCORS(_ctx: unknown, origin: string) {
      const allowed = new Set([
        ...config.corsOrigins,
        `https://${config.domain}`,
        `https://${config.vaultHost}`,
        `https://${config.photosHost}`,
      ]);
      return allowed.has(origin.toLowerCase());
    },
    ttl: {
      AccessToken: 60 * 60,
      AuthorizationCode: 60 * 10,
      IdToken: 60 * 60,
      RefreshToken: 60 * 60 * 24 * 14,
      Interaction: 60 * 60,
      Session: 60 * 60 * 24,
      Grant: 60 * 60 * 24 * 14,
    },
    renderError: async (ctx: unknown, out: unknown, error: Error) => {
      logger.warn('OIDC renderError', error.message);
      const c = ctx as { body?: unknown; type?: string };
      c.type = 'application/json';
      c.body = out;
    },
  };

  const provider = new ProviderCtor(issuer, configuration as never);
  provider.proxy = true;
  providerInstance = provider;

  // Also mirror into Adapter so admin CRUD / reloads stay consistent.
  for (const c of bootClients) {
    await syncOidcClientToAdapter(c.client_id);
  }

  logger.info(`OIDC provider ready — issuer=${issuer}, clients=${bootClients.length}`);
  return provider;
}

/**
 * Sync a single client into the Postgres OIDC Adapter (create/update/delete).
 * Uses our Adapter factory directly — reliable across CJS/ESM interop.
 */
export async function syncOidcClientToAdapter(clientId: string, remove = false): Promise<void> {
  const Adapter = createOidcAdapter();
  const adapter = new Adapter('Client');
  if (remove) {
    await adapter.destroy(clientId);
    return;
  }
  const row = await getOidcClient(clientId);
  if (!row || !row.is_active) {
    await adapter.destroy(clientId);
    return;
  }
  await adapter.upsert(clientId, toProviderClient(row));
}

export function mountOidcProvider(app: Express, provider: Provider): void {
  const callback = provider.callback();

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isOidcRequestPath(req.path)) {
      next();
      return;
    }
    // node-oidc-provider owns body parsing for /oidc/token etc.
    callback(req, res, next);
  });
}
