export interface Email {
  id: string;
  userId: string | null;
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  raw: string;
  receivedAt: Date;
  isRead: boolean;
  isEncrypted: boolean;
  spamScore: number;
  mailbox: string;
}

export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  receivedAt: Date;
  isRead: boolean;
  isEncrypted: boolean;
  mailbox: string;
}
