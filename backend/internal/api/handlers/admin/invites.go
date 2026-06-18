// backend/internal/api/handlers/admin/invites.go
package admin

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/void-project/void-backend/internal/api/deps"
	voidmw "github.com/void-project/void-backend/internal/api/middleware"
	"github.com/void-project/void-backend/internal/repository"
)

type InvitesHandler struct {
	DB      *pgxpool.Pool
	Queries *repository.Queries
}

func NewInvitesHandler(d *deps.Deps) *InvitesHandler {
	return &InvitesHandler{DB: d.DB, Queries: d.Queries}
}

func generateInviteCode() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// GET /api/admin/invites
func (h *InvitesHandler) List(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.Queries.ListInvites(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	type InviteRow struct {
		ID        string  `json:"id"`
		Code      string  `json:"code"`
		MaxUses   *int32  `json:"maxUses"`
		UseCount  int32   `json:"useCount"`
		IsActive  bool    `json:"isActive"`
		ExpiresAt *string `json:"expiresAt"`
		CreatedAt string  `json:"createdAt"`
		Status    string  `json:"status"`
	}

	invites := make([]InviteRow, 0, len(rows))
	for _, row := range rows {
		inv := InviteRow{
			ID:        row.ID,
			Code:      row.Code,
			MaxUses:   row.MaxUses,
			UseCount:  row.UseCount,
			IsActive:  row.IsActive,
			CreatedAt: row.CreatedAt.Format(time.RFC3339),
		}

		if row.ExpiresAt.Valid {
			s := row.ExpiresAt.Time.Format(time.RFC3339)
			inv.ExpiresAt = &s
		}

		if !inv.IsActive {
			inv.Status = "inactive"
		} else if inv.MaxUses != nil && inv.UseCount >= *inv.MaxUses {
			inv.Status = "depleted"
		} else if inv.ExpiresAt != nil {
			exp, err := time.Parse(time.RFC3339, *inv.ExpiresAt)
			if err == nil && time.Now().After(exp) {
				inv.Status = "expired"
			} else {
				inv.Status = "active"
			}
		} else {
			inv.Status = "active"
		}

		invites = append(invites, inv)
	}

	c.JSON(http.StatusOK, gin.H{"invites": invites})
}

// POST /api/admin/invites
func (h *InvitesHandler) Create(c *gin.Context) {
	currentUser := voidmw.GetUser(c)
	if currentUser == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	var body struct {
		MaxUses       *int32 `json:"maxUses"`
		ExpiresInDays *int   `json:"expiresInDays"`
	}
	c.ShouldBindJSON(&body)

	code, err := generateInviteCode()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate code"})
		return
	}

	var expiresAt pgtype.Timestamptz
	if body.ExpiresInDays != nil && *body.ExpiresInDays > 0 {
		exp := time.Now().AddDate(0, 0, *body.ExpiresInDays)
		expiresAt = pgtype.Timestamptz{Time: exp, Valid: true}
	}

	result, err := h.Queries.CreateInvite(c.Request.Context(), code, body.MaxUses, expiresAt, currentUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "creation failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":        result.ID,
		"code":      code,
		"maxUses":   body.MaxUses,
		"useCount":  0,
		"isActive":  true,
		"expiresAt": expiresAt,
		"createdAt": result.CreatedAt.Format(time.RFC3339),
		"status":    "active",
	})
}

// PATCH /api/admin/invites/:id/status — deactivate
func (h *InvitesHandler) Deactivate(c *gin.Context) {
	inviteID := c.Param("id")
	affected, err := h.Queries.DeactivateInvite(c.Request.Context(), inviteID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "deactivation failed"})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "invite not found or already inactive"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "invite deactivated"})
}

// DELETE /api/admin/invites/:id
func (h *InvitesHandler) Delete(c *gin.Context) {
	inviteID := c.Param("id")
	affected, err := h.Queries.DeleteInvite(c.Request.Context(), inviteID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "deletion failed"})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "invite not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "invite deleted"})
}
