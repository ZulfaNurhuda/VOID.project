package handlers

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/void-project/void-backend/internal/api/deps"
	"github.com/void-project/void-backend/internal/api/middleware"
	"github.com/void-project/void-backend/internal/models"
	"github.com/void-project/void-backend/internal/repository"
)

type AuditHandler struct {
	deps    *deps.Deps
	Queries *repository.Queries
}

func NewAuditHandler(d *deps.Deps) *AuditHandler {
	return &AuditHandler{deps: d, Queries: d.Queries}
}

// ListLogs fetches audit logs with dynamic filtering scoped to the user's accessible workspaces.
// Kept as raw SQL: the generated ListAuditLogs uses fixed nullable params that don't support
// the user-scoped workspace subquery or the optional dynamic filter set needed here.
func (h *AuditHandler) ListLogs(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := context.Background()
	wsID := c.Query("workspace_id")
	wsType := c.Query("workspace_type")
	actorID := c.Query("actor_id")
	action := c.Query("action")
	from := c.Query("from")
	to := c.Query("to")
	page, limit := 1, 50
	fmt.Sscanf(c.DefaultQuery("page", "1"), "%d", &page)
	fmt.Sscanf(c.DefaultQuery("limit", "50"), "%d", &limit)
	if limit > 200 {
		limit = 200
	}
	offset := (page - 1) * limit

	query := `SELECT al.id, al.actor_id, u.username, al.workspace_id, al.workspace_type,
	                 al.action, al.resource_type, al.resource_id, al.details,
	                 CAST(al.ip_address AS TEXT), al.created_at
	          FROM audit_logs al JOIN users u ON u.id = al.actor_id WHERE 1=1`
	args := []any{}
	idx := 1
	// Scope to workspaces the user has access to (unless specific workspace_id given)
	if wsID == "" {
		query += fmt.Sprintf(` AND (
		    (al.workspace_type = 'personal' AND al.workspace_id = (SELECT id FROM personal_workspaces WHERE user_id = $%d))
		    OR (al.workspace_type = 'team' AND al.workspace_id IN (
		        SELECT team_id FROM team_members WHERE user_id = $%d
		        UNION SELECT id FROM teams WHERE owner_id = $%d
		    ))
		)`, idx, idx+1, idx+2)
		args = append(args, user.ID, user.ID, user.ID)
		idx += 3
	}
	if wsID != "" {
		query += fmt.Sprintf(" AND al.workspace_id=$%d", idx)
		args = append(args, wsID)
		idx++
	}
	if wsType != "" {
		query += fmt.Sprintf(" AND al.workspace_type=$%d", idx)
		args = append(args, wsType)
		idx++
	}
	if actorID != "" {
		query += fmt.Sprintf(" AND al.actor_id=$%d", idx)
		args = append(args, actorID)
		idx++
	}
	if action != "" {
		query += fmt.Sprintf(" AND al.action ILIKE $%d", idx)
		args = append(args, "%"+action+"%")
		idx++
	}
	if from != "" {
		query += fmt.Sprintf(" AND al.created_at>=$%d", idx)
		args = append(args, from)
		idx++
	}
	if to != "" {
		query += fmt.Sprintf(" AND al.created_at<=$%d", idx)
		args = append(args, to)
		idx++
	}
	query += fmt.Sprintf(" ORDER BY al.created_at DESC LIMIT $%d OFFSET $%d", idx, idx+1)
	args = append(args, limit, offset)

	rows, err := h.deps.DB.Query(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch audit logs"})
		return
	}
	defer rows.Close()
	logs := []models.AuditLog{}
	for rows.Next() {
		var l models.AuditLog
		var detailsJSON []byte
		if err := rows.Scan(&l.ID, &l.ActorID, &l.ActorName, &l.WorkspaceID, &l.WorkspaceType,
			&l.Action, &l.ResourceType, &l.ResourceID, &detailsJSON, &l.IPAddress, &l.CreatedAt); err != nil {
			continue
		}
		if detailsJSON != nil {
			json.Unmarshal(detailsJSON, &l.Details)
		}
		logs = append(logs, l)
	}
	c.JSON(http.StatusOK, gin.H{"logs": logs, "page": page, "limit": limit})
}

// ExportCSV exports audit logs scoped to user's workspaces.
// Kept as raw SQL: ListAuditLogsForExport returns all logs without user-scoping.
func (h *AuditHandler) ExportCSV(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := context.Background()
	rows, err := h.deps.DB.Query(ctx,
		`SELECT al.id, u.username, al.workspace_id, al.workspace_type,
		        al.action, COALESCE(al.resource_type,''), COALESCE(CAST(al.resource_id AS TEXT),''),
		        COALESCE(CAST(al.ip_address AS TEXT),''), al.created_at
		 FROM audit_logs al JOIN users u ON u.id = al.actor_id
		 WHERE (
		     (al.workspace_type = 'personal' AND al.workspace_id = (SELECT id FROM personal_workspaces WHERE user_id = $1))
		     OR (al.workspace_type = 'team' AND al.workspace_id IN (
		         SELECT team_id FROM team_members WHERE user_id = $1
		         UNION SELECT id FROM teams WHERE owner_id = $1
		     ))
		 )
		 ORDER BY al.created_at DESC LIMIT 10000`,
		user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to export"})
		return
	}
	defer rows.Close()
	c.Header("Content-Disposition", "attachment; filename=audit_logs.csv")
	c.Header("Content-Type", "text/csv")
	w := csv.NewWriter(c.Writer)
	w.Write([]string{"id", "actor", "workspace_id", "workspace_type", "action", "resource_type", "resource_id", "ip_address", "created_at"})
	for rows.Next() {
		var id, actor, wsID, wsType, action, resType, resID, ip string
		var createdAt interface{}
		rows.Scan(&id, &actor, &wsID, &wsType, &action, &resType, &resID, &ip, &createdAt)
		w.Write([]string{id, actor, wsID, wsType, action, resType, resID, ip, fmt.Sprintf("%v", createdAt)})
	}
	w.Flush()
}

// GetUserByUsername is used by the frontend to look up a user's public key when adding team members.
func GetUserByEmail(d *deps.Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.Query("username")
		if username == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "username query param required"})
			return
		}
		row, err := d.Queries.GetUserPublicKeyByUsername(context.Background(), username)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user '" + username + "' not found in the system"})
			return
		}
		if row.PublicKey == "" {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "user '" + username + "' has no public key — they need to re-register"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": row.ID, "public_key": row.PublicKey})
	}
}
