import { Request } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

export interface LoginMetadata {
  ipAddress: string;
  userAgent: string | null;
  geoCountry: string | null;
  geoCity: string | null;
  success: boolean;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  reasons: string[];
  confidence: number;
}

/**
 * Login-Anomalie-Erkennung
 *
 * Vergleicht Login-Metadaten (IP, Geo, User-Agent) mit dem bisherigen
 * Verhalten des Nutzers. Bei signifikanter Abweichung wird eine Warnung
 * ausgelöst und optional ein zusätzlicher 2FA-Schritt erzwungen.
 */

function extractMetadata(req: Request): LoginMetadata {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? req.ip ?? 'unknown';
  return {
    ipAddress: String(ip),
    userAgent: (req.headers['user-agent'] as string) ?? null,
    geoCountry: (req.headers['x-geo-country'] as string) ?? null,
    geoCity: (req.headers['x-geo-city'] as string) ?? null,
    success: true,
  };
}

async function getRecentLogins(userId: string, limit = 20): Promise<LoginMetadata[]> {
  const { rows } = await query<{ ip_address: string; user_agent: string; geo_country: string; geo_city: string; success: boolean }>(
    `SELECT ip_address, user_agent, geo_country, geo_city, success
     FROM login_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    ipAddress: r.ip_address,
    userAgent: r.user_agent,
    geoCountry: r.geo_country,
    geoCity: r.geo_city,
    success: r.success,
  }));
}

function geohashDistance(a: string | null, b: string | null): number {
  if (!a || !b || !a.startsWith(b.substring(0, 2))) return 1;
  return b.startsWith(a.substring(0, 4)) ? 0.2 : 0.6;
}

export async function detectAnomaly(userId: string, meta: LoginMetadata): Promise<AnomalyResult> {
  const reasons: string[] = [];
  let score = 0;

  try {
    const recent = await getRecentLogins(userId);
    if (recent.length < 2) {
      await recordLogin(userId, meta, false);
      return { isAnomaly: false, reasons: [], confidence: 0 };
    }

    const knownIPs = new Set(recent.map((l) => l.ipAddress));
    if (!knownIPs.has(meta.ipAddress)) {
      score += 0.4;
      reasons.push('Neue IP-Adresse');
    }

    const knownCountries = recent
      .map((l) => l.geoCountry)
      .filter(Boolean) as string[];
    if (meta.geoCountry && !knownCountries.includes(meta.geoCountry)) {
      const geoDist = recent.reduce(
        (max, l) => Math.max(max, geohashDistance(meta.geoCountry, l.geoCountry)),
        0,
      );
      score += geoDist * 0.3;
      if (geoDist > 0.5) reasons.push('Ungewöhnlicher Standort');
    }

    const knownAgents = recent
      .map((l) => l.userAgent?.substring(0, 50))
      .filter(Boolean);
    const agentPrefix = meta.userAgent?.substring(0, 50);
    if (agentPrefix && knownAgents.length > 0) {
      const exactMatch = knownAgents.some(
        (a) => a?.split('/')[0] === agentPrefix.split('/')[0],
      );
      if (!exactMatch) {
        score += 0.2;
        reasons.push('Neues Gerät / Browser');
      }
    }

    const failedRecent = recent.filter((l) => !l.success);
    if (failedRecent.length > 3) {
      score += 0.1;
      reasons.push('Mehrere fehlgeschlagene Login-Versuche');
    }
  } catch (err) {
    logger.debug('Anomalie-Erkennung übersprungen', (err as Error).message);
  }

  const isAnomaly = score >= 0.5;
  const confidence = Math.min(1, score);

  await recordLogin(userId, meta, isAnomaly);

  if (isAnomaly) {
    logger.warn(
      `Login-Anomalie erkannt für user ${userId}: ${reasons.join(', ')} (confidence: ${(confidence * 100).toFixed(0)}%)`,
    );
  }

  return { isAnomaly, reasons, confidence };
}

export async function recordLogin(
  userId: string,
  meta: LoginMetadata,
  anomaly: boolean,
): Promise<void> {
  try {
    await query(
      `INSERT INTO login_history (user_id, ip_address, user_agent, geo_country, geo_city, success, anomaly)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        meta.ipAddress,
        meta.userAgent,
        meta.geoCountry ?? null,
        meta.geoCity ?? null,
        meta.success,
        anomaly,
      ],
    );
  } catch (err) {
    logger.debug('Login-Verlauf nicht geschrieben', (err as Error).message);
  }
}

export function getLoginMetadata(req: Request): LoginMetadata {
  return extractMetadata(req);
}
