// backend/internal/api/handlers/admin/analytics.go
package admin

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/void-project/void-backend/internal/api/deps"
	"github.com/void-project/void-backend/internal/repository"
)

type AnalyticsHandler struct {
	DB      *pgxpool.Pool
	Queries *repository.Queries
}

func NewAnalyticsHandler(d *deps.Deps) *AnalyticsHandler {
	return &AnalyticsHandler{DB: d.DB, Queries: d.Queries}
}

func periodToDays(period string) int {
	switch period {
	case "7d":
		return 7
	case "14d":
		return 14
	case "30d":
		return 30
	default:
		return 7
	}
}

func toInt64(v interface{}) int64 {
	switch n := v.(type) {
	case int64:
		return n
	case int32:
		return int64(n)
	case float64:
		return int64(n)
	case string:
		var i int64
		fmt.Sscan(n, &i)
		return i
	}
	return 0
}

// GET /api/admin/analytics/summary?period=7d|14d|30d
func (h *AnalyticsHandler) Summary(c *gin.Context) {
	period := c.DefaultQuery("period", "7d")
	days := periodToDays(period)
	since := time.Now().AddDate(0, 0, -days)
	ctx := c.Request.Context()

	totalSecrets, _ := h.Queries.CountSecretsTotal(ctx)
	totalUsers, _ := h.Queries.CountUsersTotal(ctx)

	var totalTeams int64
	totalTeams, _ = h.Queries.CountTeamsTotal(ctx)

	totalAccesses, _ := h.Queries.CountSecretAccessesSince(ctx, since)
	personalSecrets, _ := h.Queries.CountPersonalSecrets(ctx)
	teamSecrets := totalSecrets - personalSecrets

	topTeamsRaw, _ := h.Queries.TopTeamsBySecretCount(ctx)
	type TeamStat struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		Count int64  `json:"count"`
	}
	topTeams := make([]TeamStat, 0, len(topTeamsRaw))
	for _, t := range topTeamsRaw {
		topTeams = append(topTeams, TeamStat{ID: t.ID, Name: t.Name, Count: t.Count})
	}

	topUsersRaw, _ := h.Queries.TopUsersByEventCount(ctx, since)
	type UserStat struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		Count int64  `json:"count"`
	}
	topUsers := make([]UserStat, 0, len(topUsersRaw))
	for _, u := range topUsersRaw {
		topUsers = append(topUsers, UserStat{ID: u.ID, Name: u.Name, Count: u.Count})
	}

	c.JSON(http.StatusOK, gin.H{
		"totalSecrets":    totalSecrets,
		"totalUsers":      totalUsers,
		"totalTeams":      totalTeams,
		"totalAccesses":   totalAccesses,
		"personalSecrets": personalSecrets,
		"teamSecrets":     teamSecrets,
		"topTeams":        topTeams,
		"topUsers":        topUsers,
		"period":          period,
	})
}

// GET /api/admin/analytics/activity?period=7d|14d|30d
func (h *AnalyticsHandler) Activity(c *gin.Context) {
	period := c.DefaultQuery("period", "7d")
	days := periodToDays(period)
	since := time.Now().AddDate(0, 0, -days)
	ctx := c.Request.Context()

	sinceDate := pgtype.Date{
		Time:  since,
		Valid: true,
	}

	activityRaw, err := h.Queries.DailyActivity(ctx, sinceDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	type DayStat struct {
		Date     string `json:"date"`
		Created  int64  `json:"secretsCreated"`
		Accessed int64  `json:"secretsAccessed"`
	}

	activity := make([]DayStat, 0, len(activityRaw))
	for _, row := range activityRaw {
		activity = append(activity, DayStat{
			Date:     row.Date,
			Created:  toInt64(row.SecretsCreated),
			Accessed: toInt64(row.SecretsAccessed),
		})
	}

	c.JSON(http.StatusOK, gin.H{"activity": activity, "period": period})
}
