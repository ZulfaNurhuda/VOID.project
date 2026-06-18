package models

import "time"

type AuditLog struct {
	ID            string         `json:"id"`
	ActorID       string         `json:"actor_id"`
	ActorName     string         `json:"actor_name"`
	WorkspaceID   string         `json:"workspace_id"`
	WorkspaceType string         `json:"workspace_type"`
	Action        string         `json:"action"`
	ResourceType  *string        `json:"resource_type"`
	ResourceID    *string        `json:"resource_id"`
	Details       map[string]any `json:"details"`
	IPAddress     *string        `json:"ip_address"`
	CreatedAt     time.Time      `json:"created_at"`
}
