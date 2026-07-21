import * as tls from 'tls';
import * as net from 'net';
import { importRawMessages, ImportResult } from './import-mail';
import { logger } from '../utils/logger';
import { mailboxStore } from '../mail/storage/mailboxstore';

export interface ImapImportConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  mailbox?: string;
  useTls?: boolean;
  limit?: number;
}

export interface EasySwitchProgress {
  imported: number;
  skipped: number;
  total: number;
  currentMailbox: string;
}

export interface EasySwitchConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  useTls?: boolean;
  limitPerMailbox?: number;
}

function mapImapMailboxToLocal(name: string): string {
  const n = name.replace(/^"/, '').replace(/"$/, '').replace(/^INBOX\./i, '');
  const lower = n.toLowerCase();
  if (lower === 'inbox' || n === 'INBOX') return 'INBOX';
  if (lower.includes('sent')) return 'Sent';
  if (lower.includes('draft')) return 'Drafts';
  if (lower.includes('trash') || lower.includes('gelöscht') || lower.includes('deleted')) return 'Trash';
  if (lower.includes('spam') || lower.includes('junk')) return 'Spam';
  if (lower.includes('archive') || lower.includes('archiv')) return 'Archive';
  return n.replace(/\//g, '.').slice(0, 100) || 'Imported';
}

/**
 * Minimal IMAP4rev1 client for one-shot mailbox import (LOGIN → SELECT → FETCH → LOGOUT).
 */
export async function importFromImap(userId: string, cfg: ImapImportConfig): Promise<ImportResult> {
  const limit = cfg.limit ?? 500;
  const mailbox = cfg.mailbox ?? 'INBOX';
  const useTls = cfg.useTls ?? cfg.port === 993;

  const messages = await fetchMailboxMessages(cfg.host, cfg.port, cfg.user, cfg.password, mailbox, limit, useTls);
  const localBox = mapImapMailboxToLocal(mailbox);
  await mailboxStore.createMailbox(userId, localBox);
  return importRawMessages(userId, messages, localBox);
}

/**
 * Easy-Switch: LIST all mailboxes, import each with folder mapping + progress callbacks.
 */
export async function importFromImapEasySwitch(
  userId: string,
  cfg: EasySwitchConfig,
  onProgress?: (p: EasySwitchProgress) => void,
): Promise<ImportResult> {
  const useTls = cfg.useTls ?? cfg.port === 993;
  const limitPer = cfg.limitPerMailbox ?? 2000;
  const mailboxes = await listImapMailboxes(cfg.host, cfg.port, cfg.user, cfg.password, useTls);

  const aggregate: ImportResult = { imported: 0, skipped: 0, errors: [] };
  let doneBoxes = 0;

  for (const box of mailboxes) {
    const localBox = mapImapMailboxToLocal(box);
    try {
      await mailboxStore.createMailbox(userId, localBox);
      const messages = await fetchMailboxMessages(
        cfg.host,
        cfg.port,
        cfg.user,
        cfg.password,
        box,
        limitPer,
        useTls,
      );
      const result = await importRawMessages(userId, messages, localBox);
      aggregate.imported += result.imported;
      aggregate.skipped += result.skipped;
      aggregate.errors.push(...result.errors.map((e) => `${box}: ${e}`));
    } catch (err) {
      aggregate.errors.push(`${box}: ${(err as Error).message}`);
      logger.warn(`Easy-Switch mailbox ${box} failed: ${(err as Error).message}`);
    }
    doneBoxes++;
    onProgress?.({
      imported: aggregate.imported,
      skipped: aggregate.skipped,
      total: Math.max(aggregate.imported + aggregate.skipped, doneBoxes * 10),
      currentMailbox: box,
    });
  }

  return aggregate;
}

async function withImapSession<T>(
  host: string,
  port: number,
  user: string,
  password: string,
  useTls: boolean,
  run: (send: (cmd: string) => void, waitFor: (pred: (buf: string) => boolean) => Promise<string>) => Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let tag = 0;
    let settled = false;

    const socket: tls.TLSSocket | net.Socket = useTls
      ? tls.connect({ host, port, rejectUnauthorized: true })
      : net.connect({ host, port });

    socket.setEncoding('utf8');

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(err);
    };

    const ok = (value: T) => {
      if (settled) return;
      settled = true;
      try {
        socket.write(`A${++tag} LOGOUT\r\n`);
      } catch {
        /* ignore */
      }
      socket.end();
      resolve(value);
    };

    const send = (cmd: string) => {
      socket.write(`${cmd}\r\n`);
    };

    const waitFor = (pred: (buf: string) => boolean): Promise<string> =>
      new Promise((res, rej) => {
        const started = Date.now();
        const check = () => {
          if (pred(buffer)) {
            const snap = buffer;
            buffer = '';
            res(snap);
            return;
          }
          if (Date.now() - started > 60_000) {
            rej(new Error('IMAP timeout'));
            return;
          }
          setTimeout(check, 50);
        };
        check();
      });

    socket.on('error', (err) => fail(err));
    socket.on('data', (chunk: string) => {
      buffer += chunk;
    });

    void (async () => {
      try {
        await waitFor((b) => b.includes('* OK'));
        buffer = '';
        const loginTag = `A${++tag}`;
        send(`${loginTag} LOGIN ${JSON.stringify(user)} ${JSON.stringify(password)}`);
        const loginResp = await waitFor(
          (b) => b.includes(`${loginTag} OK`) || b.includes(`${loginTag} NO`) || b.includes(`${loginTag} BAD`),
        );
        if (!loginResp.includes(`${loginTag} OK`)) {
          throw new Error('IMAP-Login fehlgeschlagen');
        }
        const result = await run(send, waitFor);
        ok(result);
      } catch (err) {
        fail(err as Error);
      }
    })();
  });
}

