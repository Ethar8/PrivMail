import { z } from 'zod';

export function isValidEmail(email: string): boolean {
  // Allows standard addresses and local/internal hostnames without a TLD
  // (e.g. admin@localhost), which are valid for a self-hosted mail server.
  return /^[^\s@]+@[^\s@]+$/.test(email.trim());
}

/** Zod schema for an email address that also accepts local domains. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => isValidEmail(v), { message: 'Invalid email' });

export function extractAddress(input: string): string | null {
  const match = input.match(/<([^>]+)>/);
  const candidate = (match ? match[1] : input).trim();
  return isValidEmail(candidate) ? candidate.toLowerCase() : null;
}

export function sanitizeMailbox(name: string): string {
  return name.replace(/[^A-Za-z0-9_\-./]/g, '').slice(0, 128) || 'INBOX';
}
