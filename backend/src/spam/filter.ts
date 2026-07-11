import { BayesClassifier } from './bayes';
import { detectTrackingPixels, removeTrackingPixels } from './tracking';
import { blacklist, whitelist } from './whitelist';
import { checkSPF } from '../dns/spf';
import { checkDKIM } from '../dns/dkim';
import { checkDMARC } from '../dns/dmarc';
import { domainOf } from '../dns/resolver';
import { SPAM_THRESHOLD } from '../config/constants';
import { logger } from '../utils/logger';

export interface EmailForAnalysis {
  from: string;
  senderIP: string;
  subject: string;
  body: string;
  headers: Record<string, string>;
  raw: string;
}

export interface SpamAnalysis {
  isSpam: boolean;
  score: number;
  reasons: string[];
  cleanedBody: string;
}

const PHISHING_MARKERS = [
  'phishing',
  'fake-bank',
  'verify-account',
  'secure-update',
  'confirm-identity',
  'verify-payment',
  'account-locked',
];

export class SpamFilter {
  private bayes: BayesClassifier;

  constructor(bayes?: BayesClassifier) {
    this.bayes = bayes ?? new BayesClassifier();
    this.bayes.seedDefaults();
  }

  train(text: string, isSpam: boolean): void {
    this.bayes.train(text, isSpam);
  }

  async analyze(email: EmailForAnalysis): Promise<SpamAnalysis> {
    let score = 0;
    const reasons: string[] = [];

    if (whitelist.has(email.from)) {
      return { isSpam: false, score: 0, reasons: ['Absender auf Whitelist'], cleanedBody: email.body };
    }

    if (blacklist.has(email.from)) {
      score += 15;
      reasons.push('Absender auf Blacklist');
    }

    try {
      const spf = await checkSPF(email.from, email.senderIP);
      const dkim = await checkDKIM({ headers: email.headers, body: email.body, raw: email.raw });
      const dmarc = await checkDMARC(
        email.from,
        { pass: spf.pass, domain: domainOf(email.from) },
        { pass: dkim.pass, domain: dkim.domain },
      );

      if (!spf.pass) {
        score += 5;
        reasons.push(`SPF-Fehler: ${spf.reason}`);
      }
      if (!dkim.pass) {
        score += 5;
        reasons.push(`DKIM-Fehler: ${dkim.reason}`);
      }
      if (dmarc.action === 'reject') {
        score += 10;
        reasons.push('DMARC: reject-Policy nicht erfüllt');
      } else if (dmarc.action === 'quarantine') {
        score += 6;
        reasons.push('DMARC: quarantine-Policy nicht erfüllt');
      }
    } catch (err) {
      logger.debug('Auth checks skipped', (err as Error).message);
    }

    const bayesScore = this.bayes.classify(`${email.subject} ${email.body}`);
    if (bayesScore > 0.8) {
      score += 10;
      reasons.push(`Bayes: Spam-Wahrscheinlichkeit ${(bayesScore * 100).toFixed(0)}%`);
    } else if (bayesScore > 0.6) {
      score += 4;
      reasons.push(`Bayes: erhöhte Spam-Wahrscheinlichkeit ${(bayesScore * 100).toFixed(0)}%`);
    }

    const pixels = detectTrackingPixels(email.body);
    let cleanedBody = email.body;
    if (pixels.length > 0) {
      score += 3;
      reasons.push(`${pixels.length} Tracking-Pixel gefunden und entfernt`);
      cleanedBody = removeTrackingPixels(email.body).cleaned;
    }

    for (const url of this.extractURLs(email.body)) {
      if (this.isPhishingURL(url)) {
        score += 10;
        reasons.push(`Phishing-URL erkannt: ${url}`);
        break;
      }
    }

    return { isSpam: score >= SPAM_THRESHOLD, score, reasons, cleanedBody };
  }

  private extractURLs(body: string): string[] {
    return body.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  }

  private isPhishingURL(url: string): boolean {
    try {
      const { hostname } = new URL(url);
      const host = hostname.toLowerCase();
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return true;
      return PHISHING_MARKERS.some((m) => host.includes(m));
    } catch {
      return false;
    }
  }
}

export const spamFilter = new SpamFilter();
