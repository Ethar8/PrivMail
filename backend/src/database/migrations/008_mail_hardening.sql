-- Attachments metadata per email
ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS attachment_ids TEXT[] NOT NULL DEFAULT '{}';

-- Persistent outbound queue (survives restart)
CREATE TABLE IF NOT EXISTS outbound_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email TEXT NOT NULL,
  to_emails TEXT[] NOT NULL,
  raw TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at BIGINT NOT NULL,
  request_dsn BOOLEAN NOT NULL DEFAULT false,
  is_bounce BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outbound_queue_next_attempt ON outbound_queue(next_attempt_at);

-- Persistent spam list entries (global admin-managed whitelist/blacklist)
CREATE TABLE IF NOT EXISTS spam_list_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('whitelist','blacklist')),
  entry TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(kind, entry)
);

-- IMAP mailbox subscriptions
CREATE TABLE IF NOT EXISTS mailbox_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mailbox TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, mailbox)
);
