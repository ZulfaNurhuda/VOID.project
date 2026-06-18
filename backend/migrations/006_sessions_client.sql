ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS client VARCHAR(10) NOT NULL DEFAULT 'web'
        CHECK (client IN ('web', 'cli'));

CREATE INDEX IF NOT EXISTS sessions_client_idx ON sessions(client);
