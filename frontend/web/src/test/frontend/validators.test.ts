import { isValidEmail, isStrongPassword, parseRecipients, validateRecipients } from '../../lib/validators';

describe('validators', () => {
  it('validates email addresses', () => {
    expect(isValidEmail('a@b.de')).toBe(true);
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('  a@b.de  ')).toBe(true);
  });

  it('checks password strength', () => {
    expect(isStrongPassword('12345678')).toBe(true);
    expect(isStrongPassword('short')).toBe(false);
  });

  it('parses recipient lists', () => {
    expect(parseRecipients('a@b.de, b@c.de')).toEqual(['a@b.de', 'b@c.de']);
    expect(parseRecipients('')).toEqual([]);
  });

  it('validates recipients', () => {
    expect(validateRecipients('a@b.de').valid).toBe(true);
    expect(validateRecipients('bad').valid).toBe(false);
    expect(validateRecipients('bad, a@b.de').invalid).toContain('bad');
  });
});
