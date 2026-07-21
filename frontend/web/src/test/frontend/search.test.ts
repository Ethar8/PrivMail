import { sanitizeFtsQuery } from '../../lib/search';

describe('sanitizeFtsQuery', () => {
  it('wraps terms in double quotes', () => {
    const result = sanitizeFtsQuery('hello world');
    expect(result).toBe('"hello" "world"');
  });

  it('removes SQL injection characters', () => {
    const result = sanitizeFtsQuery('" OR 1=1 --');
    expect(result).not.toContain('=');
    expect(result).not.toContain("'");
    expect(result).toContain('OR');
    expect(result).toContain('1');
  });

  it('removes FTS5 syntax characters - operators become safe quoted terms', () => {
    const result = sanitizeFtsQuery('hello AND world OR test NOT spam');
    expect(result).not.toContain('(');
    expect(result).not.toContain(')');
    expect(result).toContain('hello');
    expect(result).toContain('world');
    expect(result).toContain('test');
    expect(result).toContain('spam');
  });

  it('removes parentheses and wildcard characters', () => {
    const result = sanitizeFtsQuery('(hello) *world* test*');
    expect(result).not.toContain('(');
    expect(result).not.toContain(')');
    expect(result).not.toContain('*');
    expect(result).toContain('hello');
    expect(result).toContain('world');
    expect(result).toContain('test');
  });

  it('removes NEAR syntax but keeps words and number as safe quoted terms', () => {
    const result = sanitizeFtsQuery('hello NEAR(5) world');
    expect(result).not.toContain('(');
    expect(result).not.toContain(')');
    expect(result).toContain('hello');
    expect(result).toContain('world');
    expect(result).toContain('5');
  });

  it('truncates terms longer than 64 characters', () => {
    const longTerm = 'a'.repeat(100);
    const result = sanitizeFtsQuery(longTerm);
    const innerTerm = result.replace(/^"|"$/g, '');
    expect(innerTerm.length).toBeLessThanOrEqual(64);
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeFtsQuery('')).toBe('');
  });

  it('returns empty string for whitespace only', () => {
    expect(sanitizeFtsQuery('   \t\n  ')).toBe('');
  });

  it('preserves unicode characters', () => {
    const result = sanitizeFtsQuery('Grüße こんにちは');
    expect(result).toContain('Grüße');
    expect(result).toContain('こんにちは');
  });

  it('removes semicolons and keeps surrounding words', () => {
    const result = sanitizeFtsQuery('hello;world');
    expect(result).not.toContain(';');
    expect(result).toContain('hello');
    expect(result).toContain('world');
  });
});
