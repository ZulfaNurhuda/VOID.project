-- name: CountSecretAccessesSince :one
SELECT COUNT(*) FROM audit_logs
WHERE action LIKE 'secrets%' AND created_at >= $1;

-- name: CountPersonalSecrets :one
SELECT COUNT(*) FROM secrets s
JOIN environments e ON e.id = s.environment_id
JOIN apps a ON a.id = e.app_id
WHERE a.workspace_type = 'personal';

-- name: TopTeamsBySecretCount :many
SELECT t.id, t.name, COUNT(s.id) AS count
FROM teams t
LEFT JOIN apps a ON a.workspace_id = t.id AND a.workspace_type = 'team'
LEFT JOIN environments e ON e.app_id = a.id
LEFT JOIN secrets s ON s.environment_id = e.id
GROUP BY t.id, t.name
ORDER BY count DESC
LIMIT 5;

-- name: TopUsersByEventCount :many
SELECT u.id, u.username AS name, COUNT(al.id) AS count
FROM users u
LEFT JOIN audit_logs al ON al.actor_id = u.id AND al.created_at >= $1
GROUP BY u.id, u.username
ORDER BY count DESC
LIMIT 5;

-- name: DailyActivity :many
SELECT
    TO_CHAR(d, 'YYYY-MM-DD') AS date,
    COALESCE(SUM(CASE WHEN action = 'secrets.create' THEN 1 ELSE 0 END), 0) AS secrets_created,
    COALESCE(SUM(CASE WHEN action LIKE 'secrets%' THEN 1 ELSE 0 END), 0) AS secrets_accessed
FROM generate_series($1::date, NOW()::date, '1 day'::interval) d
LEFT JOIN audit_logs al ON al.created_at::date = d::date
GROUP BY d
ORDER BY d ASC;

-- name: CountTeamsTotal :one
SELECT COUNT(*) FROM teams;
