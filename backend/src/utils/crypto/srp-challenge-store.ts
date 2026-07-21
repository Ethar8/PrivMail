/**
 * Kurzlebiger In-Memory-Cache für SRP-Servergeheimnis b.
 * Schlüssel = challengeId (Zufall), Wert = b als Hex — niemals challengeId als b nutzen.
 */

interface Entry {
  secretHex: string;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000;
const store = new Map<string, Entry>();

function purgeExpired(now = Date.now()): void {
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) store.delete(id);
  }
}

export function storeSrpChallengeSecret(challengeId: string, secretHex: string): void {
  purgeExpired();
  store.set(challengeId, { secretHex, expiresAt: Date.now() + TTL_MS });
}

/** Einmaliges Abrufen: Eintrag wird entfernt (Replay-Schutz). */
export function takeSrpChallengeSecret(challengeId: string): string | null {
  purgeExpired();
  const entry = store.get(challengeId);
  if (!entry) return null;
  store.delete(challengeId);
  if (entry.expiresAt <= Date.now()) return null;
  return entry.secretHex;
}

/** Nur für Tests. */
export function clearSrpChallengeStore(): void {
  store.clear();
}
