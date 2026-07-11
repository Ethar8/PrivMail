import { randomUUID } from 'crypto';

export interface ParsedMessage {
  messageId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  date: string;
  headers: Record<string, string>;
  body: string;
  raw: string;
}

/**
 * Minimal RFC 822 / 5322 message parser. Splits headers from body,
 * unfolds header lines and extracts common fields.
 */
export function parseMessage(raw: string): ParsedMessage {
  const sepIdx = raw.indexOf('\r\n\r\n');
  const headerBlock = sepIdx === -1 ? raw : raw.slice(0, sepIdx);
  const body = sepIdx === -1 ? '' : raw.slice(sepIdx + 4);

  const headers: Record<string, string> = {};
  const rawLines = headerBlock.split('\r\n');
  const unfolded: string[] = [];
  for (const line of rawLines) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += ' ' + line.trim();
    } else {
      unfolded.push(line);
    }
  }
  for (const line of unfolded) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    headers[key] = value;
  }

  const splitAddrs = (v?: string): string[] =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    messageId: headers['message-id'] ?? `<${randomUUID()}@privmail>`,
    from: headers['from'] ?? '',
    to: splitAddrs(headers['to']),
    cc: splitAddrs(headers['cc']),
    subject: headers['subject'] ?? '(no subject)',
    date: headers['date'] ?? new Date().toUTCString(),
    headers,
    body,
    raw,
  };
}
