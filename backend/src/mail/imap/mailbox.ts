import { mailboxStore } from '../storage/mailboxstore';

/**
 * IMAP mailbox helper – wraps the persistent mailbox store with per-session
 * state (message sequence mapping) needed by the IMAP protocol.
 */
export interface MailboxState {
  name: string;
  exists: number;
  recent: number;
  unseen: number;
  uidnext: number;
  uidvalidity: number;
}

export async function openMailbox(userId: string, name: string): Promise<MailboxState> {
  const exists = await mailboxStore.countMessages(userId, name);
  const unseen = await mailboxStore.countUnseen(userId, name);
  return {
    name,
    exists,
    recent: 0,
    unseen,
    uidnext: exists + 1,
    uidvalidity: 1,
  };
}
