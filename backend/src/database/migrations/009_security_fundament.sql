-- Post-Quantum / SRP / Trusted-Key / Anomaly-Detection / Recovery
-- Migration 009 – Sicherheits-Fundament Phase 1

-- SRP (Secure Remote Password) Verifier Storage
ALTER TABLE users ADD COLUMN IF NOT EXISTS srp_salt TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS srp_verifier TEXT;

-- Key fingerprint tracking (Trusted Key Verification)
CREATE TABLE IF NOT EXISTS contact_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_email TEXT NOT NULL,
    key_fingerprint TEXT NOT NULL,
    key_type TEXT NOT NULL DEFAULT 'pgp', -- 'pgp' | 'hybrid' | 'pq'
    public_key TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, contact_email, key_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_contact_keys_user ON contact_keys(user_id, contact_email);

-- Login anomaly detection – login history
CREATE TABLE IF NOT EXISTS login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    geo_country TEXT,
    geo_city TEXT,
    success BOOLEAN NOT NULL,
    anomaly BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at DESC);

-- Recovery phrases (BIP39-style, 12/24 words)
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_phrase_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_hint TEXT;

-- Post-quantum key storage (hybrid keys)
ALTER TABLE pgp_keys ADD COLUMN IF NOT EXISTS key_type TEXT NOT NULL DEFAULT 'pgp'; -- 'pgp' | 'hybrid'
ALTER TABLE pgp_keys ADD COLUMN IF NOT EXISTS pq_public_key TEXT;
ALTER TABLE pgp_keys ADD COLUMN IF NOT EXISTS pq_private_key_enc TEXT;

-- Email aliases
CREATE TABLE IF NOT EXISTS email_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alias_email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aliases_user ON email_aliases(user_id);

-- Self-destructing / expiring messages
ALTER TABLE emails ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS expire_duration TEXT; -- e.g. '1h', '24h', '7d'

-- Snooze support
ALTER TABLE emails ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

-- Server-side mail rules / filters
CREATE TABLE IF NOT EXISTS mail_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    condition_field TEXT NOT NULL, -- 'from', 'to', 'subject', 'body'
    condition_op TEXT NOT NULL,    -- 'contains', 'equals', 'starts_with', 'matches'
    condition_value TEXT NOT NULL,
    action TEXT NOT NULL,          -- 'move', 'delete', 'label', 'forward'
    action_value TEXT,             -- target mailbox/email/label
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mail_rules_user ON mail_rules(user_id);

-- Autoresponder
CREATE TABLE IF NOT EXISTS autoresponders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT false,
    responded_to TEXT[] NOT NULL DEFAULT '{}', -- list of sender emails already responded to
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_autoresponders_user ON autoresponders(user_id);

-- External encrypted messages (password-protected for non-PGP recipients)
CREATE TABLE IF NOT EXISTS external_encrypted_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_hint TEXT,
    encrypted_body TEXT NOT NULL,
    encrypted_subject TEXT,
    expires_at TIMESTAMPTZ,
    max_views INTEGER DEFAULT 5,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_external_msgs_sender ON external_encrypted_messages(sender_user_id);

ALTER TABLE external_encrypted_messages ADD COLUMN IF NOT EXISTS access_code_hash TEXT;
