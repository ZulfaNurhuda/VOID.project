-- name: CreateEnv :one
INSERT INTO environments (app_id, name) VALUES ($1, $2) RETURNING *;

-- name: GetEnvByID :one
SELECT * FROM environments WHERE id = $1;

-- name: GetEnvByAppAndName :one
SELECT * FROM environments WHERE app_id = $1 AND name = $2;

-- name: ListEnvs :many
SELECT * FROM environments WHERE app_id = $1 ORDER BY created_at ASC;

-- name: UpdateEnv :exec
UPDATE environments SET name = $1, updated_at = NOW() WHERE id = $2;

-- name: DeleteEnv :exec
DELETE FROM environments WHERE id = $1;
