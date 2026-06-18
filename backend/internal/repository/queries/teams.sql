-- name: CreateTeam :one
INSERT INTO teams (name, owner_id) VALUES ($1, $2) RETURNING *;

-- name: GetTeamByID :one
SELECT * FROM teams WHERE id = $1;

-- name: GetTeamOwner :one
SELECT owner_id FROM teams WHERE id = $1;

-- name: UpdateTeam :exec
UPDATE teams SET name = $1, updated_at = NOW() WHERE id = $2;

-- name: DeleteTeam :exec
DELETE FROM teams WHERE id = $1;

-- name: ListTeamsByOwner :many
SELECT * FROM teams WHERE owner_id = $1 ORDER BY created_at DESC;

-- name: ListTeamsByMember :many
SELECT t.* FROM teams t
JOIN team_members tm ON tm.team_id = t.id
WHERE tm.user_id = $1
ORDER BY t.created_at DESC;

-- name: GetTeamMember :one
SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2;

-- name: ListTeamMembers :many
SELECT u.id, u.username, u.email, tm.role, tm.encrypted_team_symmetric_key, tm.created_at
FROM team_members tm JOIN users u ON u.id = tm.user_id
WHERE tm.team_id = $1;

-- name: AddTeamMember :exec
INSERT INTO team_members (team_id, user_id, role, encrypted_team_symmetric_key)
VALUES ($1, $2, $3, $4);

-- name: RemoveTeamMember :exec
DELETE FROM team_members WHERE team_id = $1 AND user_id = $2;

-- name: UpdateTeamMemberRole :exec
UPDATE team_members SET role = $1, updated_at = NOW()
WHERE team_id = $2 AND user_id = $3;

-- name: GetEncryptedTeamKey :one
SELECT encrypted_team_symmetric_key FROM team_members
WHERE team_id = $1 AND user_id = $2;
