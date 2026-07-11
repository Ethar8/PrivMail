export interface EmailSummary {
  id: string;
  from: string;
  to: string;
  subject: string;
  receivedAt: string;
  isRead: boolean;
  isEncrypted: boolean;
  spamScore: number;
  mailbox: string;
}

export interface EmailDetail extends EmailSummary {
  from_email: string;
  to_email: string;
  body: string;
  raw: string;
  received_at: string;
  is_encrypted: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
}

export interface Mailbox {
  name: string;
  total: number;
  unseen: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt?: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
}
