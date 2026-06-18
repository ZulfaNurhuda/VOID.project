-- Platform-level roles and 2FA columns

ALTER TABLE users
    ADD COLUMN role         TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin')),
    ADD COLUMN status       TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'banned')),
    ADD COLUMN totp_secret  TEXT,
    ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN backup_codes TEXT[];
