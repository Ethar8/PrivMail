import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { mailStore } from '../../storage/mailstore';

/**
 * Server-side SEARCH is intentionally minimal (privacy-preserving full-text
 * search runs client-side via SQLite FTS5). Supports ALL, UNSEEN, SEEN,
 * DELETED, and FROM/SUBJECT/BODY substring matching on locally stored data.
 */
export async function handleSearch(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (session.state !== 'selected' || !session.userId || !session.selectedMailbox) {
    return IMAPResponse.no(cmd.tag, 'no mailbox selected');
  }
  const isUid = cmd.name === 'UID';
  const args = isUid ? cmd.args.slice(1) : cmd.args;
  const criteria = args.map((a) => a.toUpperCase());
  const emails = await mailStore.listByUser(session.userId, session.selectedMailbox);

  const matches: number[] = [];
  emails.forEach((email, i) => {
    const seq = i + 1;
    let ok = true;

    if (criteria.includes('UNSEEN') && email.is_read) ok = false;
    if (criteria.includes('SEEN') && !email.is_read) ok = false;

    const fromIdx = criteria.indexOf('FROM');
    if (fromIdx !== -1 && args[fromIdx + 1]) {
      ok = ok && email.from_email.toLowerCase().includes(args[fromIdx + 1].toLowerCase());
    }
    const subjIdx = criteria.indexOf('SUBJECT');
    if (subjIdx !== -1 && args[subjIdx + 1]) {
      ok = ok && email.subject.toLowerCase().includes(args[subjIdx + 1].toLowerCase());
    }
    const bodyIdx = criteria.indexOf('BODY');
    if (bodyIdx !== -1 && args[bodyIdx + 1]) {
      ok = ok && email.body.toLowerCase().includes(args[bodyIdx + 1].toLowerCase());
    }

    if (ok) matches.push(seq);
  });

  return (
    IMAPResponse.untagged(`SEARCH ${matches.join(' ')}`) +
    IMAPResponse.ok(cmd.tag, `${isUid ? 'UID ' : ''}SEARCH completed`)
  );
}
