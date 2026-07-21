import { parseMessage } from '../mail/smtp/parser-message';
import { mailStore } from '../mail/storage/mailstore';
import { logger } from '../utils/logger';

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Split an mbox file into individual RFC822 messages.
 * Handles standard "From " separator lines (mboxrd format).
 */
export function parseMbox(content: string): string[] {
  const messages: string[] = [];
  const lines = content.split(/\r?\n/);
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith('From ') && current.length > 0) {
      const raw = current.join('\r\n').trim();
      if (raw) messages.push(raw);
      current = [];
    }
    current.push(line);
  }

  const last = current.join('\r\n').trim();
  if (last) messages.push(last);

  return messages;
}

export async function importRawMessages(
  userId: string,
  rawMessages: string[],
  mailbox = 'INBOX',
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (const raw of rawMessages) {
    try {
      const parsed = parseMessage(raw);
      const id = await mailStore.store({
        userId,
        messageId: parsed.messageId || `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        from: parsed.from,
        to: Array.isArray(parsed.to) ? parsed.to.join(', ') : String(parsed.to ?? ''),
        subject: parsed.subject,
        body: parsed.body,
        raw,
        mailbox,
        spamScore: 0,
      });
      if (id) {
        result.imported++;
      } else {
        result.skipped++;
      }
    } catch (err) {
      result.errors.push((err as Error).message);
      logger.warn(`Import error: ${(err as Error).message}`);
    }
  }

  return result;
}

export async function importMbox(userId: string, content: string, mailbox?: string): Promise<ImportResult> {
  const messages = parseMbox(content);
  return importRawMessages(userId, messages, mailbox);
}

export async function importEml(userId: string, content: string, mailbox?: string): Promise<ImportResult> {
  return importRawMessages(userId, [content], mailbox);
}

/** Parse a minimal vCard 3.0/4.0 block into contact fields. */
export function parseVcardBlock(block: string): {
  name: string;
  email: string;
  phone: string;
  organization: string;
  notes: string;
} {
  const lines = block.split(/\r?\n/);
  let name = '';
  let email = '';
  let phone = '';
  let organization = '';
  const notes: string[] = [];

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('FN:')) name = line.slice(3).trim();
    else if (upper.startsWith('N:') && !name) {
      name = line
        .slice(2)
        .split(';')
        .filter(Boolean)
        .reverse()
        .join(' ')
        .trim();
    } else if (upper.startsWith('EMAIL')) email = line.split(':').slice(1).join(':').trim();
    else if (upper.startsWith('TEL')) phone = line.split(':').slice(1).join(':').trim();
    else if (upper.startsWith('ORG:')) organization = line.slice(4).trim();
    else if (upper.startsWith('NOTE:')) notes.push(line.slice(5).trim());
  }

  return { name: name || email || 'Unbekannt', email, phone, organization, notes: notes.join('\n') };
}

export function parseVcf(content: string): ReturnType<typeof parseVcardBlock>[] {
  const blocks = content.split(/BEGIN:VCARD/i).filter((b) => b.trim());
  return blocks.map((b) => parseVcardBlock(`BEGIN:VCARD${b}`));
}

/** Parse a minimal iCalendar VEVENT block. */
export function parseIcsEvent(block: string): {
  title: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
} | null {
  const lines = block.split(/\r?\n/);
  let title = '';
  let description = '';
  let location = '';
  let dtStart = '';
  let dtEnd = '';
  let allDay = false;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('SUMMARY:')) title = line.slice(8).trim();
    else if (upper.startsWith('DESCRIPTION:')) description = line.slice(12).trim();
    else if (upper.startsWith('LOCATION:')) location = line.slice(9).trim();
    else if (upper.startsWith('DTSTART')) {
      dtStart = line.split(':').pop()?.trim() ?? '';
      allDay = upper.includes('VALUE=DATE');
    } else if (upper.startsWith('DTEND')) {
      dtEnd = line.split(':').pop()?.trim() ?? '';
    }
  }

  if (!dtStart) return null;

  const parseIcsDate = (s: string): Date => {
    if (s.length === 8) {
      return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);
    }
    return new Date(
      `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`,
    );
  };

  const startAt = parseIcsDate(dtStart);
  const endAt = dtEnd ? parseIcsDate(dtEnd) : new Date(startAt.getTime() + 3600000);

  return { title: title || 'Termin', description, location, startAt, endAt, allDay };
}

export function parseIcs(content: string): NonNullable<ReturnType<typeof parseIcsEvent>>[] {
  const blocks = content.split(/BEGIN:VEVENT/i).filter((b) => b.trim());
  return blocks
    .map((b) => parseIcsEvent(`BEGIN:VEVENT${b}`))
    .filter((e): e is NonNullable<typeof e> => e !== null);
}
