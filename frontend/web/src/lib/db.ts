import { SQLocal } from 'sqlocal';

export interface LocalEmail {
  id: string;
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  encryptedBody?: string | null;
  receivedAt: number;
  isRead: boolean;
  isEncrypted: boolean;
  isSpam?: boolean;
  spamScore?: number;
  mailbox: string;
  labels?: string | null;
  headers?: string | null;
}

let dbInstance: SQLocal | null = null;
let initialized = false;

export async function getDB(): Promise<SQLocal> {
  if (!dbInstance) {
    dbInstance = new SQLocal('privmail.db');
  }
  if (!initialized) {
    await initDB(dbInstance);
    initialized = true;
  }
  return dbInstance;
}

async function initDB(instance: SQLocal): Promise<void> {
  const { sql } = instance;
  await sql`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      message_id TEXT UNIQUE,
      from_email TEXT,
      to_email TEXT,
      subject TEXT,
      body TEXT,
      encrypted_body TEXT,
      received_at INTEGER,
      is_read INTEGER DEFAULT 0,
      is_encrypted INTEGER DEFAULT 0,
      is_spam INTEGER DEFAULT 0,
      spam_score INTEGER DEFAULT 0,
      mailbox TEXT DEFAULT 'INBOX',
      labels TEXT,
      headers TEXT
    )
  `;
  await sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
      subject, body, from_email, to_email,
      content='emails',
      content_rowid='rowid'
    )
  `;
  // Keep the external-content FTS index automatically in sync via triggers.
  // This prevents orphaned FTS rows when a message is re-saved (e.g. the body
  // is loaded lazily after the list view), which the previous manual insert
  // caused because INSERT OR REPLACE assigns a new rowid.
  await sql`
    CREATE TRIGGER IF NOT EXISTS emails_ai AFTER INSERT ON emails BEGIN
      INSERT INTO emails_fts(rowid, subject, body, from_email, to_email)
      VALUES (new.rowid, new.subject, new.body, new.from_email, new.to_email);
    END
  `;
  await sql`
    CREATE TRIGGER IF NOT EXISTS emails_ad AFTER DELETE ON emails BEGIN
      INSERT INTO emails_fts(emails_fts, rowid, subject, body, from_email, to_email)
      VALUES ('delete', old.rowid, old.subject, old.body, old.from_email, old.to_email);
    END
  `;
  await sql`
    CREATE TRIGGER IF NOT EXISTS emails_au AFTER UPDATE ON emails BEGIN
      INSERT INTO emails_fts(emails_fts, rowid, subject, body, from_email, to_email)
      VALUES ('delete', old.rowid, old.subject, old.body, old.from_email, old.to_email);
      INSERT INTO emails_fts(rowid, subject, body, from_email, to_email)
      VALUES (new.rowid, new.subject, new.body, new.from_email, new.to_email);
    END
  `;
}

/**
 * Upserts an email. Uses a real UPSERT (ON CONFLICT DO UPDATE) so the rowid
 * stays stable and the FTS index is maintained by triggers. An empty body in
 * the incoming record does NOT overwrite an existing non-empty body — this lets
 * the list view cache metadata first and the detail view fill in the body
 * later without losing it.
 */
export async function saveEmailLocally(email: LocalEmail): Promise<void> {
  const { sql } = await getDB();
  await sql`
    INSERT INTO emails (
      id, message_id, from_email, to_email, subject, body, encrypted_body,
      received_at, is_read, is_encrypted, is_spam, spam_score, mailbox, labels, headers
    ) VALUES (
      ${email.id}, ${email.messageId}, ${email.from}, ${email.to}, ${email.subject},
      ${email.body}, ${email.encryptedBody ?? null}, ${email.receivedAt},
      ${email.isRead ? 1 : 0}, ${email.isEncrypted ? 1 : 0}, ${email.isSpam ? 1 : 0},
      ${email.spamScore ?? 0}, ${email.mailbox}, ${email.labels ?? null}, ${email.headers ?? null}
    )
    ON CONFLICT(id) DO UPDATE SET
      message_id   = excluded.message_id,
      from_email   = excluded.from_email,
      to_email     = excluded.to_email,
      subject      = excluded.subject,
      body         = CASE WHEN excluded.body <> '' THEN excluded.body ELSE emails.body END,
      encrypted_body = COALESCE(excluded.encrypted_body, emails.encrypted_body),
      received_at  = excluded.received_at,
      is_read      = excluded.is_read,
      is_encrypted = excluded.is_encrypted,
      is_spam      = excluded.is_spam,
      spam_score   = excluded.spam_score,
      mailbox      = excluded.mailbox,
      labels       = COALESCE(excluded.labels, emails.labels),
      headers      = COALESCE(excluded.headers, emails.headers)
  `;
}

/**
 * Updates only the body of a cached email (used when the detail view loads the
 * full body lazily). Relies on the UPDATE trigger to refresh the FTS index.
 */
export async function updateEmailBodyLocally(id: string, body: string): Promise<void> {
  const { sql } = await getDB();
  await sql`UPDATE emails SET body = ${body} WHERE id = ${id}`;
}

export async function getEmailsLocally(mailbox = 'INBOX', limit = 50, offset = 0): Promise<LocalEmail[]> {
  const { sql } = await getDB();
  const rows = await sql`
    SELECT * FROM emails WHERE mailbox = ${mailbox}
    ORDER BY received_at DESC LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map(mapEmailRow);
}

export async function getEmailByIdLocally(id: string): Promise<LocalEmail | null> {
  const { sql } = await getDB();
  const rows = await sql`SELECT * FROM emails WHERE id = ${id}`;
  return rows[0] ? mapEmailRow(rows[0]) : null;
}

export async function deleteEmailLocally(id: string): Promise<void> {
  const { sql } = await getDB();
  await sql`DELETE FROM emails WHERE id = ${id}`;
}

export async function markEmailReadLocally(id: string, isRead: boolean): Promise<void> {
  const { sql } = await getDB();
  await sql`UPDATE emails SET is_read = ${isRead ? 1 : 0} WHERE id = ${id}`;
}

export async function moveEmailLocally(id: string, mailbox: string): Promise<void> {
  const { sql } = await getDB();
  await sql`UPDATE emails SET mailbox = ${mailbox} WHERE id = ${id}`;
}

export function mapEmailRow(row: Record<string, unknown>): LocalEmail {
  return {
    id: String(row.id),
    messageId: String(row.message_id ?? ''),
    from: String(row.from_email ?? ''),
    to: String(row.to_email ?? ''),
    subject: String(row.subject ?? ''),
    body: String(row.body ?? ''),
    encryptedBody: (row.encrypted_body as string) ?? null,
    receivedAt: Number(row.received_at ?? 0),
    isRead: Number(row.is_read) === 1,
    isEncrypted: Number(row.is_encrypted) === 1,
    isSpam: Number(row.is_spam) === 1,
    spamScore: Number(row.spam_score ?? 0),
    mailbox: String(row.mailbox ?? 'INBOX'),
    labels: (row.labels as string) ?? null,
    headers: (row.headers as string) ?? null,
  };
}
