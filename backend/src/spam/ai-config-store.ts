import { query } from '../database/connection';

/**
 * Server-side AI configuration for the LLM spam classifier. Stored as a single
 * row (id = 1) so the admin dashboard sliders persist across restarts.
 */
export interface AiConfig {
  enabled: boolean;
  model: string; // 'llama3' | 'mistral' | 'disabled' etc.
  endpoint: string;
  sensitivity: number; // 0..100 slider -> maps to spam threshold weighting
  timeoutMs: number;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  model: 'llama3',
  endpoint: process.env.OLLAMA_HOST ?? 'http://ollama:11434',
  sensitivity: 50,
  timeoutMs: 15000,
};

export async function getAiConfig(): Promise<AiConfig> {
  try {
    const { rows } = await query<{ config: AiConfig }>(
      `SELECT config FROM ai_config WHERE id = 1`,
    );
    if (rows[0]?.config) return { ...DEFAULT_AI_CONFIG, ...rows[0].config };
  } catch {
    /* table may not exist yet -> defaults */
  }
  return DEFAULT_AI_CONFIG;
}

export async function saveAiConfig(patch: Partial<AiConfig>): Promise<AiConfig> {
  const current = await getAiConfig();
  const merged: AiConfig = { ...current, ...patch };
  await query(
    `INSERT INTO ai_config (id, config) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET config = $1, updated_at = NOW()`,
    [JSON.stringify(merged)],
  );
  return merged;
}
