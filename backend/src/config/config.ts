import dotenv from 'dotenv';

dotenv.config();

import {
  MIN_SECRET_LENGTH,
  DEFAULT_JWT_SECRET,
  DEFAULT_SESSION_SECRET,
} from './constants';

function int(value: string | undefined, fallback: number): number {
  const n = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const domain = process.env.DOMAIN ?? 'localhost';
const vaultHost = (process.env.VAULT_HOST ?? `vault.${domain}`).replace(/^https?:\/\//, '').replace(/\/$/, '');
const photosHost = (process.env.PHOTOS_HOST ?? `photos.${domain}`).replace(/^https?:\/\//, '').replace(/\/$/, '');

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  smtpPort: int(process.env.SMTP_PORT, 2525),
  imapPort: int(process.env.IMAP_PORT, 2143),
  apiPort: int(process.env.API_PORT, 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-session-secret-change-me',
  domain,
  /** Public hostname for Vaultwarden (operator-configurable). */
  vaultHost,
  /** Public hostname for Immich (operator-configurable). */
  photosHost,
  // DKIM selector used when publishing/checking the DKIM DNS record
  // (<selector>._domainkey.<domain>).
  dkimSelector: process.env.DKIM_SELECTOR ?? 'privmail',
  // Path to the DKIM private key (PEM) used to sign outbound mail. Optional;
  // when unset, outbound mail is sent unsigned.
  dkimPrivateKeyPath: process.env.DKIM_PRIVATE_KEY_PATH ?? '',
  // Public IP of this server (for MX / reverse-DNS self checks). Optional.
  publicIp: process.env.PUBLIC_IP ?? '',
  // Domains for which this server accepts mail. Anything else is a relay
  // attempt and is rejected at RCPT time. Configure extra domains via
  // LOCAL_DOMAINS (comma-separated).
  localDomains: [domain.toLowerCase(), ...list(process.env.LOCAL_DOMAINS)],
  // Allowed CORS origins (comma-separated). Empty in development means "reflect
  // any origin"; in production an explicit whitelist is required.
  corsOrigins: list(process.env.CORS_ORIGINS),
  mailDir: process.env.MAIL_DIR ?? '/var/lib/privmail/mail',
  queueDir: process.env.QUEUE_DIR ?? '/var/lib/privmail/queue',
  // Antivirus (ClamAV). Enabled by default; fail-closed rejects mail with a
  // temporary error when the scanner is unavailable.
  av: {
    enabled: (process.env.AV_ENABLED ?? 'true').toLowerCase() !== 'false',
    host: process.env.CLAMAV_HOST ?? 'clamav',
    port: int(process.env.CLAMAV_PORT, 3310),
    failClosed: (process.env.AV_FAIL_CLOSED ?? 'true').toLowerCase() !== 'false',
  },
  // TLS for the mail servers. Certificate/key paths are shared; STARTTLS is
  // offered when they are present. In production, plaintext auth is refused
  // until STARTTLS succeeds (No Plaintext).
  tls: {
    certPath: process.env.TLS_CERT_PATH ?? '',
    keyPath: process.env.TLS_KEY_PATH ?? '',
    smtpRequireTls:
      (process.env.SMTP_REQUIRE_TLS ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false'))
        .toLowerCase() === 'true',
    imapRequireTls:
      (process.env.IMAP_REQUIRE_TLS ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false'))
        .toLowerCase() === 'true',
  },
  // OIDC Identity Provider (node-oidc-provider). Issuer is the public HTTPS base URL.
  oidc: {
    issuer: (process.env.OIDC_ISSUER ?? `https://${domain}`).replace(/\/$/, ''),
    vaultwardenClientId: process.env.OIDC_VAULTWARDEN_CLIENT_ID ?? 'vaultwarden',
    vaultwardenClientSecret: process.env.OIDC_VAULTWARDEN_CLIENT_SECRET ?? '',
    immichClientId: process.env.OIDC_IMMICH_CLIENT_ID ?? 'immich',
    immichClientSecret: process.env.OIDC_IMMICH_CLIENT_SECRET ?? '',
    vaultUrl: process.env.VAULTWARDEN_URL ?? `https://${vaultHost}`,
    photosUrl: process.env.IMMICH_URL ?? `https://${photosHost}`,
    vaultHost,
    photosHost,
    vaultInternalUrl: process.env.VAULTWARDEN_INTERNAL_URL ?? 'http://vaultwarden:80',
    photosInternalUrl: process.env.IMMICH_INTERNAL_URL ?? 'http://immich-server:2283',
  },
} as const;

export type Config = typeof config;

export function isLocalDomain(address: string): boolean {
  const at = address.lastIndexOf('@');
  if (at === -1) return false;
  const dom = address.slice(at + 1).trim().toLowerCase();
  return (config.localDomains as readonly string[]).includes(dom);
}

/**
 * Regel 2 – Krypto-Erzwingung & Fail-Fast.
 * Verhindert den Produktivstart mit schwachen/Default-Secrets. Gibt bei einem
 * Verstoß eine Liste der Probleme zurück (leer = alles ok). Der Aufrufer
 * (index.ts) beendet den Prozess bei nicht-leerer Liste hart.
 */
/**
 * Validates secrets and security configuration. In production always enforced.
 * In development enforced unless ALLOW_INSECURE_DEV=true is explicitly set.
 */
export function validateProductionSecrets(): string[] {
  const problems: string[] = [];
  const allowInsecureDev = (process.env.ALLOW_INSECURE_DEV ?? 'false').toLowerCase() === 'true';

  if (!config.isProduction && allowInsecureDev) return problems;

  const checks: { name: string; value: string; def: string }[] = [
    { name: 'JWT_SECRET', value: config.jwtSecret, def: DEFAULT_JWT_SECRET },
    { name: 'SESSION_SECRET', value: config.sessionSecret, def: DEFAULT_SESSION_SECRET },
  ];

  for (const c of checks) {
    if (!c.value || c.value.trim() === '') {
      problems.push(`${c.name} ist leer.`);
    } else if (c.value === c.def) {
      problems.push(`${c.name} verwendet den unsicheren Default-Wert.`);
    } else if (c.value.length < MIN_SECRET_LENGTH) {
      problems.push(`${c.name} ist zu kurz (min. ${MIN_SECRET_LENGTH} Zeichen).`);
    }
  }

  if (config.corsOrigins.length === 0) {
    problems.push(
      'CORS_ORIGINS ist leer. Setze eine explizite Whitelist (z. B. http://localhost:8080).',
    );
  }

  return problems;
}
