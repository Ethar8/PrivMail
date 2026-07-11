import { IMAPCommand } from '../parser';
import { IMAPResponse } from '../response';
import { IMAPSession } from '../session';
import { mailboxStore } from '../../storage/mailboxstore';

export async function handleList(cmd: IMAPCommand, session: IMAPSession): Promise<string> {
  if (!session.userId) {
    return IMAPResponse.no(cmd.tag, 'not authenticated');
  }
  const mailboxes = await mailboxStore.listForUser(session.userId);
  const keyword = cmd.name === 'LSUB' ? 'LSUB' : 'LIST';
  let out = '';
  for (const mb of mailboxes) {
    out += IMAPResponse.untagged(`${keyword} (\\HasNoChildren) "/" "${mb}"`);
  }
  return out + IMAPResponse.ok(cmd.tag, `${keyword} completed`);
}