async function listImapMailboxes(
  host: string,
  port: number,
  user: string,
  password: string,
  useTls: boolean,
): Promise<string[]> {
  return withImapSession(host, port, user, password, useTls, async (send, waitFor) => {
    const listTag = `A${Date.now() % 100000}`;
    // Use a unique tag via send wrapper — recreate with next counter by embedding
    const tag = listTag;
    send(`${tag} LIST "" "*"`);
    const resp = await waitFor((b) => b.includes(`${tag} OK`) || b.includes(`${tag} NO`));
    if (!resp.includes(`${tag} OK`)) throw new Error('IMAP LIST fehlgeschlagen');
    const boxes: string[] = [];
    for (const line of resp.split(/\r?\n/)) {
      const m = line.match(/^\* LIST \([^)]*\) ".*" (.+)$/i) || line.match(/^\* LIST \([^)]*\) [^ ]+ (.+)$/i);
      if (m?.[1]) {
        let name = m[1].trim();
        if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
        if (name && !name.includes('\\Noselect')) boxes.push(name);
      }
    }
    if (boxes.length === 0) boxes.push('INBOX');
    return boxes;
  });
}

async function fetchMailboxMessages(
  host: string,
  port: number,
  user: string,
  password: string,
  mailbox: string,
  limit: number,
  useTls: boolean,
): Promise<string[]> {
  return withImapSession(host, port, user, password, useTls, async (send, waitFor) => {
    const selTag = `S${Date.now() % 100000}`;
    send(`${selTag} SELECT ${JSON.stringify(mailbox)}`);
    const sel = await waitFor((b) => b.includes(`${selTag} OK`) || b.includes(`${selTag} NO`));
    if (!sel.includes(`${selTag} OK`)) {
      throw new Error(`SELECT ${mailbox} fehlgeschlagen`);
    }

    // Capture EXISTS for progress estimate
    const existsMatch = sel.match(/\* (\d+) EXISTS/i);
    const exists = existsMatch ? Number(existsMatch[1]) : limit;
    const fetchEnd = Math.min(limit, Math.max(exists, 1));

    const fetchTag = `F${Date.now() % 100000}`;
    send(`${fetchTag} FETCH 1:${fetchEnd} (FLAGS BODY.PEEK[])`);
    const fetchResp = await waitFor((b) => b.includes(`${fetchTag} OK`) || b.includes(`${fetchTag} NO`));
    if (!fetchResp.includes(`${fetchTag} OK`)) {
      return [];
    }

    const messages: string[] = [];
    // Parse literals {n}\r\n<body>
    const literalRe = /\{(\d+)\}\r\n/g;
    let match: RegExpExecArray | null;
    while ((match = literalRe.exec(fetchResp)) !== null) {
      const size = Number(match[1]);
      const start = match.index + match[0].length;
      const body = fetchResp.slice(start, start + size);
      if (body.length >= size * 0.5) {
        messages.push(body.trim());
      }
    }
    return messages;
  });
}
