-- name: ListInvites :many
SELECT id, code, max_uses, use_count, is_active, expires_at, created_at
FROM invites ORDER BY created_at DESC;

-- name: CreateInvite :one
INSERT INTO invites (code, max_uses, expires_at, created_by)
VALUES ($1, $2, $3, $4) RETURNING id, created_at;

-- name: DeactivateInvite :execrows
UPDATE invites SET is_active = FALSE
WHERE id = $1 AND is_active = TRUE;

-- name: DeleteInvite :execrows
DELETE FROM invites WHERE id = $1;
