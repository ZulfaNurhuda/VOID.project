package middleware

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TeamRole returns the user's effective role in a team.
// Returns "owner" if user is teams.owner_id, "admin"/"member" from team_members, or "" if no access.
func TeamRole(ctx context.Context, db *pgxpool.Pool, teamID, userID string) string {
	var ownerID string
	if err := db.QueryRow(ctx, "SELECT owner_id FROM teams WHERE id = $1", teamID).Scan(&ownerID); err != nil {
		return ""
	}
	if ownerID == userID {
		return "owner"
	}
	var role string
	if err := db.QueryRow(ctx, "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2", teamID, userID).Scan(&role); err != nil {
		return ""
	}
	return role
}

func RequireTeamMember(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)
		if TeamRole(context.Background(), db, c.Param("team_id"), user.ID) == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		c.Next()
	}
}

func RequireTeamAdmin(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)
		role := TeamRole(context.Background(), db, c.Param("team_id"), user.ID)
		if role != "owner" && role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}
		c.Next()
	}
}

func RequireTeamOwner(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)
		if TeamRole(context.Background(), db, c.Param("team_id"), user.ID) != "owner" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "owner access required"})
			return
		}
		c.Next()
	}
}
