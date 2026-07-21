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

export interface LocalCalendarEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: number;
  endAt: number;
  allDay: boolean;
  encryptedData: string | null;
  updatedAt: number;
}

export interface LocalContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  notes: string;
  encryptedData: string | null;
  updatedAt: number;
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

  await sql`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      location TEXT DEFAULT '',
      start_at INTEGER NOT NULL,
      end_at INTEGER NOT NULL,
      all_day INTEGER DEFAULT 0,
      encrypted_data TEXT,
      updated_at INTEGER NOT NULL
    )
  `;

  await sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS calendar_fts USING fts5(
      title, description, location,
      content='calendar_events',
      content_rowid='rowid'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      organization TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      encrypted_data TEXT,
      updated_at INTEGER NOT NULL
    )
  `;

  await sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS contacts_fts USING fts5(
      name, email, organization, notes,
      content='contacts',
      content_rowid='rowid'
    )
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

export async function saveCalendarEventLocally(event: LocalCalendarEvent): Promise<void> {
  const { sql } = await getDB();
  await sql`
    INSERT INTO calendar_events (id, title, description, location, start_at, end_at, all_day, encrypted_data, updated_at)
    VALUES (${event.id}, ${event.title}, ${event.description}, ${event.location}, ${event.startAt}, ${event.endAt}, ${event.allDay ? 1 : 0}, ${event.encryptedData}, ${event.updatedAt})
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, description = excluded.description, location = excluded.location,
      start_at = excluded.start_at, end_at = excluded.end_at, all_day = excluded.all_day,
      encrypted_data = COALESCE(excluded.encrypted_data, calendar_events.encrypted_data),
      updated_at = excluded.updated_at
  `;
}

export async function getCalendarEventsLocally(fromTime: number, toTime: number): Promise<LocalCalendarEvent[]> {
  const { sql } = await getDB();
  const rows = await sql`
    SELECT * FROM calendar_events WHERE start_at >= ${fromTime} AND end_at <= ${toTime}
    ORDER BY start_at ASC
  `;
  return rows.map(mapCalendarRow);
}

export async function searchCalendarEventsLocally(query: string): Promise<LocalCalendarEvent[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { sql } = await getDB();
  const ftsQuery = sanitizeFtsQuery(trimmed);
  const rows = await sql`
    SELECT c.* FROM calendar_events c
    JOIN calendar_fts fts ON c.rowid = fts.rowid
    WHERE calendar_fts MATCH ${ftsQuery}
    ORDER BY c.start_at DESC
  `;
  return rows.map(mapCalendarRow);
}

export async function deleteCalendarEventLocally(id: string): Promise<void> {
  const { sql } = await getDB();
  await sql`DELETE FROM calendar_events WHERE id = ${id}`;
}

function mapCalendarRow(row: Record<string, unknown>): LocalCalendarEvent {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    location: String(row.location ?? ''),
    startAt: Number(row.start_at ?? 0),
    endAt: Number(row.end_at ?? 0),
    allDay: Number(row.all_day) === 1,
    encryptedData: (row.encrypted_data as string) ?? null,
    updatedAt: Number(row.updated_at ?? 0),
  };
}

export async function saveContactLocally(contact: LocalContact): Promise<void> {
  const { sql } = await getDB();
  await sql`
    INSERT INTO contacts (id, name, email, phone, organization, notes, encrypted_data, updated_at)
    VALUES (${contact.id}, ${contact.name}, ${contact.email}, ${contact.phone}, ${contact.organization}, ${contact.notes}, ${contact.encryptedData}, ${contact.updatedAt})
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, email = excluded.email, phone = excluded.phone,
      organization = excluded.organization, notes = excluded.notes,
      encrypted_data = COALESCE(excluded.encrypted_data, contacts.encrypted_data),
      updated_at = excluded.updated_at
  `;
}

export async function getContactsLocally(limit = 100, offset = 0): Promise<LocalContact[]> {
  const { sql } = await getDB();
  const rows = await sql`
    SELECT * FROM contacts ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map(mapContactRow);
}

export async function searchContactsLocally(query: string): Promise<LocalContact[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { sql } = await getDB();
  const ftsQuery = sanitizeFtsQuery(trimmed);
  const rows = await sql`
    SELECT c.* FROM contacts c
    JOIN contacts_fts fts ON c.rowid = fts.rowid
    WHERE contacts_fts MATCH ${ftsQuery}
    ORDER BY c.name ASC
  `;
  return rows.map(mapContactRow);
}

export async function deleteContactLocally(id: string): Promise<void> {
  const { sql } = await getDB();
  await sql`DELETE FROM contacts WHERE id = ${id}`;
}

function mapContactRow(row: Record<string, unknown>): LocalContact {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    organization: String(row.organization ?? ''),
    notes: String(row.notes ?? ''),
    encryptedData: (row.encrypted_data as string) ?? null,
    updatedAt: Number(row.updated_at ?? 0),
  };
}

function sanitizeFtsQuery(query: string): string {
  const terms = query
    .replace(/["'*^()~:!\-?;=<>%&|\\\/\n\r\t\0]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.substring(0, 64))
    .filter((t) => t.length > 0);

  if (terms.length === 0) return '';
  return terms.map((t) => `"${t}"`).join(' ');
}
