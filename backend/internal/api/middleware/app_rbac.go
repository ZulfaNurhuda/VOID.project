package middleware

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// appWorkspace returns (workspaceID, workspaceType) for an app.
func appWorkspace(ctx context.Context, db *pgxpool.Pool, appID string) (string, string, error) {
	var wsID, wsType string
	err := db.QueryRow(ctx,
		"SELECT workspace_id, workspace_type FROM apps WHERE id = $1", appID,
	).Scan(&wsID, &wsType)
	return wsID, wsType, err
}

// userHasAppAccess checks if userID can access the given app.
func userHasAppAccess(ctx context.Context, db *pgxpool.Pool, appID, userID string) bool {
	wsID, wsType, err := appWorkspace(ctx, db, appID)
	if err != nil {
		return false
	}
	if wsType == "personal" {
		var ownerID string
		err := db.QueryRow(ctx,
			"SELECT user_id FROM personal_workspaces WHERE id = $1", wsID,
		).Scan(&ownerID)
		return err == nil && ownerID == userID
	}
	return TeamRole(context.Background(), db, wsID, userID) != ""
}

// userAppRole returns the user's role for an app's workspace.
func userAppRole(ctx context.Context, db *pgxpool.Pool, appID, userID string) string {
	wsID, wsType, err := appWorkspace(ctx, db, appID)
	if err != nil {
		return ""
	}
	if wsType == "personal" {
		var ownerID string
		db.QueryRow(ctx, "SELECT user_id FROM personal_workspaces WHERE id = $1", wsID).Scan(&ownerID)
		if ownerID == userID {
			return "owner"
		}
		return ""
	}
	return TeamRole(ctx, db, wsID, userID)
}

// RequireAppAccess aborts with 403 if the user has no access to the app.
func RequireAppAccess(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)
		appID := c.Param("app_id")
		if !userHasAppAccess(context.Background(), db, appID, user.ID) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		c.Next()
	}
}

// GetWorkspaceRole returns the user's role in a workspace (team or personal).
func GetWorkspaceRole(ctx context.Context, db *pgxpool.Pool, wsID, wsType, userID string) string {
	if wsType == "personal" {
		var ownerID string
		db.QueryRow(ctx, "SELECT user_id FROM personal_workspaces WHERE id=$1", wsID).Scan(&ownerID)
		if ownerID == userID {
			return "owner"
		}
		return ""
	}
	return TeamRole(ctx, db, wsID, userID)
}

// RequireAppAdmin aborts with 403 if the user is not admin/owner of the app's workspace.
func RequireAppAdmin(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)
		appID := c.Param("app_id")
		role := userAppRole(context.Background(), db, appID, user.ID)
		if role != "owner" && role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}
		c.Next()
	}
}
