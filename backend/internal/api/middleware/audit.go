package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditEntry struct {
	Action        string
	ResourceType  string
	ResourceID    string
	WorkspaceID   string
	WorkspaceType string
	Details       map[string]any
}

const AuditKey = "audit_entry"

// SetAudit lets a handler inject audit metadata before responding.
func SetAudit(c *gin.Context, entry AuditEntry) {
	c.Set(AuditKey, entry)
}

// AuditLog writes an audit log entry after a successful non-GET response.
func AuditLog(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if c.Request.Method == http.MethodGet || c.Writer.Status() >= 300 {
			return
		}

		entry, exists := c.Get(AuditKey)
		if !exists {
			return
		}
		ae, ok := entry.(AuditEntry)
		if !ok {
			return
		}

		user := GetUser(c)
		if user == nil {
			return
		}

		var detailsJSON []byte
		if ae.Details != nil {
			detailsJSON, _ = json.Marshal(ae.Details)
		}

		var resourceID *string
		if ae.ResourceID != "" {
			resourceID = &ae.ResourceID
		}
		var resourceType *string
		if ae.ResourceType != "" {
			resourceType = &ae.ResourceType
		}

		db.Exec(context.Background(), `
			INSERT INTO audit_logs (actor_id, workspace_id, workspace_type, action, resource_type, resource_id, details, ip_address)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, user.ID, ae.WorkspaceID, ae.WorkspaceType, ae.Action,
			resourceType, resourceID, detailsJSON, c.ClientIP(),
		)
	}
}
