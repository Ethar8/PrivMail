export const SMTP_MAX_MESSAGE_SIZE = 52_428_800; // 50 MB
export const SMTP_MAX_RECIPIENTS = 100;
export const SMTP_MAX_LINE = 1000; // RFC 5321 §4.5.3.1: max 1000 octets incl. CRLF

export const IMAP_IDLE_TIMEOUT_MS = 29 * 60 * 1000;

export const SYSTEM_MAILBOXES = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Archive', 'Spam'] as const;

export const SPAM_THRESHOLD = 10;

export const QUEUE_MAX_RETRIES = 5;
export const QUEUE_BASE_BACKOFF_MS = 60_000;

export const JWT_EXPIRY = '7d';
export const JWT_ALGORITHM = 'HS256' as const;
export const MIN_SECRET_LENGTH = 32;
export const DEFAULT_JWT_SECRET = 'dev-secret-change-me';
export const DEFAULT_SESSION_SECRET = 'dev-session-secret-change-me';

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX = 300;
export const AUTH_RATE_LIMIT_MAX = 20;

// Antivirus (ClamAV INSTREAM)
export const CLAMAV_TIMEOUT_MS = 30_000;
export const CLAMAV_CHUNK_SIZE = 64 * 1024; // 64 KB per INSTREAM chunk
// Must stay <= ClamAV's StreamMaxLength (default 25 MB). Larger messages are
// treated as unscannable and rejected under the fail-closed policy.
export const CLAMAV_MAX_SCAN_SIZE = 26_214_400; // 25 MB
