export interface AIProvider {
  provider: 'ollama' | 'openai' | 'custom';
  endpoint: string;
  apiKey?: string;
  model: string;
  enabled: boolean;
}

export interface SecurityConfig {
  enabled: boolean;
}

const STORAGE_KEY = 'privmail-ai-config';
const SECURITY_STORAGE_KEY = 'privmail-security-config';
let aiConfig: AIProvider | null = null;
let securityConfig: SecurityConfig | null = null;

export function configureAI(config: AIProvider): void {
  aiConfig = config;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function loadAIConfig(): AIProvider | null {
  if (aiConfig) return aiConfig;
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    aiConfig = JSON.parse(saved) as AIProvider;
    return aiConfig;
  }
  return null;
}

export function saveSecurityConfig(config: SecurityConfig): void {
  securityConfig = config;
  localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(config));
}

export function loadSecurityConfig(): SecurityConfig | null {
  if (securityConfig) return securityConfig;
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(SECURITY_STORAGE_KEY);
  if (saved) {
    securityConfig = JSON.parse(saved) as SecurityConfig;
    return securityConfig;
  }
  return null;
}

export function isSecurityCheckEnabled(): boolean {
  const config = loadSecurityConfig();
  return config !== null && config.enabled === true;
}

export function isAIEnabled(): boolean {
  const config = loadAIConfig();
  return config !== null && config.enabled === true;
}

