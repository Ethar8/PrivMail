import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { mailStore } from '../../storage/mailstore';
import { sanitizeMailbox } from '../../../utils/validator';

/**
 * COPY <sequence-set> <mailbox>
 * Copies one or more messages from the selected mailbox to another mailbox.
 * Supports single sequence numbers, ranges (n:m), and comma-separated sets.
 */
export async function handleCopy(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (session.state !== 'selected' || !session.userId || !session.selectedMailbox) {
    return IMAPResponse.no(cmd.tag, 'no mailbox selected');
  }
  const args = cmd.args;
  if (!args[0] || !args[1]) {
    return IMAPResponse.bad(cmd.tag, 'COPY requires sequence-set and mailbox');
  }

  const targetMailbox = sanitizeMailbox(args[1]);
  const sequenceSet = args[0];
  const sequences = parseSequenceSet(sequenceSet);
  if (sequences.length === 0) {
    return IMAPResponse.bad(cmd.tag, 'invalid sequence-set');
  }

  const emails = await mailStore.listByUser(session.userId, session.selectedMailbox);
  let copied = 0;

  for (const seq of sequences) {
    if (seq < 1 || seq > emails.length) continue;
    const success = await mailStore.copyBySequence(
      session.userId,
      session.selectedMailbox,
      seq,
      targetMailbox,
    );
    if (success) copied += 1;
  }

  return IMAPResponse.ok(cmd.tag, `[COPYUID 1] COPY completed (${copied} messages copied)`);
}

function parseSequenceSet(set: string): number[] {
  const result: number[] = [];
  const parts = set.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === '*') continue;
    if (trimmed.includes(':')) {
      const [startStr, endStr] = trimmed.split(':');
      const start = parseInt(startStr, 10);
      const end = endStr === '*' ? Infinity : parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end)) continue;
      for (let i = start; i <= Math.min(end, start + 10000); i++) {
        result.push(i);
      }
    } else {
      const n = parseInt(trimmed, 10);
      if (!isNaN(n)) result.push(n);
    }
  }
  return result;
}
