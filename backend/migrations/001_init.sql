-- VOID Database Schema
-- Migration 001: Initial schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username                VARCHAR(50) UNIQUE NOT NULL,
    email                   VARCHAR(255) UNIQUE NOT NULL,
    password_hash           TEXT NOT NULL,
    public_key              TEXT NOT NULL,
    private_key_encrypted   TEXT NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ── Personal Workspaces ──────────────────────────────────────────────────────
CREATE TABLE personal_workspaces (
    id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                             UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_workspace_symmetric_key   TEXT NOT NULL,
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Teams ────────────────────────────────────────────────────────────────────
CREATE TABLE teams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    owner_id    UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teams_owner ON teams(owner_id);

-- ── Team Members ─────────────────────────────────────────────────────────────
CREATE TABLE team_members (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id                      UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id                      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                         VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member')),
    encrypted_team_symmetric_key TEXT NOT NULL,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- ── Apps ─────────────────────────────────────────────────────────────────────
CREATE TABLE apps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    workspace_id    UUID NOT NULL,
    workspace_type  VARCHAR(20) NOT NULL CHECK (workspace_type IN ('team', 'personal')),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, workspace_type, name)
);

CREATE INDEX idx_apps_workspace ON apps(workspace_id, workspace_type);

-- ── Environments ─────────────────────────────────────────────────────────────
CREATE TABLE environments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id      UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(app_id, name)
);

CREATE INDEX idx_environments_app ON environments(app_id);

-- ── Secrets ──────────────────────────────────────────────────────────────────
CREATE TABLE secrets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id  UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    key             VARCHAR(255) NOT NULL,
    encrypted_value TEXT NOT NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(environment_id, key)
);

CREATE INDEX idx_secrets_environment ON secrets(environment_id);

-- ── Secret History ────────────────────────────────────────────────────────────
CREATE TABLE secret_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_id           UUID REFERENCES secrets(id) ON DELETE SET NULL,
    old_encrypted_value TEXT,
    new_encrypted_value TEXT,
    changed_by          UUID NOT NULL REFERENCES users(id),
    action              VARCHAR(20) NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_secret_history_secret ON secret_history(secret_id);

-- ── Audit Logs ────────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        UUID NOT NULL REFERENCES users(id),
    workspace_id    UUID NOT NULL,
    workspace_type  VARCHAR(20) NOT NULL CHECK (workspace_type IN ('team', 'personal')),
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(50),
    resource_id     UUID,
    details         JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id, workspace_type);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ── Updated-at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_team_members_updated_at
    BEFORE UPDATE ON team_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_apps_updated_at
    BEFORE UPDATE ON apps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_environments_updated_at
    BEFORE UPDATE ON environments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_secrets_updated_at
    BEFORE UPDATE ON secrets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
