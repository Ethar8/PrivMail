import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { nextRetryDelay, shouldRetry } from './retry';
import { query } from '../../database/connection';

export interface QueuedMessage {
  id: string;
  from: string;
  to: string[];
  raw: string;
  attempts: number;
  nextAttempt: number;
  requestDSN: boolean;
  isBounce: boolean;
}

export interface DeliveryResult {
  success: boolean;
  permanent: boolean;
  error?: string;
}

export type DeliverFn = (msg: QueuedMessage) => Promise<DeliveryResult>;

interface DbQueueRow {
  id: string;
  from_email: string;
  to_emails: string[];
  raw: string;
  attempts: number;
  next_attempt_at: string;
  request_dsn: boolean;
  is_bounce: boolean;
}

export class MailQueue extends EventEmitter {
  private queue: QueuedMessage[] = [];
  private timer: NodeJS.Timeout | null = null;
  private deliver: DeliverFn;
  private dbLoaded = false;

  constructor(deliver: DeliverFn) {
    super();
    this.deliver = deliver;
  }

  async enqueue(from: string, to: string[], raw: string, options?: { requestDSN?: boolean; isBounce?: boolean }): Promise<string> {
    const id = randomUUID();
    const msg: QueuedMessage = {
      id,
      from,
      to,
      raw,
      attempts: 0,
      nextAttempt: Date.now(),
      requestDSN: options?.requestDSN ?? false,
      isBounce: options?.isBounce ?? false,
    };
    this.queue.push(msg);
    logger.info(`Queued outbound message ${id} to ${to.join(', ')}`);
    this.emit('enqueued', id);
    await this.persistToDb(msg);
    return id;
  }

  private async persistToDb(msg: QueuedMessage): Promise<void> {
    try {
      await query(
        `INSERT INTO outbound_queue (id, from_email, to_emails, raw, attempts, next_attempt_at, request_dsn, is_bounce)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           from_email = EXCLUDED.from_email, to_emails = EXCLUDED.to_emails,
           raw = EXCLUDED.raw, attempts = EXCLUDED.attempts,
           next_attempt_at = EXCLUDED.next_attempt_at,
           request_dsn = EXCLUDED.request_dsn, is_bounce = EXCLUDED.is_bounce`,
        [msg.id, msg.from, msg.to, msg.raw, msg.attempts, msg.nextAttempt, msg.requestDSN, msg.isBounce],
      );
    } catch (err) {
      logger.warn(`Failed to persist queue message to database: ${(err as Error).message}`);
    }
  }

  private async deleteFromDb(id: string): Promise<void> {
    try {
      await query(`DELETE FROM outbound_queue WHERE id = $1`, [id]);
    } catch (err) {
      logger.warn(`Failed to remove queue message from database: ${(err as Error).message}`);
    }
  }

  private async loadFromDb(): Promise<void> {
    if (this.dbLoaded) return;
    try {
      const { rows } = await query<DbQueueRow>(
        `SELECT * FROM outbound_queue ORDER BY next_attempt_at ASC`,
      );
      for (const row of rows) {
        this.queue.push({
          id: row.id,
          from: row.from_email,
          to: row.to_emails,
          raw: row.raw,
          attempts: row.attempts,
          nextAttempt: Number(row.next_attempt_at),
          requestDSN: row.request_dsn,
          isBounce: row.is_bounce,
        });
      }
      this.dbLoaded = true;
      if (rows.length > 0) {
        logger.info(`Loaded ${rows.length} queued messages from database`);
      }
    } catch (err) {
      logger.warn(`Could not load queue from database: ${(err as Error).message}`);
      this.dbLoaded = true;
    }
  }

  start(intervalMs = 5000): void {
    if (this.timer) return;
    void this.loadFromDb();
    this.timer = setInterval(() => void this.process(), intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async process(): Promise<void> {
    const now = Date.now();
    const due = this.queue.filter((m) => m.nextAttempt <= now);
    for (const msg of due) {
      let result: DeliveryResult;
      try {
        result = await this.deliver(msg);
      } catch (err) {
        result = { success: false, permanent: false, error: (err as Error).message };
      }

      if (result.success) {
        await this.remove(msg.id);
        this.emit('delivered', msg);
        continue;
      }

      if (result.permanent || !shouldRetry(msg.attempts)) {
        await this.remove(msg.id);
        this.emit('failed', msg, result);
        if (!msg.isBounce) await this.generateBounce(msg, result.error);
        continue;
      }

      msg.attempts += 1;
      msg.nextAttempt = Date.now() + nextRetryDelay(msg.attempts);
      await this.persistToDb(msg);
      this.emit('retry', msg, result);
    }
  }

  private async generateBounce(msg: QueuedMessage, reason?: string): Promise<void> {
    const bounceRaw = [
      `From: postmaster@privmail`,
      `To: ${msg.from}`,
      `Subject: Undeliverable: message could not be delivered`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      `Ihre E-Mail an ${msg.to.join(', ')} konnte nicht zugestellt werden.`,
      '',
      `Grund: ${reason ?? 'Unbekannter Fehler'}`,
    ].join('\r\n');
    await this.enqueue('postmaster@privmail', [msg.from], bounceRaw, { isBounce: true });
    logger.info(`Generated bounce for ${msg.id} -> ${msg.from}`);
  }

  private async remove(id: string): Promise<void> {
    this.queue = this.queue.filter((m) => m.id !== id);
    await this.deleteFromDb(id);
  }

  get size(): number {
    return this.queue.length;
  }
}
