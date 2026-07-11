// ============================================================================
// PATCH for backend/src/mail/ingest.ts
// Adds an ASYNCHRONOUS, post-delivery LLM phishing check that never blocks the
// SMTP dialog. After the message is stored, we kick off classifyWithLlm() and,
// if it raises the risk, bump the stored spam_score (and optionally move to
// Spam). Fully fail-open.
// ============================================================================

// --- new imports to add at the top of ingest.ts ---
// import { classifyWithLlm, llmScoreToSpamPoints } from '../spam/llm-classifier';
// import { getAiConfig } from '../spam/ai-config-store';

// --- new helper (module scope) ---
import { classifyWithLlm, llmScoreToSpamPoints } from '../spam/llm-classifier';
import { getAiConfig } from '../spam/ai-config-store';
import { mailStore } from '../../mail/storage/mailstore';
import { SPAM_THRESHOLD } from '../../config/constants';
import { logger } from '../../utils/logger';

/**
 * Fire-and-forget LLM re-scoring. Call WITHOUT await at the end of
 * ingestMessage so the SMTP dialog completes immediately.
 */
export function scheduleLlmRescore(
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

      // Sensitivity (0..100) scales the LLM contribution.
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
