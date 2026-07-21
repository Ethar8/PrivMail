import { MailQueue, QueuedMessage } from '../../mail/queue/queue';
import { classifyReply, nextRetryDelay, shouldRetry } from '../../mail/queue/retry';

describe('retry helpers', () => {
  it('classifies SMTP reply codes', () => {
    expect(classifyReply(250)).toBe('success');
    expect(classifyReply(451)).toBe('temporary');
    expect(classifyReply(550)).toBe('permanent');
  });

  it('increases backoff with attempts', () => {
    expect(nextRetryDelay(2)).toBeGreaterThan(nextRetryDelay(1));
  });

  it('stops retrying after the limit', () => {
    expect(shouldRetry(0)).toBe(true);
    expect(shouldRetry(99)).toBe(false);
  });
});

describe('MailQueue', () => {
  it('removes a message after successful delivery', async () => {
    const queue = new MailQueue(async () => ({ success: true, permanent: false }));
    const delivered: string[] = [];
    queue.on('delivered', (m: QueuedMessage) => delivered.push(m.id));
    const id = await queue.enqueue('a@x.com', ['b@y.com'], 'raw');
    expect(queue.size).toBe(1);
    // Drive one processing cycle via the private method through start/stop.
    await (queue as unknown as { process: () => Promise<void> }).process();
    expect(queue.size).toBe(0);
    expect(delivered).toContain(id);
  });

  it('generates a bounce on permanent failure', async () => {
    const queue = new MailQueue(async (m) =>
      m.isBounce ? { success: true, permanent: false } : { success: false, permanent: true, error: '550' },
    );
    await queue.enqueue('a@x.com', ['b@y.com'], 'raw');
    await (queue as unknown as { process: () => Promise<void> }).process();
    // Original removed, bounce enqueued.
    expect(queue.size).toBe(1);
  });
});
