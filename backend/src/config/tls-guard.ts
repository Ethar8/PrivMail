import * as fs from 'fs';
import * as crypto from 'crypto';
import { config } from './config';

/**
 * Validates TLS certificate and key files before production startup.
 * Analogous to Vaultwarden/Bitwarden: no valid TLS → process exits.
 */
export function validateTlsConfiguration(): string[] {
  const problems: string[] = [];

  if (!config.isProduction) {
    const allowHttp = (process.env.ALLOW_HTTP_DEV ?? 'false').toLowerCase() === 'true';
    if (!allowHttp && !config.tls.certPath && !config.tls.keyPath) {
      // Development without certs is fine unless explicitly requiring TLS.
      return problems;
    }
    if (!config.tls.certPath && !config.tls.keyPath) return problems;
  }

  const certPath = config.tls.certPath;
  const keyPath = config.tls.keyPath;

  if (!certPath || !keyPath) {
    problems.push(
      'TLS_CERT_PATH und TLS_KEY_PATH müssen gesetzt sein. PrivMail startet in Produktion nicht ohne gültiges TLS-Zertifikat.',
    );
    return problems;
  }

  if (!fs.existsSync(certPath)) {
    problems.push(`TLS-Zertifikat nicht gefunden: ${certPath}`);
  } else {
    try {
      fs.accessSync(certPath, fs.constants.R_OK);
    } catch {
      problems.push(`TLS-Zertifikat nicht lesbar: ${certPath}`);
    }
  }

  if (!fs.existsSync(keyPath)) {
    problems.push(`TLS-Schlüssel nicht gefunden: ${keyPath}`);
  } else {
    try {
      fs.accessSync(keyPath, fs.constants.R_OK);
    } catch {
      problems.push(`TLS-Schlüssel nicht lesbar: ${keyPath}`);
    }
  }

  if (problems.length > 0) return problems;

  try {
    const certPem = fs.readFileSync(certPath, 'utf8');
    const x509 = new crypto.X509Certificate(certPem);
    const validTo = new Date(x509.validTo);
    if (validTo.getTime() <= Date.now()) {
      problems.push(`TLS-Zertifikat abgelaufen (gültig bis ${x509.validTo}).`);
    }
  } catch (err) {
    problems.push(`TLS-Zertifikat ungültig: ${(err as Error).message}`);
  }

  return problems;
}
