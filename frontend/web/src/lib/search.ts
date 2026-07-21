import { getDB, LocalEmail, mapEmailRow } from './db';
import { naturalLanguageToSearchTerms, isAIEnabled } from './ai';

export async function searchEmailsLocally(query: string, mailbox?: string): Promise<LocalEmail[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let searchText = trimmed;
  if (isAIEnabled() && /\s/.test(trimmed) && trimmed.split(/\s+/).length >= 3) {
    try {
      searchText = await naturalLanguageToSearchTerms(trimmed);
    } catch {
      searchText = trimmed;
    }
  }

  const { sql } = await getDB();
  const ftsQuery = sanitizeFtsQuery(searchText);
  if (!ftsQuery) return [];

  const rows = mailbox
    ? await sql`
        SELECT e.* FROM emails e
        JOIN emails_fts fts ON e.rowid = fts.rowid
        WHERE emails_fts MATCH ${ftsQuery} AND e.mailbox = ${mailbox}
        ORDER BY e.received_at DESC
      `
    : await sql`
        SELECT e.* FROM emails e
        JOIN emails_fts fts ON e.rowid = fts.rowid
        WHERE emails_fts MATCH ${ftsQuery}
        ORDER BY e.received_at DESC
      `;

  return rows.map(mapEmailRow);
}

export function sanitizeFtsQuery(query: string): string {
  const terms = query
    .replace(/["'*^()~:!\-?;=<>%&|\\\/\n\r\t\0]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.substring(0, 64))
    .filter((t) => t.length > 0);

  if (terms.length === 0) return '';
  return terms.map((t) => `"${t}"`).join(' ');
}
