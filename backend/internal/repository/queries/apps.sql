-- name: CreateApp :one
INSERT INTO apps (name, description, workspace_id, workspace_type, created_by)
VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: GetAppByID :one
SELECT * FROM apps WHERE id = $1;

-- name: UpdateApp :exec
UPDATE apps SET name = $1, description = $2, updated_at = NOW() WHERE id = $3;

-- name: DeleteApp :exec
DELETE FROM apps WHERE id = $1;

-- name: ListAppsForWorkspace :many
SELECT * FROM apps WHERE workspace_id = $1 AND workspace_type = $2
ORDER BY created_at DESC;

-- name: GetPersonalWorkspaceByUser :one
SELECT id, encrypted_workspace_symmetric_key FROM personal_workspaces WHERE user_id = $1;

-- name: GetPersonalWorkspaceID :one
SELECT id FROM personal_workspaces WHERE user_id = $1;

-- name: ListPersonalApps :many
SELECT a.* FROM apps a
JOIN personal_workspaces pw ON pw.id = a.workspace_id
WHERE a.workspace_type = 'personal' AND pw.user_id = $1
ORDER BY a.created_at DESC;

-- name: ListTeamApps :many
SELECT a.* FROM apps a
JOIN team_members tm ON tm.team_id = a.workspace_id
WHERE a.workspace_type = 'team' AND tm.user_id = $1
ORDER BY a.created_at DESC;