async function complete(prompt: string, maxTokens: number, temperature: number): Promise<string> {
  const config = loadAIConfig();
  if (!config || !config.enabled) {
    throw new Error('KI-Assistent nicht konfiguriert oder deaktiviert.');
  }

  if (config.provider === 'ollama') {
    const res = await fetch(`${config.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, prompt, stream: false, options: { temperature } }),
    });
    if (!res.ok) throw new Error(`Ollama-Fehler: ${res.status}`);
    const data = await res.json();
    return data.response ?? '';
  }

  const res = await fetch(`${config.endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: 'Du bist ein hilfreicher E-Mail-Assistent.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!res.ok) throw new Error(`API-Fehler: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function summarizeEmail(content: string): Promise<string> {
  const prompt = `Fasse folgende E-Mail kurz und prägnant zusammen (maximal 3 Sätze, auf Deutsch):\n\n${content}`;
  return (await complete(prompt, 150, 0.3)) || 'Keine Zusammenfassung verfügbar.';
}

export async function suggestReply(emailContent: string): Promise<string> {
  const prompt = `Generiere eine professionelle Antwort auf folgende E-Mail (auf Deutsch, max. 100 Wörter):\n\n${emailContent}`;
  return complete(prompt, 250, 0.5);
}

/** Session-only cache for thread summaries (not persisted). */
const threadSummaryCache = new Map<string, string>();

export async function summarizeThread(threadId: string, messages: string[]): Promise<string> {
  const cacheKey = `${threadId}:${messages.length}:${messages[messages.length - 1]?.slice(0, 64) ?? ''}`;
  const cached = threadSummaryCache.get(cacheKey);
  if (cached) return cached;

  const combined = messages.map((m, i) => `--- Nachricht ${i + 1} ---\n${m}`).join('\n\n');
  const prompt = `Fasse diesen E-Mail-Verlauf in maximal 5 Stichpunkten zusammen (Deutsch, nur Kernpunkte):\n\n${combined.slice(0, 8000)}`;
  const summary = (await complete(prompt, 300, 0.2)) || 'Keine Zusammenfassung verfügbar.';
  threadSummaryCache.set(cacheKey, summary);
  return summary;
}

export function clearThreadSummaryCache(): void {
  threadSummaryCache.clear();
}

export interface ToneCheckResult {
  shouldReview: boolean;
  hint: string | null;
  tone: 'neutral' | 'harsh' | 'unclear' | 'emotional';
}

export async function checkToneBeforeSend(body: string): Promise<ToneCheckResult> {
  if (!isAIEnabled()) {
    return { shouldReview: false, hint: null, tone: 'neutral' };
  }
  const prompt = `Analysiere den Ton dieser E-Mail-Antwort. Antwort NUR als JSON:
{"tone":"neutral"|"harsh"|"unclear"|"emotional","shouldReview":boolean,"hint":string|null}

E-Mail:
${body.slice(0, 2000)}`;
  try {
    const raw = await complete(prompt, 120, 0.1);
    const parsed = JSON.parse(raw.trim()) as ToneCheckResult;
    return {
      shouldReview: !!parsed.shouldReview,
      hint: parsed.hint ?? null,
      tone: parsed.tone ?? 'neutral',
    };
  } catch {
    return { shouldReview: false, hint: null, tone: 'neutral' };
  }
}

/**
 * Translates natural-language search queries into sanitized FTS5 terms.
 * Output MUST pass through sanitizeFtsQuery before querying SQLite.
 */
export async function naturalLanguageToSearchTerms(query: string): Promise<string> {
  if (!isAIEnabled()) return query;
  const prompt = `Übersetze diese natürlichsprachige E-Mail-Suche in 2-6 Suchbegriffe (nur Wörter, kein SQL, keine Operatoren, Deutsch/Englisch):
"${query.slice(0, 500)}"

Antwortformat: nur die Begriffe, durch Leerzeichen getrennt.`;
  const terms = (await complete(prompt, 60, 0)).trim();
  return terms || query;
}

export async function suggestPasswordProtection(recipientEmail: string, hasPgpKey: boolean): Promise<string | null> {
  if (hasPgpKey || !isAIEnabled()) return null;
  const prompt = `Der Empfänger ${recipientEmail} hat vermutlich keinen PGP-Schlüssel. Formuliere EINEN kurzen Satz (Deutsch), der den Absender fragt, ob er Passwortschutz aktivieren möchte. Max. 20 Wörter.`;
  try {
    return (await complete(prompt, 40, 0.3)).trim() || null;
  } catch {
    return 'Empfänger hat keinen PGP-Schlüssel – Passwortschutz aktivieren?';
  }
}

export type RewriteTone = 'formal' | 'friendly' | 'direct';
export type RewriteLength = 'longer' | 'shorter';

/** Proton-Scribe-style: lengthen or shorten draft text. */
export async function rewriteLength(text: string, mode: RewriteLength): Promise<string> {
  if (!isAIEnabled()) throw new Error('KI nicht aktiviert (Ollama lokal empfohlen).');
  const instruction =
    mode === 'longer'
      ? 'Verlängere den Text höflich und klar, behalte die Aussage bei (Deutsch).'
      : 'Kürze den Text auf das Wesentliche, behalte den Ton bei (Deutsch).';
  const prompt = `${instruction}\n\nText:\n${text.slice(0, 4000)}\n\nAntworte NUR mit dem umgeschriebenen Text.`;
  return (await complete(prompt, mode === 'longer' ? 500 : 200, 0.4)).trim();
}

/** Adjust tone: formal / friendly / direct. */
export async function rewriteTone(text: string, tone: RewriteTone): Promise<string> {
  if (!isAIEnabled()) throw new Error('KI nicht aktiviert (Ollama lokal empfohlen).');
  const map = {
    formal: 'formell und professionell',
    friendly: 'freundlich und warm',
    direct: 'direkt und knapp',
  } as const;
  const prompt = `Formuliere den folgenden Text ${map[tone]} um (Deutsch). Antworte NUR mit dem neuen Text.\n\n${text.slice(0, 4000)}`;
  return (await complete(prompt, 400, 0.4)).trim();
}

/** Generate a full email draft from bullet points. */
export async function draftFromBullets(bullets: string, context?: string): Promise<string> {
  if (!isAIEnabled()) throw new Error('KI nicht aktiviert (Ollama lokal empfohlen).');
  const prompt = `Schreibe eine vollständige, höfliche E-Mail auf Deutsch aus diesen Stichpunkten.
${context ? `Kontext: ${context.slice(0, 500)}\n` : ''}
Stichpunkte:
${bullets.slice(0, 2000)}

Antworte NUR mit dem E-Mail-Text (ohne Betreff).`;
  return (await complete(prompt, 500, 0.5)).trim();
}
