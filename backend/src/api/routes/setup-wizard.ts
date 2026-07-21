import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { config } from '../../config/config';

export const setupWizardRouter = Router();

function isConfiguredDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return Boolean(d) && d !== 'localhost' && !d.includes('ihre-domain') && !d.includes('<deine');
}

setupWizardRouter.get('/status', async (_req, res) => {
  const checks = {
    database: false,
    domain: false,
    dns: { spf: false, dkim: false, dmarc: false, mx: false },
    tls: false,
    adminAccount: false,
    suite: {
      oidcIssuer: config.oidc.issuer,
      domain: config.domain,
      vaultHost: config.vaultHost,
      photosHost: config.photosHost,
      vaultUrl: config.oidc.vaultUrl,
      photosUrl: config.oidc.photosUrl,
      corsOrigins: [...config.corsOrigins],
    },
  };

  try {
    const { query } = await import('../../database/connection');
    try {
      await query('SELECT 1');
      checks.database = true;
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }

  try {
    checks.domain = isConfiguredDomain(config.domain);
    if (config.tls?.certPath) {
      try {
        const fs = await import('fs');
        const cert = fs.readFileSync(config.tls.certPath, 'utf8');
        checks.tls = cert.includes('BEGIN CERTIFICATE');
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const { countUsers } = await import('../../models/user');
    checks.adminAccount = (await countUsers()) > 0;
  } catch {
    /* ignore */
  }

  res.json({
    complete: checks.database && checks.domain && checks.tls && checks.adminAccount,
    hostConfigRequired: !checks.domain,
    hostWizardCommand: './scripts/setup-wizard.sh',
    checks,
    remainingUserSteps: [
      {
        id: 'dns',
        title: 'DNS A/AAAA bei deinem Domain-Anbieter setzen',
        hosts: [config.domain, config.vaultHost, config.photosHost],
        after: `./infrastructure/scripts/setup-ssl.sh ${config.domain}`,
      },
    ],
  });
});

const deriveSchema = z.object({
  domain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9.-]+$/i),
  vaultHost: z
    .string()
    .min(3)
    .regex(/^[a-z0-9.-]+$/i)
    .optional(),
  photosHost: z
    .string()
    .min(3)
    .regex(/^[a-z0-9.-]+$/i)
    .optional(),
});

/**
 * Liefert die aus einer Domain abgeleitete Suite-Konfiguration.
 * Schreibt keine Host-Dateien (das macht scripts/setup-wizard.sh auf dem Server).
 */
setupWizardRouter.post('/derive-suite-config', async (req, res) => {
  const parsed = deriveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid domain' });
    return;
  }
  const domain = parsed.data.domain.toLowerCase();
  const vaultHost = (parsed.data.vaultHost ?? `vault.${domain}`).toLowerCase();
  const photosHost = (parsed.data.photosHost ?? `photos.${domain}`).toLowerCase();
  res.json({
    domain,
    vaultHost,
    photosHost,
    oidcIssuer: `https://${domain}`,
    corsOrigins: [`https://${domain}`, `https://${vaultHost}`, `https://${photosHost}`],
    vaultUrl: `https://${vaultHost}`,
    photosUrl: `https://${photosHost}`,
    dnsRecords: [
      { type: 'A/AAAA', host: domain, value: '<DEINE-SERVER-IP>' },
      { type: 'A/AAAA', host: vaultHost, value: '<DEINE-SERVER-IP>' },
      { type: 'A/AAAA', host: photosHost, value: '<DEINE-SERVER-IP>' },
    ],
    applyOnHost: [
      `./scripts/setup-wizard.sh --domain ${domain} --vault-host ${vaultHost} --photos-host ${photosHost} --yes`,
      `./infrastructure/scripts/setup-ssl.sh ${domain}`,
      `docker compose up -d --build`,
    ],
  });
});

setupWizardRouter.post('/finish', requireAuth, requireAdmin, async (_req, res) => {
  res.json({
    status: 'complete',
    summary: {
      smtp: { host: config.domain, port: 2525 },
      imap: { host: config.domain, port: 2143 },
      webmail: '/dashboard/inbox',
      apps: '/dashboard/apps',
      oidcDiscovery: `${config.oidc.issuer}/.well-known/openid-configuration`,
      nextStep:
        'DNS A/AAAA für Domain, Vault- und Photos-Host setzen – danach setup-ssl.sh.',
      dnsHosts: [config.domain, config.vaultHost, config.photosHost],
    },
  });
});
