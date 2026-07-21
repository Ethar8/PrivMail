-- OIDC Provider persistence (node-oidc-provider adapter) + client registry
-- Migration 011

CREATE TABLE IF NOT EXISTS oidc_payloads (
    id TEXT NOT NULL,
    model TEXT NOT NULL,
    payload JSONB NOT NULL,
    expires_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    grant_id TEXT,
    user_code TEXT,
    uid TEXT,
    PRIMARY KEY (id, model)
);
CREATE INDEX IF NOT EXISTS idx_oidc_payloads_grant ON oidc_payloads(grant_id) WHERE grant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oidc_payloads_uid ON oidc_payloads(uid) WHERE uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oidc_payloads_user_code ON oidc_payloads(user_code) WHERE user_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oidc_payloads_expires ON oidc_payloads(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS oidc_clients (
    client_id TEXT PRIMARY KEY,
    client_secret TEXT NOT NULL,
    name TEXT NOT NULL,
    redirect_uris TEXT[] NOT NULL,
    post_logout_redirect_uris TEXT[] NOT NULL DEFAULT '{}',
    grant_types TEXT[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token'],
    response_types TEXT[] NOT NULL DEFAULT ARRAY['code'],
    token_endpoint_auth_method TEXT NOT NULL DEFAULT 'client_secret_basic',
    scope TEXT NOT NULL DEFAULT 'openid profile email offline_access',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oidc_jwks (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    jwks JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oidc_login_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT,
    account_id TEXT,
    success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oidc_login_audit_created ON oidc_login_audit(created_at DESC);
