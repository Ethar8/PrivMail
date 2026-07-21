import { sanitizeFtsQuery } from '../../lib/search';

describe('FTS5 injection - edge cases', () => {
  it('removes colon syntax', () => {
    const result = sanitizeFtsQuery('subject:phishing');
    expect(result).not.toContain(':');
    expect(result).toContain('subject');
    expect(result).toContain('phishing');
  });

  it('removes null byte', () => {
    const result = sanitizeFtsQuery('test\u0000injection');
    expect(result).not.toContain('\u0000');
    expect(result).toContain('test');
    expect(result).toContain('injection');
  });

  it('removes caret', () => {
    const result = sanitizeFtsQuery('^hello');
    expect(result).not.toContain('^');
    expect(result).toContain('hello');
  });

  it('removes tilde', () => {
    const result = sanitizeFtsQuery('hello~5');
    expect(result).not.toContain('~');
    expect(result).toContain('hello');
    expect(result).toContain('5');
  });

  it('removes exclamation mark', () => {
    const result = sanitizeFtsQuery('!safe');
    expect(result).not.toContain('!');
    expect(result).toContain('safe');
  });

  it('removes repeated special characters', () => {
    const result = sanitizeFtsQuery('!!!hello!!!***world***???');
    expect(result).not.toContain('!');
    expect(result).not.toContain('*');
    expect(result).not.toContain('?');
    expect(result).toContain('hello');
    expect(result).toContain('world');
  });

  it('limits result length for very long input', () => {
    const longQuery = Array(200).fill('verylongterm').join(' ');
    const result = sanitizeFtsQuery(longQuery);
    expect(result.length).toBeLessThan(5000);
  });

  it('handles mixed legitimate and injection content', () => {
    const result = sanitizeFtsQuery('meeting agenda confidential share');
    expect(result).toContain('meeting');
    expect(result).toContain('agenda');
    expect(result).toContain('confidential');
    expect(result).toContain('share');
  });
});
