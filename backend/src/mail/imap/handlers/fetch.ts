import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { mailStore } from '../../storage/mailstore';

function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Handles FETCH and UID FETCH. Supports FLAGS, RFC822.SIZE, INTERNALDATE,
 * ENVELOPE, BODY[HEADER], BODY[TEXT] and BODY[] (full message).
 */
export async function handleFetch(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  const isUid = cmd.name === 'UID';
  const args = isUid ? cmd.args.slice(1) : cmd.args;
  const dataItems = args.slice(1).join(' ').toUpperCase();

  if (session.state !== 'selected' || !session.userId || !session.selectedMailbox) {
    return IMAPResponse.no(cmd.tag, 'no mailbox selected');
  }

  const emails = await mailStore.listByUser(session.userId, session.selectedMailbox);
  let out = '';

  emails.forEach((email, i) => {
    const seq = i + 1;
    const fields: string[] = [];

    if (dataItems.includes('UID')) fields.push(`UID ${seq}`);
    if (dataItems.includes('FLAGS')) {
      const flags = email.is_read ? '\\Seen' : '';
      fields.push(`FLAGS (${flags})`);
    }
    if (dataItems.includes('RFC822.SIZE')) fields.push(`RFC822.SIZE ${email.raw.length}`);
    if (dataItems.includes('INTERNALDATE')) {
      fields.push(`INTERNALDATE "${new Date(email.received_at).toUTCString()}"`);
    }
    if (dataItems.includes('ENVELOPE')) {
      fields.push(
        `ENVELOPE ("${new Date(email.received_at).toUTCString()}" "${escapeString(
          email.subject,
        )}" (("" NIL "${escapeString(email.from_email)}" "")) NIL NIL (("" NIL "${escapeString(
          email.to_email,
        )}" "")) NIL NIL NIL "${escapeString(email.message_id)}")`,
      );
    }

    const headerBlock =
      `From: ${email.from_email}\r\n` +
      `To: ${email.to_email}\r\n` +
      `Subject: ${email.subject}\r\n` +
      `Date: ${new Date(email.received_at).toUTCString()}\r\n` +
      `Message-ID: ${email.message_id}\r\n\r\n`;

    if (dataItems.includes('BODY[HEADER]') || dataItems.includes('RFC822.HEADER')) {
      fields.push(`BODY[HEADER] {${headerBlock.length}}\r\n${headerBlock}`);
    }
    if (dataItems.includes('BODY[TEXT]')) {
      fields.push(`BODY[TEXT] {${email.body.length}}\r\n${email.body}`);
    }
    if (dataItems.includes('BODY[]') || dataItems.includes('RFC822')) {
      fields.push(`BODY[] {${email.raw.length}}\r\n${email.raw}`);
    }

    out += IMAPResponse.untagged(`${seq} FETCH (${fields.join(' ')})`);
  });

  return out + IMAPResponse.ok(cmd.tag, `${isUid ? 'UID ' : ''}FETCH completed`);
}
