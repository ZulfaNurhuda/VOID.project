-- name: CreateAPIKey :one
INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
VALUES ($1, $2, $3, $4) RETURNING id, created_at;

-- name: ListAPIKeys :many
SELECT id, name, key_prefix, last_used, created_at
FROM api_keys WHERE user_id = $1
ORDER BY created_at DESC;

-- name: DeleteAPIKey :execrows
DELETE FROM api_keys WHERE id = $1 AND user_id = $2;

-- name: UpdateAPIKeyLastUsed :exec
UPDATE api_keys SET last_used = NOW() WHERE key_hash = $1;
