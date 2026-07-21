import { logger } from '../utils/logger';

export interface SecurityCheckResult {
    isSafe: boolean;
    threatLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
    reasons: string[];
    warning: string | null;
}

interface AIProviderConfig {
    enabled: boolean;
    model: string;
    endpoint: string;
    timeoutMs: number;
    sensitivity: number;
}

// Cache für bereits geprüfte E-Mails, um API-Aufrufe zu sparen
const securityCheckCache = new Map<string, SecurityCheckResult>();

export class AISecurityChecker {
    private async getConfig(): Promise<AIProviderConfig | null> {
        // Lade Konfiguration aus der Datenbank (gleiches Store wie LLM-Spam-Filter)
        try {
            const { getAiConfig } = await import('../spam/ai-config-store');
            const cfg = await getAiConfig();
            if (!cfg.enabled) return null;
            return cfg as unknown as AIProviderConfig;
        } catch (err) {
            logger.debug('Security checker: AI config not available');
            return null;
        }
    }

    async checkEmail(
        emailContent: string,
        _attachments: unknown[],
        from: string,
        subject: string
    ): Promise<SecurityCheckResult> {
        // Cache-Check: Wenn wir diese E-Mail bereits geprüft haben
        const cacheKey = `${from}:${subject}`;
        if (securityCheckCache.has(cacheKey)) {
            return securityCheckCache.get(cacheKey)!;
        }

        const cfg = await this.getConfig();
        if (!cfg) {
            return {
                isSafe: true,
                threatLevel: 'safe',
                reasons: [],
                warning: null
            };
        }

        try {
            // Prompt für das LLM: E-Mail-Sicherheitsanalyse
            const prompt = `
Analysiere die folgende E-Mail auf Sicherheitsrisiken: Phishing, Betrug, Malware-Links, Social Engineering.

Absender: ${from}
Betreff: ${subject}
Inhalt:
${emailContent.substring(0, 2000)} // Nur erste 2000 Zeichen für die Analyse

Antwortformat ist NUR JSON, kein zusätzlicher Text. Beispiel:
{
  "isSafe": boolean,
  "threatLevel": "safe"|"low"|"medium"|"high"|"critical",
  "reasons": string[],
  "warning": string|null
}
            `;

            // Anfrage an das konfigurierte LLM
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), cfg.timeoutMs);

            const response = await fetch(cfg.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: cfg.model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.0
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const data = await response.json();

            const rawContent =
              data?.choices?.[0]?.message?.content ??
              data?.message?.content ??
              data?.response ??
              '';
            const result = JSON.parse(rawContent) as SecurityCheckResult;

            // Im Cache speichern
            securityCheckCache.set(cacheKey, result);
            return result;
        } catch (err) {
            logger.debug(`Security check failed: ${(err as Error).message}`);
            // Fail-open: Wenn die KI nicht erreichbar ist, als safe markieren
            return {
                isSafe: true,
                threatLevel: 'safe',
                reasons: [],
                warning: 'Sicherheitscheck fehlgeschlagen'
            };
        }
    }
}

export const aiSecurityChecker = new AISecurityChecker();
