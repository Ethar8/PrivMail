import { SMTPSession } from './smtp/session';
import { parseMessage } from './smtp/parser-message';
import { mailStore } from './storage/mailstore';
import { spamFilter } from '../spam/filter';
import { scanEmailOrThrow } from './av/clamav';
import { classifyWithLlm, llmScoreToSpamPoints } from '../spam/llm-classifier';
import { getAiConfig } from '../spam/ai-config-store';
import { findByEmail } from '../models/user';
import { extractAddress } from '../utils/validator';
import { SPAM_THRESHOLD } from '../config/constants';
import { logger } from '../utils/logger';

/**
 * Fire-and-forget LLM re-scoring. Runs AFTER delivery so it never blocks the
 * SMTP dialog, and is fully fail-open (LLM offline/slow => no penalty).
 */
function scheduleLlmRescore(
  storedIds: { id: string; userId: string }[],
  subject: string,
  body: string,
  baseScore: number,
): void {
  void (async () => {
    try {
      const cfg = await getAiConfig();
      if (!cfg.enabled) return;

      const verdict = await classifyWithLlm(
        { enabled: cfg.enabled, endpoint: cfg.endpoint, model: cfg.model, timeoutMs: cfg.timeoutMs },
        subject,
        body,
      );
      if (!verdict) return; // fail-open

      const weight = cfg.sensitivity / 50; // 50 = neutral
      const extra = Math.round(llmScoreToSpamPoints(verdict.score) * weight);
      if (extra <= 0) return;

      const newScore = baseScore + extra;
      for (const { id, userId } of storedIds) {
        await mailStore.updateSpamScore(id, userId, newScore);
        if (newScore >= SPAM_THRESHOLD) {
          await mailStore.move(id, userId, 'Spam');
        }
      }
      logger.info(`LLM re-score: +${extra} (llm=${verdict.score}) -> ${newScore} [${verdict.reason}]`);
    } catch (err) {
      logger.debug(`LLM rescore skipped: ${(err as Error).message}`);
    }
  })();
}

/**
 * Handles a fully received SMTP message: parses it, scans it for viruses,
 * runs spam/tracking analysis, resolves local recipients and stores the
 * message per recipient.
 *
 * The antivirus scan runs immediately after parsing and before the spam
 * filter. On a positive verdict (or scanner unavailable under fail-closed) a
 * VirusRejectedError is thrown, which the SMTP layer maps to a 5xx/4xx reply
 * so the message is never stored. After storage, an asynchronous LLM phishing
 * re-score may raise the spam score without blocking delivery.
 */
export async function ingestMessage(session: SMTPSession, rawData: string): Promise<void> {
  const parsed = parseMessage(rawData);

  // Antivirus gate (throws VirusRejectedError on infection / unavailable).
  const scan = await scanEmailOrThrow(rawData);
  if (scan.status === 'clean') {
    logger.debug(`AV scan clean for ${parsed.messageId}`);
  }

  const analysis = await spamFilter.analyze({
    from: session.mailFrom ?? parsed.from,
    senderIP: session.remoteAddress,
    subject: parsed.subject,
    body: parsed.body,
    headers: parsed.headers,
    raw: rawData,
  });

  const targetMailbox = analysis.isSpam ? 'Spam' : 'INBOX';
  const stored: { id: string; userId: string }[] = [];

  for (const rcpt of session.rcptTo) {
    const address = extractAddress(rcpt) ?? rcpt;
    const user = await findByEmail(address);
    if (!user) {
      logger.warn(`No local user for recipient ${address}; message dropped`);
      continue;
    }
    const id = await mailStore.store({
      userId: user.id,
      messageId: parsed.messageId,
      from: session.mailFrom ?? parsed.from,
      to: address,
      subject: parsed.subject,
      body: analysis.cleanedBody,
      raw: rawData,
      isEncrypted: /BEGIN PGP MESSAGE/.test(rawData),
      spamScore: analysis.score,
      mailbox: targetMailbox,
    });
    stored.push({ id, userId: user.id });
    logger.info(`Delivered to ${address} (mailbox=${targetMailbox}, score=${analysis.score})`);
  }

  // Non-blocking LLM phishing re-score after delivery.
  if (stored.length > 0) {
    scheduleLlmRescore(stored, parsed.subject, analysis.cleanedBody, analysis.score);
  }
}
