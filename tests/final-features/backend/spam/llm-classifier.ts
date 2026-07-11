import { logger } from '../utils/logger';

/**
 * Local LLM (Ollama) phishing classifier.
 *
 * Runs AFTER delivery, asynchronously, so it never blocks the SMTP dialog.
 * Sends the mail text to a local Ollama instance and asks for a phishing risk
 * score in [0,10]. Fail-open: any error yields a null result (no penalty), so
 * a slow/offline LLM never blocks or misclassifies legitimate mail.
 */

export interface LlmConfig {
  enabled: boolean;
  endpoint: string; // e.g. http://ollama:11434
  model: string; // e.g. llama3, mistral
  timeoutMs: number;
}

export interface LlmVerdict {
  score: number; // 0..10 phishing risk
  reason: string;
  raw?: string;
}

const PROMPT = (subject: string, body: string): string =>
  `Du bist ein E-Mail-Sicherheitsanalyst. Bewerte die folgende E-Mail auf Phishing/Scam.
Antworte AUSSCHLIESSLICH mit kompaktem JSON: {"score": <0-10>, "reason": "<kurz>"}.
score 0 = harmlos, 10 = eindeutiges Phishing.

Betreff: ${subject}

Text:
${body.slice(0, 4000)}`;

function extractJson(text: string): { score: number; reason: string } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const score = Number(parsed.score);
    if (!Number.isFinite(score)) return null;
    return { score: Math.max(0, Math.min(10, score)), reason: String(parsed.reason ?? '') };
  } catch {
    return null;
  }
}

export async function classifyWithLlm(
  config: LlmConfig,
  subject: string,
  body: string,
): Promise<LlmVerdict | null> {
  if (!config.enabled) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch(`${config.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: PROMPT(subject, body),
        stream: false,
        options: { temperature: 0 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn(`LLM classifier: Ollama responded ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { response?: string };
    const parsed = extractJson(data.response ?? '');
    if (!parsed) {
      logger.debug('LLM classifier: could not parse response');
      return null;
    }
    return { score: parsed.score, reason: parsed.reason, raw: data.response };
  } catch (err) {
    // Fail-open: LLM offline/slow must never block or penalize mail.
    logger.debug(`LLM classifier unavailable: ${(err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Maps an LLM phishing score (0..10) to an additive spam-score contribution,
 * matching the weighting style of the existing rule-based filter.
 */
export function llmScoreToSpamPoints(llmScore: number): number {
  if (llmScore >= 8) return 12;
  if (llmScore >= 6) return 7;
  if (llmScore >= 4) return 3;
  return 0;
}
