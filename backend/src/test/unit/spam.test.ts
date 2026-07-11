import { SpamFilter } from '../../spam/filter';
import { detectTrackingPixels, removeTrackingPixels } from '../../spam/tracking';
import { BayesClassifier } from '../../spam/bayes';

jest.mock('../../dns/spf', () => ({
  checkSPF: async () => ({ pass: true, result: 'pass', record: null, reason: 'test' }),
}));
jest.mock('../../dns/dkim', () => ({
  checkDKIM: async () => ({ pass: true, domain: null, selector: null, reason: 'test' }),
}));
jest.mock('../../dns/dmarc', () => ({
  checkDMARC: async () => ({ pass: true, policy: 'none', record: null, reason: 'test', action: 'accept' }),
}));

describe('Bayes classifier', () => {
  it('scores spam higher than ham after training', () => {
    const bayes = new BayesClassifier();
    bayes.seedDefaults();
    const spam = bayes.classify('congratulations you won a free prize claim now');
    const ham = bayes.classify('meeting scheduled for tomorrow in the office');
    expect(spam).toBeGreaterThan(ham);
  });
});

describe('Tracking pixel removal', () => {
  it('detects and removes tracking pixels', () => {
    const body = '<p>Hi</p><img src="https://track.example.com/pixel/beacon.gif" width="1" height="1">';
    expect(detectTrackingPixels(body).length).toBeGreaterThan(0);
    const { cleaned } = removeTrackingPixels(body);
    expect(cleaned).not.toContain('beacon.gif');
  });
});

describe('SpamFilter', () => {
  it('flags spammy content and returns reasons', async () => {
    const filter = new SpamFilter();
    const result = await filter.analyze({
      from: 'spammer@example.com',
      senderIP: '1.2.3.4',
      subject: 'You won a free prize',
      body: 'congratulations you won a free prize claim now click here money fast',
      headers: {},
      raw: 'raw',
    });
    expect(result.score).toBeGreaterThan(0);
    expect(Array.isArray(result.reasons)).toBe(true);
  });
});
