export interface MailboxInfo {
  name: string;
  total: number;
  unseen: number;
}

export const SYSTEM_MAILBOXES = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Spam'] as const;
export type SystemMailbox = (typeof SYSTEM_MAILBOXES)[number];
