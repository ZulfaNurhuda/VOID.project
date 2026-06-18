-- name: GetUserForLoginByUsername :one
SELECT id, username, email, password_hash, public_key, private_key_encrypted,
       role, status, totp_enabled
FROM users WHERE username = $1;

-- name: GetUserByEmail :one
SELECT id, username, email, password_hash, public_key, private_key_encrypted,
       role, status, totp_secret, totp_enabled, backup_codes, created_at, updated_at
FROM users WHERE email = $1;

-- name: GetUserByID :one
SELECT id, username, email, public_key, private_key_encrypted,
       role, status, totp_secret, totp_enabled, backup_codes, created_at, updated_at
FROM users WHERE id = $1;

-- name: GetUserForLogin :one
SELECT id, username, email, password_hash, private_key_encrypted,
       role, status, totp_enabled
FROM users WHERE email = $1;

-- name: CreateUser :one
INSERT INTO users (username, email, password_hash, public_key, private_key_encrypted)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;

-- name: CreateUserAdmin :one
INSERT INTO users (username, email, password_hash, role, public_key, private_key_encrypted, full_name)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id;

-- name: CountUsers :one
SELECT COUNT(*)::int FROM users;

-- name: CreatePersonalWorkspace :exec
INSERT INTO personal_workspaces (user_id, encrypted_workspace_symmetric_key)
VALUES ($1, $2)
ON CONFLICT (user_id) DO NOTHING;

-- name: GetOrgSetting :one
SELECT value FROM instance_settings WHERE key = 'organization';

-- name: GetInviteByCode :one
SELECT id, max_uses, use_count, is_active, expires_at
FROM invites WHERE code = $1;

-- name: IncrementInviteUseCount :exec
UPDATE invites SET use_count = use_count + 1 WHERE id = $1;

-- name: UpdateUserPassword :exec
UPDATE users SET password_hash = $1 WHERE id = $2;

-- name: GetUserPasswordHash :one
SELECT password_hash FROM users WHERE id = $1;

-- name: GetUserTOTPSecret :one
SELECT totp_secret FROM users WHERE id = $1;

-- name: EnableTOTP :exec
UPDATE users SET totp_secret = $1, totp_enabled = TRUE, backup_codes = $2
WHERE id = $3;

-- name: DisableTOTP :exec
UPDATE users SET totp_secret = NULL, totp_enabled = FALSE, backup_codes = NULL
WHERE id = $1;

-- name: GetUserPrivateKeyInfo :one
SELECT public_key, private_key_encrypted, totp_enabled FROM users WHERE id = $1;

-- name: CreatePasswordResetToken :exec
INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
VALUES ($1, $2, $3);

-- name: GetPasswordResetToken :one
SELECT id, user_id, expires_at, used
FROM password_reset_tokens WHERE token_hash = $1;

-- name: MarkResetTokenUsed :exec
UPDATE password_reset_tokens SET used = TRUE WHERE id = $1;

-- name: DeleteUserSessions :exec
DELETE FROM sessions WHERE user_id = $1;

-- name: DeleteOtherSessions :exec
DELETE FROM sessions WHERE user_id = $1 AND token_hash != $2;

-- name: GetOAuthAccount :one
SELECT u.id, u.role, u.private_key_encrypted
FROM oauth_accounts oa JOIN users u ON u.id = oa.user_id
WHERE oa.provider = $1 AND oa.provider_id = $2;

-- name: UpsertOAuthUser :one
INSERT INTO users (username, email, password_hash, public_key, private_key_encrypted)
VALUES ($1, $2, 'oauth-no-password', '', '')
ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
RETURNING id;

-- name: CreateOAuthAccount :exec
INSERT INTO oauth_accounts (user_id, provider, provider_id)
VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;

-- name: GetUserPublicKeyByEmail :one
SELECT id, public_key FROM users WHERE email = $1;
