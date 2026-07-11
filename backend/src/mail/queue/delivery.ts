import * as net from 'net';
import { logger } from '../../utils/logger';
import { QueuedMessage, DeliveryResult } from './queue';
import { classifyReply } from './retry';
import { resolver, domainOf } from '../../dns/resolver';
import { config } from '../../config/config';
import { signMessage } from './dkim-signer';

/**
 * Delivers a queued message to remote MX hosts via SMTP. Recipients are grouped
 * by domain; each domain's MX list is tried in priority order. The message is
 * DKIM-signed once (if signing is configured) before delivery.
 */
export async function deliverMessage(msg: QueuedMessage): Promise<DeliveryResult> {
  const signedRaw = signMessage(msg.raw, domainOf(msg.from));

  const byDomain = new Map<string, string[]>();
  for (const rcpt of msg.to) {
    const d = domainOf(rcpt);
    byDomain.set(d, [...(byDomain.get(d) ?? []), rcpt]);
  }

  let permanent = false;
  let lastError: string | undefined;

  for (const [domain, rcpts] of byDomain) {
    const mxs = await resolver.mx(domain);
    const hosts = mxs.length > 0 ? mxs.map((m) => m.exchange) : [domain];
    const result = await tryHosts(hosts, msg.from, rcpts, signedRaw);
    if (!result.success) {
      permanent = permanent || result.permanent;
      lastError = result.error;
    }
  }

  if (lastError) return { success: false, permanent, error: lastError };
  return { success: true, permanent: false };
}

async function tryHosts(
  hosts: string[],
  from: string,
  rcpts: string[],
  raw: string,
): Promise<DeliveryResult> {
  let permanent = false;
  let lastError = 'no MX host reachable';
  for (const host of hosts) {
    try {
      await smtpTransaction(host, 25, from, rcpts, raw);
      logger.info(`Delivered to ${rcpts.join(', ')} via ${host}`);
      return { success: true, permanent: false };
    } catch (err) {
      const e = err as Error & { permanent?: boolean };
      lastError = e.message;
      if (e.permanent) permanent = true;
      logger.warn(`Delivery to ${host} failed`, e.message);
    }
  }
  return { success: false, permanent, error: lastError };
}

function smtpTransaction(
  host: string,
  port: number,
  from: string,
  rcpts: string[],
  raw: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 20000 });
    const steps = [`EHLO ${config.domain}`, `MAIL FROM:<${from}>`, ...rcpts.map((r) => `RCPT TO:<${r}>`), 'DATA'];
    let stage = -1;
    let sentData = false;
    let buffer = '';

    socket.setEncoding('utf8');

    const fail = (message: string, permanent = false) => {
      const err = new Error(message) as Error & { permanent?: boolean };
      err.permanent = permanent;
      socket.destroy();
      reject(err);
    };

    socket.on('timeout', () => fail('SMTP timeout'));
    socket.on('error', (e) => fail(e.message));

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      if (!buffer.endsWith('\r\n')) return;
      const code = parseInt(buffer.slice(0, 3), 10);
      const cls = classifyReply(code);
      buffer = '';

      if (cls === 'permanent') return fail(`Server replied ${code}`, true);
      if (cls === 'temporary') return fail(`Server replied ${code}`, false);

      if (stage < steps.length - 1) {
        stage += 1;
        socket.write(steps[stage] + '\r\n');
      } else if (!sentData) {
        sentData = true;
        const dotStuffed = raw.replace(/\r\n\./g, '\r\n..');
        socket.write(dotStuffed + '\r\n.\r\n');
      } else {
        socket.write('QUIT\r\n');
        socket.end();
        resolve();
      }
    });
  });
}
