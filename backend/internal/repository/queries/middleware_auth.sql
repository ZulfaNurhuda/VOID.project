-- name: GetSessionForAuth :one
SELECT u.id, u.username, u.email, u.role, u.status, s.expires_at, s.client
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = $1;

-- name: GetUserFromAPIKey :one
SELECT u.id, u.username, u.email, u.role, u.status
FROM api_keys ak JOIN users u ON u.id = ak.user_id
WHERE ak.key_hash = $1;
