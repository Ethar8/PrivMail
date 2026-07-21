import { IncomingHttpHeaders } from 'http';

export function parseCookieHeader(headers: IncomingHttpHeaders): Record<string, string> {
  const raw = headers.cookie;
  if (!raw) return {};
  const text = Array.isArray(raw) ? raw.join('; ') : raw;
  const out: Record<string, string> = {};
  for (const part of text.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getCookie(headers: IncomingHttpHeaders, name: string): string | null {
  const cookies = parseCookieHeader(headers);
  return cookies[name] ?? null;
}
