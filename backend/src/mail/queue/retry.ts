import { QUEUE_MAX_RETRIES, QUEUE_BASE_BACKOFF_MS } from '../../config/constants';

/**
 * Exponential backoff schedule for outbound delivery retries.
 */
export function nextRetryDelay(attempt: number): number {
  return Math.min(60 * 60 * 1000, QUEUE_BASE_BACKOFF_MS * 2 ** attempt);
}

export function shouldRetry(attempt: number): boolean {
  return attempt < QUEUE_MAX_RETRIES;
}

/**
 * Classifies an SMTP reply code: 4xx = temporary (retry), 5xx = permanent
 * (bounce), 2xx = success.
 */
export function classifyReply(code: number): 'success' | 'temporary' | 'permanent' {
  if (code >= 200 && code < 300) return 'success';
  if (code >= 400 && code < 500) return 'temporary';
  return 'permanent';
}
