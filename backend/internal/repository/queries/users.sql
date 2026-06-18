-- name: UpdateUserProfile :exec
UPDATE users SET
    username   = COALESCE(NULLIF($1, ''), username),
    email      = COALESCE(NULLIF($2, ''), email),
    updated_at = NOW()
WHERE id = $3;

-- name: DeleteUserByID :exec
DELETE FROM users WHERE id = $1;

-- name: CountUsersTotal :one
SELECT COUNT(*) FROM users;

-- name: ListUsersAdmin :many
SELECT id, username, email, role, status, created_at
FROM users
WHERE ($1::text = '' OR LOWER(username) LIKE $1 OR LOWER(email) LIKE $1)
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountUsersAdmin :one
SELECT COUNT(*) FROM users
WHERE ($1::text = '' OR LOWER(username) LIKE $1 OR LOWER(email) LIKE $1);

-- name: AdminUpdateUser :exec
UPDATE users SET
    username   = CASE WHEN $1 != '' THEN $1 ELSE username END,
    email      = CASE WHEN $2 != '' THEN $2 ELSE email END,
    role       = CASE WHEN $3 != '' THEN $3 ELSE role END,
    status     = CASE WHEN $4 != '' THEN $4 ELSE status END,
    updated_at = NOW()
WHERE id = $5;
