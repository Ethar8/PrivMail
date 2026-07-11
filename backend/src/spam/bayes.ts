/**
 * Naive Bayes classifier for spam detection. Trained incrementally with
 * spam/ham samples; classify() returns a spam probability in [0, 1].
 */
export class BayesClassifier {
  private spamCounts = new Map<string, number>();
  private hamCounts = new Map<string, number>();
  private spamTotal = 0;
  private hamTotal = 0;
  private spamMessages = 0;
  private hamMessages = 0;

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && t.length < 40);
  }

  train(text: string, isSpam: boolean): void {
    const tokens = new Set(this.tokenize(text));
    if (isSpam) this.spamMessages += 1;
    else this.hamMessages += 1;
    for (const token of tokens) {
      if (isSpam) {
        this.spamCounts.set(token, (this.spamCounts.get(token) ?? 0) + 1);
        this.spamTotal += 1;
      } else {
        this.hamCounts.set(token, (this.hamCounts.get(token) ?? 0) + 1);
        this.hamTotal += 1;
      }
    }
  }

  private tokenSpamProb(token: string): number {
    const spam = this.spamCounts.get(token) ?? 0;
    const ham = this.hamCounts.get(token) ?? 0;
    if (spam + ham === 0) return 0.4;
    const pSpam = spam / Math.max(1, this.spamMessages);
    const pHam = ham / Math.max(1, this.hamMessages);
    const prob = pSpam / (pSpam + pHam);
    // clamp to avoid 0/1 extremes
    return Math.min(0.99, Math.max(0.01, prob));
  }

  classify(text: string): number {
    if (this.spamMessages === 0 && this.hamMessages === 0) return 0;
    const tokens = [...new Set(this.tokenize(text))].slice(0, 200);
    if (tokens.length === 0) return 0;
    // combine via log to avoid float underflow (Fisher/Robinson style)
    let logSum = 0;
    for (const token of tokens) {
      const p = this.tokenSpamProb(token);
      logSum += Math.log(1 - p) - Math.log(p);
    }
    return 1 / (1 + Math.exp(logSum));
  }

  seedDefaults(): void {
    const spamSamples = [
      'congratulations you won a free prize claim now click here',
      'viagra cheap pills buy now limited offer',
      'urgent your account will be suspended verify immediately',
      'make money fast work from home earn thousands',
      'you have inherited millions send bank details',
    ];
    const hamSamples = [
      'hi please find attached the report we discussed yesterday',
      'meeting scheduled for tomorrow at ten in the office',
      'thanks for your email i will get back to you soon',
      'the project deadline is next friday lets sync up',
      'here are the notes from our call earlier today',
    ];
    spamSamples.forEach((s) => this.train(s, true));
    hamSamples.forEach((h) => this.train(h, false));
  }
}
