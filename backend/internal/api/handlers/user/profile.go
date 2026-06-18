// backend/internal/api/handlers/user/profile.go
package user

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/argon2"

	"github.com/void-project/void-backend/internal/api/deps"
	voidmw "github.com/void-project/void-backend/internal/api/middleware"
	"github.com/void-project/void-backend/internal/repository"
)

type ProfileHandler struct {
	DB      *pgxpool.Pool
	Queries *repository.Queries
}

func NewProfileHandler(d *deps.Deps) *ProfileHandler {
	return &ProfileHandler{DB: d.DB, Queries: d.Queries}
}

// PATCH /api/user/profile
func (h *ProfileHandler) UpdateProfile(c *gin.Context) {
	user := voidmw.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var body struct {
		Username string `json:"username"`
		Email    string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if body.Email != "" && !strings.Contains(body.Email, "@") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email format"})
		return
	}

	err := h.Queries.UpdateUserProfile(c.Request.Context(),
		body.Username,
		strings.ToLower(body.Email),
		user.ID,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "username or email already taken"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "profile updated"})
}

// POST /api/user/change-password
func (h *ProfileHandler) ChangePassword(c *gin.Context) {
	user := voidmw.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var body struct {
		CurrentPassword string `json:"currentPassword" binding:"required"`
		NewPassword     string `json:"newPassword" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	passwordHash, err := h.Queries.GetUserPasswordHash(ctx, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve user"})
		return
	}

	// Verify current password (Argon2id: salt$hash)
	parts := strings.SplitN(passwordHash, "$", 2)
	if len(parts) != 2 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid stored hash"})
		return
	}
	salt, err := hex.DecodeString(parts[0])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid stored hash format"})
		return
	}
	storedHash, err := hex.DecodeString(parts[1])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid stored hash format"})
		return
	}
	inputHash := argon2.IDKey([]byte(body.CurrentPassword), salt, 2, 65536, 1, 32)
	if subtle.ConstantTimeCompare(inputHash, storedHash) != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is incorrect"})
		return
	}

	// Hash new password
	newSalt := make([]byte, 16)
	if _, err := rand.Read(newSalt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate salt"})
		return
	}
	newHash := argon2.IDKey([]byte(body.NewPassword), newSalt, 2, 65536, 1, 32)
	newPasswordHash := hex.EncodeToString(newSalt) + "$" + hex.EncodeToString(newHash)

	if err := h.Queries.UpdateUserPassword(ctx, newPasswordHash, user.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
		return
	}

	// Invalidate other sessions, keep current one alive
	currentToken, _ := c.Cookie("void_session")
	currentHash := voidmw.HashToken(currentToken)
	h.Queries.DeleteOtherSessions(ctx, user.ID, currentHash)

	c.JSON(http.StatusOK, gin.H{"message": "password changed"})
}

// DELETE /api/user/account
func (h *ProfileHandler) DeleteAccount(c *gin.Context) {
	user := voidmw.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var body struct {
		Username string `json:"username" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Username != user.Username {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username confirmation does not match"})
		return
	}

	ctx := c.Request.Context()
	// CASCADE deletes handle secrets, sessions, api_keys, team memberships
	if err := h.Queries.DeleteUserByID(ctx, user.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "account deletion failed"})
		return
	}

	// Delete server-side sessions explicitly (CASCADE should handle this, but be explicit)
	h.Queries.DeleteUserSessions(ctx, user.ID)

	c.SetCookie("void_session", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "account deleted"})
}
