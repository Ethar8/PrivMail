import { config } from '../config/config';
import { getLastSuccessfulOidcLogin } from './oidc-clients';
import { getOidcIssuer } from './oidc-provider';
import { logger } from '../utils/logger';

export interface ServiceHealth {
  name: string;
  reachable: boolean;
  statusCode?: number;
  detail?: string;
  url: string;
}

async function probe(url: string, timeoutMs = 4000): Promise<{ ok: boolean; status?: number; detail?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    return { ok: res.status > 0 && res.status < 500, status: res.status };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkSuiteHealth(): Promise<{
  oidc: {
    issuer: string;
    discoveryReachable: boolean;
    discoveryUrl: string;
    lastSuccessfulLogin: string | null;
  };
  vaultwarden: ServiceHealth;
  immich: ServiceHealth;
}> {
  const issuer = (() => {
    try {
      return getOidcIssuer();
    } catch {
      return config.oidc.issuer;
    }
  })();
  const discoveryUrl = `${issuer}/.well-known/openid-configuration`;

  const [discovery, vault, photos, lastLogin] = await Promise.all([
    probe(discoveryUrl.startsWith('http') ? discoveryUrl : `http://127.0.0.1:${config.apiPort}/.well-known/openid-configuration`),
    probe(`${config.oidc.vaultInternalUrl.replace(/\/$/, '')}/alive`),
    probe(`${config.oidc.photosInternalUrl.replace(/\/$/, '')}/api/server/ping`),
    getLastSuccessfulOidcLogin().catch((err) => {
      logger.warn('oidc login audit read failed', (err as Error).message);
      return null;
    }),
  ]);

  // Prefer probing the local discovery path when issuer is public HTTPS
  // that may not resolve inside the container.
  let discoveryReachable = discovery.ok;
  if (!discoveryReachable) {
    const local = await probe(`http://127.0.0.1:${config.apiPort}/.well-known/openid-configuration`);
    discoveryReachable = local.ok;
  }

  return {
    oidc: {
      issuer,
      discoveryReachable,
      discoveryUrl,
      lastSuccessfulLogin: lastLogin,
    },
    vaultwarden: {
      name: 'Vaultwarden',
      reachable: vault.ok,
      statusCode: vault.status,
      detail: vault.detail,
      url: config.oidc.vaultUrl,
    },
    immich: {
      name: 'Immich',
      reachable: photos.ok,
      statusCode: photos.status,
      detail: photos.detail,
      url: config.oidc.photosUrl,
    },
  };
}
