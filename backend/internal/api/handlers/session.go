package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/void-project/void-backend/internal/api/deps"
	"github.com/void-project/void-backend/internal/api/middleware"
	"github.com/void-project/void-backend/internal/repository"
)

type SessionHandler struct {
	DB      *pgxpool.Pool
	Queries *repository.Queries
}

func NewSessionHandler(d *deps.Deps) *SessionHandler {
	return &SessionHandler{DB: d.DB, Queries: d.Queries}
}

// GET /api/auth/sessions
func (h *SessionHandler) ListSessions(c *gin.Context) {
	user := middleware.GetUser(c)

	rows, err := h.Queries.ListActiveSessions(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list sessions"})
		return
	}

	type SessionRow struct {
		ID         string  `json:"id"`
		DeviceInfo *string `json:"deviceInfo"`
		IPAddress  *string `json:"ipAddress"`
		ExpiresAt  string  `json:"expiresAt"`
		CreatedAt  string  `json:"createdAt"`
		LastUsedAt string  `json:"lastUsedAt"`
	}
	sessions := make([]SessionRow, 0, len(rows))
	for _, s := range rows {
		sessions = append(sessions, SessionRow{
			ID:         s.ID,
			DeviceInfo: s.DeviceInfo,
			IPAddress:  s.IpAddress,
			ExpiresAt:  s.ExpiresAt.Format(time.RFC3339),
			CreatedAt:  s.CreatedAt.Format(time.RFC3339),
			LastUsedAt: s.LastUsedAt.Format(time.RFC3339),
		})
	}
	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

// DELETE /api/auth/sessions/:id
func (h *SessionHandler) RevokeSession(c *gin.Context) {
	user := middleware.GetUser(c)
	sessionID := c.Param("id")

	n, err := h.Queries.DeleteSessionByID(c.Request.Context(), sessionID, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke session"})
		return
	}
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "session revoked"})
}

// DELETE /api/auth/sessions (revoke all others)
func (h *SessionHandler) RevokeOtherSessions(c *gin.Context) {
	user := middleware.GetUser(c)
	currentToken, _ := c.Cookie(middleware.SessionCookieName)
	currentHash := middleware.HashToken(currentToken)

	h.Queries.DeleteOtherSessions(c.Request.Context(), user.ID, currentHash)
	c.JSON(http.StatusOK, gin.H{"message": "other sessions revoked"})
}
