export const APP_NAME = 'PrivMail';

export const MAILBOXES = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Archive', 'Spam'] as const;
export type MailboxName = (typeof MAILBOXES)[number];

export const MAILBOX_LABELS: Record<string, string> = {
  INBOX: 'Posteingang',
  Sent: 'Gesendet',
  Drafts: 'Entwürfe',
  Trash: 'Papierkorb',
  Archive: 'Archiv',
  Spam: 'Spam',
};

export const AI_PROVIDERS = [
  { id: 'ollama', label: 'Ollama (lokal)', requiresApiKey: false, defaultEndpoint: 'http://localhost:11434' },
  { id: 'openai', label: 'OpenAI', requiresApiKey: true, defaultEndpoint: 'https://api.openai.com' },
  { id: 'custom', label: 'Eigener Endpoint', requiresApiKey: true, defaultEndpoint: '' },
] as const;
