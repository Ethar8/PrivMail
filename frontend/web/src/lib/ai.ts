export interface AIProvider {
  provider: 'ollama' | 'openai' | 'custom';
  endpoint: string;
  apiKey?: string;
  model: string;
  enabled: boolean;
}

const STORAGE_KEY = 'privmail-ai-config';
let aiConfig: AIProvider | null = null;

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
