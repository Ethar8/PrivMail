export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 8;
}

export function parseRecipients(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateRecipients(value: string): { valid: boolean; invalid: string[] } {
  const list = parseRecipients(value);
  const invalid = list.filter((r) => !isValidEmail(r));
  return { valid: invalid.length === 0 && list.length > 0, invalid };
}
