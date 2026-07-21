import * as crypto from 'crypto';
import { query } from '../../database/connection';
import { hashPassword } from '../crypto/hash';
import { logger } from '../../utils/logger';

export interface RecoverySetup {
  phrase: string;
  phraseHash: string;
}

/**
 * Zero-Knowledge-Recovery
 *
 * Recovery-Phrase (BIP39-style, 12 Wörter) als Alternative zum
 * E-Mail-Reset. Der Server speichert nur den Hash der Phrase.
 * Das Klartext-Passwort wird NIE im Log oder der DB gespeichert.
 *
 * Flow:
 * 1. Setup: Nutzer generiert Phrase → Hash wird auf Server gespeichert
 * 2. Recovery: Nutzer gibt Phrase ein → Server prüft Hash → Passwort-Reset
 */

const WORDLIST = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
  'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
  'advice', 'aerobic', 'affair', 'afford', 'afraid', 'africa', 'after', 'again',
  'age', 'agent', 'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm',
  'album', 'alcohol', 'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone',
  'alpha', 'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among',
  'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry',
  'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
  'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april',
  'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army',
  'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact', 'artist',
  'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume', 'asthma',
  'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction', 'audit',
  'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid',
  'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis', 'baby',
  'bachelor', 'bacon', 'badge', 'bag', 'balance', 'balcony', 'ball', 'bamboo',
  'banana', 'banner', 'bar', 'barely', 'bargain', 'barrel', 'base', 'basic',
  'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become', 'beef',
  'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt', 'bench',
  'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle', 'bid',
  'bike', 'bind', 'biology', 'bird', 'birth', 'bitter', 'black', 'blade', 'blame',
];

export function generateRecoveryPhrase(wordCount: number = 12): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    const idx = crypto.randomInt(0, WORDLIST.length);
    words.push(WORDLIST[idx]);
  }
  return words.join(' ');
}

export function hashRecoveryPhrase(phrase: string): string {
  const normalized = phrase.toLowerCase().trim().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export async function setupRecovery(userId: string, phrase: string, hint?: string): Promise<void> {
  const phraseHash = hashRecoveryPhrase(phrase);
  await query(
    `UPDATE users SET recovery_phrase_hash = $2, recovery_hint = $3 WHERE id = $1`,
    [userId, phraseHash, hint ?? null],
  );
  logger.info(`Recovery phrase set for user ${userId}`);
}

export async function verifyRecoveryPhrase(
  phrase: string,
): Promise<{ userId: string; email: string } | null> {
  const phraseHash = hashRecoveryPhrase(phrase);
  const { rows } = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE recovery_phrase_hash = $1`,
    [phraseHash],
  );
  if (!rows[0]) return null;
  return { userId: rows[0].id, email: rows[0].email };
}

export async function resetPasswordWithRecovery(
  phrase: string,
  newPassword: string,
): Promise<{ success: boolean; email?: string }> {
  const recovery = await verifyRecoveryPhrase(phrase);
  if (!recovery) {
    return { success: false };
  }

  const passwordHash = await hashPassword(newPassword);
  await query(
    `UPDATE users SET password_hash = $2, token_version = token_version + 1, recovery_phrase_hash = NULL, recovery_hint = NULL WHERE id = $1`,
    [recovery.userId, passwordHash],
  );

  logger.info(`Password reset via recovery phrase for user ${recovery.userId}`);
  return { success: true, email: recovery.email };
}

export async function hasRecoverySetup(userId: string): Promise<boolean> {
  const { rows } = await query<{ recovery_phrase_hash: string }>(
    `SELECT recovery_phrase_hash FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0]?.recovery_phrase_hash !== null && rows[0]?.recovery_phrase_hash !== undefined;
}

export async function getRecoveryHint(userId: string): Promise<string | null> {
  const { rows } = await query<{ recovery_hint: string }>(
    `SELECT recovery_hint FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0]?.recovery_hint ?? null;
}
