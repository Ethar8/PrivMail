-- Killer-Features: Aliase-Ausbau, Attachment-Shares, Import-Jobs, Multi-Kalender
-- Migration 010

-- Aliases: label, disable, mail counter
ALTER TABLE email_aliases ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE email_aliases ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE email_aliases ADD COLUMN IF NOT EXISTS mail_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_aliases ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

-- Attachment password-share links (reuse password-message crypto)
CREATE TABLE IF NOT EXISTS attachment_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attachment_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_hint TEXT,
    encrypted_payload TEXT NOT NULL,
    access_code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    max_views INTEGER DEFAULT 20,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachment_shares_owner ON attachment_shares(owner_user_id);

-- Background import jobs (Easy-Switch)
CREATE TABLE IF NOT EXISTS import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'imap',
    status TEXT NOT NULL DEFAULT 'pending',
    progress_imported INTEGER NOT NULL DEFAULT 0,
    progress_total INTEGER NOT NULL DEFAULT 0,
    progress_skipped INTEGER NOT NULL DEFAULT 0,
    current_mailbox TEXT,
    error_message TEXT,
    config_json TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user ON import_jobs(user_id, created_at DESC);

-- Multiple calendars
CREATE TABLE IF NOT EXISTS user_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_calendars_user ON user_calendars(user_id);

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES user_calendars(id) ON DELETE SET NULL;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS location_plain TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS attendees_json TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS ics_uid TEXT;

-- Event attendee RSVP tracking
CREATE TABLE IF NOT EXISTS calendar_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'REQ-PARTICIPANT',
    status TEXT NOT NULL DEFAULT 'NEEDS-ACTION',
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, email)
);
CREATE INDEX IF NOT EXISTS idx_calendar_attendees_event ON calendar_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_attendees_token ON calendar_attendees(token);
