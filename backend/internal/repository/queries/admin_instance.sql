-- name: GetInstanceSetting :one
SELECT value FROM instance_settings WHERE key = $1;

-- name: UpsertInstanceSetting :exec
INSERT INTO instance_settings (key, value, updated_at)
VALUES ($1, $2, NOW())
ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW();

-- name: CountSecretsTotal :one
SELECT COUNT(*) FROM secrets;
