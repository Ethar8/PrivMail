import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { nextRetryDelay, shouldRetry } from './retry';

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

/**
 * In-memory outbound queue with exponential backoff, retry limits, DSN support
 * and bounce generation on permanent failure.
 */
export class MailQueue extends EventEmitter {
  private queue: QueuedMessage[] = [];
  private timer: NodeJS.Timeout | null = null;
  private deliver: DeliverFn;

  constructor(deliver: DeliverFn) {
    super();
    this.deliver = deliver;
  }

  enqueue(from: string, to: string[], raw: string, options?: { requestDSN?: boolean; isBounce?: boolean }): string {
    const id = randomUUID();
    this.queue.push({
      id,
      from,
      to,
      raw,
      attempts: 0,
      nextAttempt: Date.now(),
      requestDSN: options?.requestDSN ?? false,
      isBounce: options?.isBounce ?? false,
    });
    logger.info(`Queued outbound message ${id} to ${to.join(', ')}`);
    this.emit('enqueued', id);
    return id;
  }

  start(intervalMs = 5000): void {
    if (this.timer) return;
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
        this.remove(msg.id);
        this.emit('delivered', msg);
        continue;
      }

      if (result.permanent || !shouldRetry(msg.attempts)) {
        this.remove(msg.id);
        this.emit('failed', msg, result);
        if (!msg.isBounce) this.generateBounce(msg, result.error);
        continue;
      }

      msg.attempts += 1;
      msg.nextAttempt = Date.now() + nextRetryDelay(msg.attempts);
      this.emit('retry', msg, result);
    }
  }

  private generateBounce(msg: QueuedMessage, reason?: string): void {
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
    this.enqueue('postmaster@privmail', [msg.from], bounceRaw, { isBounce: true });
    logger.info(`Generated bounce for ${msg.id} -> ${msg.from}`);
  }

  private remove(id: string): void {
    this.queue = this.queue.filter((m) => m.id !== id);
  }

  get size(): number {
    return this.queue.length;
  }
}
