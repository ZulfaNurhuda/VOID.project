-- name: CreateSession :exec
INSERT INTO sessions (user_id, token_hash, device_info, ip_address, expires_at, client)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: GetSessionWithUser :one
SELECT u.id, u.username, u.email, u.role, u.status, s.expires_at
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = $1;

-- name: UpdateSessionLastUsed :exec
UPDATE sessions SET last_used_at = NOW() WHERE token_hash = $1;

-- name: DeleteSessionByHash :exec
DELETE FROM sessions WHERE token_hash = $1;

-- name: DeleteSessionByID :execrows
DELETE FROM sessions WHERE id = $1 AND user_id = $2;

-- name: ListActiveSessions :many
SELECT id, device_info, ip_address, expires_at, created_at, last_used_at, client
FROM sessions
WHERE user_id = $1 AND expires_at > NOW()
ORDER BY last_used_at DESC;
