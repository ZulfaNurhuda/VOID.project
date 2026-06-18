-- backend/migrations/005_admin_tables.sql

-- Invite codes
CREATE TABLE invites (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       TEXT NOT NULL UNIQUE,
    max_uses   INTEGER,
    use_count  INTEGER NOT NULL DEFAULT 0,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Instance settings (KV store)
CREATE TABLE instance_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO instance_settings (key, value) VALUES
    ('general',      '{"instanceName":"VOID","instanceUrl":"","description":"","logoBase64":""}'),
    ('security',     '{"force2FA":false,"sessionTimeout":"24h","allowedEmailDomains":"","maxLoginAttempts":10,"lockoutDuration":"15m"}'),
    ('organization', '{"registrationMode":"open","disableEmailSignup":false,"allowedEmailDomains":"","defaultRole":"user"}'),
    ('webhook',      '{"enabled":false,"url":"","secret":"","events":[],"lastStatus":null}'),
    ('metrics',      '{"enabled":false,"bearerToken":""}')
ON CONFLICT DO NOTHING;

-- Webhooks delivery log
CREATE TABLE webhook_deliveries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event       TEXT NOT NULL,
    payload     JSONB NOT NULL,
    status_code INTEGER,
    success     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
