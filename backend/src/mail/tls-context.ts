import * as fs from 'fs';
import * as tls from 'tls';
import { config } from '../config/config';
import { logger } from '../utils/logger';

let cached: tls.SecureContext | null | undefined;

/**
 * Loads a shared TLS SecureContext from the configured certificate/key. Returns
 * null when no certificate is configured or the files cannot be read, in which
 * case STARTTLS is not offered/allowed. The result is cached.
 */
export function getSecureContext(): tls.SecureContext | null {
  if (cached !== undefined) return cached;

  const { certPath, keyPath } = config.tls;
  if (!certPath || !keyPath) {
    logger.warn('TLS: no certificate configured (TLS_CERT_PATH/TLS_KEY_PATH); STARTTLS disabled');
    cached = null;
    return cached;
  }

  try {
    const cert = fs.readFileSync(certPath);
    const key = fs.readFileSync(keyPath);
    cached = tls.createSecureContext({ cert, key, minVersion: 'TLSv1.2' });
    logger.info('TLS: secure context loaded; STARTTLS available');
    return cached;
  } catch (err) {
    logger.error(`TLS: failed to load certificate/key: ${(err as Error).message}`);
    cached = null;
    return cached;
  }
}

export function isTlsAvailable(): boolean {
  return getSecureContext() !== null;
}

/** Test-only: reset the cached context so config changes take effect. */
export function resetSecureContextCache(): void {
  cached = undefined;
}
