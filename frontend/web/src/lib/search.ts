import { getDB, LocalEmail, mapEmailRow } from './db';

/**
 * Privacy-preserving full-text search. Runs entirely against the local SQLite
 * FTS5 index in the browser (OPFS). The server never receives the query.
 */
export async function searchEmailsLocally(query: string, mailbox?: string): Promise<LocalEmail[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { sql } = await getDB();
  const ftsQuery = sanitizeFtsQuery(trimmed);

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

function sanitizeFtsQuery(query: string): string {
  // Escape double quotes and wrap terms to make a safe prefix query.
  const terms = query
    .replace(/["]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t}"*`);
  return terms.join(' ');
}
