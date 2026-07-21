import { sanitizeFtsQuery } from '../../lib/search';

describe('FTS5 operator injection prevention', () => {
  const safeChars = ['(', ')', '*', "'", ';', '=', ':', '!', '^', '~', '\\'];

  for (const char of safeChars) {
    it(`removes "${char}" character from input`, () => {
      const result = sanitizeFtsQuery(`test${char}injection`);
      const unquoted = result.replace(/^"|"$/g, '');
      expect(result).not.toContain(`${char}injection`);
      expect(result).not.toContain(`test${char}`);
    });
  }

  it('sanitizes SQL-like injection: " OR 1=1 --', () => {
    const result = sanitizeFtsQuery('" OR 1=1 --');
    expect(result).not.toContain('=');
    expect(result).not.toContain('-');
    expect(result).toContain('OR');
    expect(result).toContain('1');
  });

  it('sanitizes semicolon injection: ; DROP TABLE', () => {
    const result = sanitizeFtsQuery('; DROP TABLE emails; --');
    expect(result).not.toContain(';');
    expect(result).not.toContain('=');
    expect(result).toContain('DROP');
    expect(result).toContain('TABLE');
    expect(result).toContain('emails');
  });

  it('sanitizes single quote injection', () => {
    const result = sanitizeFtsQuery("' OR '1'='1");
    expect(result).not.toContain("'");
    expect(result).not.toContain('=');
  });

  it('handles complex nested injection', () => {
    const result = sanitizeFtsQuery('a OR (b AND c) NOT d NEAR(3) e');
    expect(result).not.toContain('(');
    expect(result).not.toContain(')');
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toContain('c');
    expect(result).toContain('d');
    expect(result).toContain('3');
    expect(result).toContain('e');
  });
});
