-- name: CreateSecret :one
INSERT INTO secrets (environment_id, key, encrypted_value, created_by)
VALUES ($1, $2, $3, $4) RETURNING *;

-- name: GetSecretByID :one
SELECT s.id, s.environment_id, s.key, s.encrypted_value, s.created_by,
       s.created_at, s.updated_at, u.username AS created_by_name
FROM secrets s JOIN users u ON u.id = s.created_by
WHERE s.id = $1 AND s.environment_id = $2;

-- name: ListSecrets :many
SELECT s.id, s.environment_id, s.key, s.encrypted_value, s.created_by,
       s.created_at, s.updated_at, u.username AS created_by_name
FROM secrets s JOIN users u ON u.id = s.created_by
WHERE s.environment_id = $1
ORDER BY s.created_at DESC;

-- name: UpdateSecret :one
UPDATE secrets SET encrypted_value = $1, updated_at = NOW()
WHERE id = $2 RETURNING *;

-- name: DeleteSecret :exec
DELETE FROM secrets WHERE id = $1;

-- name: GetSecretHistory :many
SELECT sh.id, sh.secret_id, sh.old_encrypted_value, sh.new_encrypted_value,
       sh.action, sh.created_at, u.username AS changed_by_name
FROM secret_history sh JOIN users u ON u.id = sh.changed_by
WHERE sh.secret_id = $1
ORDER BY sh.created_at DESC;

-- name: CreateSecretHistoryEntry :exec
INSERT INTO secret_history (secret_id, old_encrypted_value, new_encrypted_value, changed_by, action)
VALUES ($1, $2, $3, $4, $5);

-- name: ListSecretsForExport :many
SELECT key, encrypted_value FROM secrets WHERE environment_id = $1;

-- name: UpsertSecret :one
INSERT INTO secrets (environment_id, key, encrypted_value, created_by)
VALUES ($1, $2, $3, $4)
ON CONFLICT (environment_id, key)
DO UPDATE SET encrypted_value = EXCLUDED.encrypted_value, updated_at = NOW()
RETURNING *;

-- name: GetSecretByKey :one
SELECT * FROM secrets WHERE environment_id = $1 AND key = $2;
