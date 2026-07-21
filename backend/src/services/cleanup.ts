import { query } from '../database/connection';
import { logger } from '../utils/logger';

export function startCleanupJobs(): void {
  setInterval(() => void cleanupExpiredMessages(), 300_000); // every 5 min
  setInterval(() => void cleanupExpiredTokens(), 600_000); // every 10 min
  setInterval(() => void cleanupExpiredExternalMessages(), 300_000);
  setInterval(() => void cleanupExpiredAttachmentShares(), 300_000);
  setInterval(() => void unsnoozeEmails(), 60_000); // every minute

  logger.info('Cleanup jobs started');
}

async function cleanupExpiredMessages(): Promise<void> {
  try {
    const result = await query(
      `DELETE FROM emails WHERE expires_at IS NOT NULL AND expires_at < NOW() RETURNING id`,
    );
    if ((result.rowCount ?? 0) > 0) {
      logger.debug(`Cleaned up ${result.rowCount} expired messages`);
    }
  } catch (err) {
    logger.debug('Expired message cleanup skipped', (err as Error).message);
  }
}

async function cleanupExpiredTokens(): Promise<void> {
  try {
    await query(`DELETE FROM password_reset_tokens WHERE expires_at < NOW()`);
  } catch {
    // non-critical
  }
}

async function cleanupExpiredExternalMessages(): Promise<void> {
  try {
    await query(`DELETE FROM external_encrypted_messages WHERE expires_at IS NOT NULL AND expires_at < NOW()`);
  } catch {
    // non-critical
  }
}

async function cleanupExpiredAttachmentShares(): Promise<void> {
  try {
    await query(`DELETE FROM attachment_shares WHERE expires_at IS NOT NULL AND expires_at < NOW()`);
  } catch {
    // non-critical
  }
}

async function unsnoozeEmails(): Promise<void> {
  try {
    const { rows } = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM emails WHERE snoozed_until IS NOT NULL AND snoozed_until <= NOW()`,
    );
    if (rows.length > 0) {
      for (const row of rows) {
        await query(
          `UPDATE emails SET snoozed_until = NULL, mailbox = 'INBOX' WHERE id = $1 AND user_id = $2`,
          [row.id, row.user_id],
        );
      }
      logger.debug(`Unsnoozed ${rows.length} emails`);
    }
  } catch {
    // non-critical
  }
}
