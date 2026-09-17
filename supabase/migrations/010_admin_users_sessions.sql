-- DarbarTech Certificate System — Persistent Admin Auth & Sessions
-- V2 §15/§16 (P0): replace env-var / stateless-HMAC admin auth with database
-- backed admin users and server-revocable sessions.
--
--   * admin_users        — real accounts, bcrypt/argon2 password hashes, roles
--   * admin_sessions     — one row per login; logout / disable takes effect
--                          immediately because every request re-checks it
--   * admin_login_events — authentication audit trail (success + failure)
--
-- Raw session IDs are never stored: only their SHA-256 hash. The cookie holds
-- the random ID; a database leak therefore does not yield usable sessions.

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT admin_users_role_check CHECK (role IN ('super_admin', 'admin', 'staff'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user
    ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active
    ON admin_sessions(expires_at)
    WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_login_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    username TEXT,
    event_type TEXT NOT NULL DEFAULT 'login',
    success BOOLEAN NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_events_user
    ON admin_login_events(admin_user_id, created_at DESC);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_login_events ENABLE ROW LEVEL SECURITY;

-- Immediate server-side logout. Matching on the hash means a stolen cookie can
-- be invalidated without ever handling the raw secret.
CREATE OR REPLACE FUNCTION revoke_admin_session(p_token_hash TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE admin_sessions
    SET revoked_at = NOW()
    WHERE token_hash = p_token_hash
      AND revoked_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- "Logout all sessions" / disable-account fan-out.
CREATE OR REPLACE FUNCTION revoke_all_admin_sessions(p_admin_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE admin_sessions
    SET revoked_at = NOW()
    WHERE admin_user_id = p_admin_user_id
      AND revoked_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- One-time production bootstrap: creates the first SUPER_ADMIN from a hash
-- supplied out-of-band (never a default password). Idempotent on username.
CREATE OR REPLACE FUNCTION bootstrap_admin_user(
    p_username TEXT,
    p_password_hash TEXT,
    p_role TEXT DEFAULT 'super_admin',
    p_permissions JSONB DEFAULT '{"create":true,"preview":true,"issue":true,"revoke":true,"download":true,"manageTemplates":true}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT id INTO v_id FROM admin_users WHERE username = p_username;
    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    INSERT INTO admin_users (username, password_hash, role, permissions, is_active)
    VALUES (p_username, p_password_hash, p_role, p_permissions, TRUE)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;
