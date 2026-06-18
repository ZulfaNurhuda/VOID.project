-- name: CreateAuditLog :exec
INSERT INTO audit_logs (actor_id, workspace_id, workspace_type, action, resource_type, resource_id, details, ip_address)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: ListAuditLogs :many
SELECT al.id, al.actor_id, al.workspace_id, al.workspace_type, al.action,
       al.resource_type, al.resource_id, al.details, al.ip_address, al.created_at,
       u.username AS actor_name
FROM audit_logs al JOIN users u ON u.id = al.actor_id
WHERE ($1::uuid IS NULL OR al.actor_id = $1)
  AND ($2::text  IS NULL OR al.action = $2)
  AND ($3::timestamptz IS NULL OR al.created_at >= $3)
  AND ($4::timestamptz IS NULL OR al.created_at <= $4)
ORDER BY al.created_at DESC
LIMIT $5 OFFSET $6;

-- name: CountAuditLogs :one
SELECT COUNT(*) FROM audit_logs
WHERE ($1::uuid IS NULL OR actor_id = $1)
  AND ($2::text  IS NULL OR action = $2)
  AND ($3::timestamptz IS NULL OR created_at >= $3)
  AND ($4::timestamptz IS NULL OR created_at <= $4);

-- name: ListAuditLogsForExport :many
SELECT al.id, al.actor_id, al.workspace_id, al.workspace_type, al.action,
       al.resource_type, al.resource_id, al.details, al.ip_address, al.created_at,
       u.username AS actor_name
FROM audit_logs al JOIN users u ON u.id = al.actor_id
ORDER BY al.created_at DESC;
