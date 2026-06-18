// backend/internal/api/handlers/admin/users.go
package admin

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/argon2"

	"github.com/void-project/void-backend/internal/api/deps"
	voidmw "github.com/void-project/void-backend/internal/api/middleware"
	"github.com/void-project/void-backend/internal/repository"
)

type UsersHandler struct {
	DB      *pgxpool.Pool
	Queries *repository.Queries
}

func NewUsersHandler(d *deps.Deps) *UsersHandler {
	return &UsersHandler{DB: d.DB, Queries: d.Queries}
}

// GET /api/admin/users?page=1&limit=20&search=
func (h *UsersHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.DefaultQuery("search", "")
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	ctx := c.Request.Context()
	searchPat := "%" + strings.ToLower(search) + "%"

	total, _ := h.Queries.CountUsersAdmin(ctx, searchPat)

	rows, err := h.Queries.ListUsersAdmin(ctx, searchPat, int32(limit), int32(offset))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	type UserRow struct {
		ID        string `json:"id"`
		Username  string `json:"username"`
		Email     string `json:"email"`
		Role      string `json:"role"`
		Status    string `json:"status"`
		CreatedAt string `json:"createdAt"`
	}

	users := make([]UserRow, 0, len(rows))
	for _, row := range rows {
		users = append(users, UserRow{
			ID:        row.ID,
			Username:  row.Username,
			Email:     row.Email,
			Role:      row.Role,
			Status:    row.Status,
			CreatedAt: row.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// POST /api/admin/users
func (h *UsersHandler) Create(c *gin.Context) {
	var body struct {
		Username                   string `json:"username"                    binding:"required"`
		Email                      string `json:"email"                       binding:"required,email"`
		Password                   string `json:"password"                    binding:"required,min=8"`
		Role                       string `json:"role"`
		PublicKey                  string `json:"public_key"`
		PrivateKeyEncrypted        string `json:"private_key_encrypted"`
		EncryptedWorkspaceSymKey   string `json:"encrypted_workspace_sym_key"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Role == "" {
		body.Role = "user"
	}
	if body.PublicKey == "" || body.PrivateKeyEncrypted == "" || body.EncryptedWorkspaceSymKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "public_key, private_key_encrypted, and encrypted_workspace_sym_key are required"})
		return
	}

	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate salt"})
		return
	}
	hash := argon2.IDKey([]byte(body.Password), salt, 3, 65540, 4, 32)
	passwordHash := hex.EncodeToString(salt) + "$" + hex.EncodeToString(hash)

	ctx := c.Request.Context()

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "creation failed"})
		return
	}
	defer tx.Rollback(ctx)

	qtx := h.Queries.WithTx(tx)

	userID, err := qtx.CreateUserAdmin(ctx, repository.CreateUserAdminParams{
		Username:            body.Username,
		Email:               strings.ToLower(body.Email),
		PasswordHash:        passwordHash,
		Role:                body.Role,
		PublicKey:           body.PublicKey,
		PrivateKeyEncrypted: body.PrivateKeyEncrypted,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "username or email already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "creation failed"})
		return
	}

	if err := qtx.CreatePersonalWorkspace(ctx, userID, body.EncryptedWorkspaceSymKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "workspace creation failed"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "creation failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": userID, "username": body.Username, "email": body.Email, "role": body.Role})
}

// PATCH /api/admin/users/:id
func (h *UsersHandler) Update(c *gin.Context) {
	currentUser := voidmw.GetUser(c)
	if currentUser == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	targetID := c.Param("id")
	if targetID == currentUser.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot modify your own account via admin"})
		return
	}

	var body struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Role     string `json:"role"`
		Banned   *bool  `json:"banned"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	status := ""
	if body.Banned != nil {
		if *body.Banned {
			status = "banned"
		} else {
			status = "active"
		}
	}

	err := h.Queries.AdminUpdateUser(ctx, body.Username, strings.ToLower(body.Email), body.Role, status, targetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "user updated"})
}

// DELETE /api/admin/users/:id
func (h *UsersHandler) Delete(c *gin.Context) {
	currentUser := voidmw.GetUser(c)
	if currentUser == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	targetID := c.Param("id")
	if targetID == currentUser.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete your own account via admin"})
		return
	}

	if err := h.Queries.DeleteUserByID(c.Request.Context(), targetID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "deletion failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "user deleted"})
}
