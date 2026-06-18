package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"
	"github.com/void-project/void-backend/internal/api/deps"
	"github.com/void-project/void-backend/internal/repository"
)

type SetupHandler struct {
	DB      *pgxpool.Pool
	RDB     *goredis.Client
	Queries *repository.Queries
	AH      *AuthHandler
}

func NewSetupHandler(d *deps.Deps) *SetupHandler {
	return &SetupHandler{DB: d.DB, RDB: d.Redis, Queries: d.Queries, AH: NewAuthHandler(d)}
}

// GET /api/auth/setup/status
func (h *SetupHandler) Status(c *gin.Context) {
	ctx := c.Request.Context()
	count, err := h.Queries.CountUsers(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check setup status"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"completed": count > 0})
}

// POST /api/auth/setup
func (h *SetupHandler) Complete(c *gin.Context) {
	ctx := c.Request.Context()

	count, err := h.Queries.CountUsers(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check setup status"})
		return
	}
	if count > 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "setup already completed"})
		return
	}

	var body struct {
		Name                          string `json:"name"`
		Username                      string `json:"username"              binding:"required"`
		Email                         string `json:"email"                 binding:"required,email"`
		Password                      string `json:"password"              binding:"required,min=8"`
		PublicKey                     string `json:"publicKey"             binding:"required"`
		PrivateKeyEncrypted           string `json:"privateKeyEncrypted"   binding:"required"`
		EncryptedWorkspaceSymmetricKey string `json:"workspaceSymKeyEncrypted" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	passwordHash, err := hashPassword(body.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to begin transaction"})
		return
	}
	defer tx.Rollback(ctx)

	qtx := h.Queries.WithTx(tx)

	var fullName *string
	if body.Name != "" {
		fullName = &body.Name
	}

	userID, err := qtx.CreateUserAdmin(ctx, repository.CreateUserAdminParams{
		Username:            body.Username,
		Email:               body.Email,
		PasswordHash:        passwordHash,
		Role:                "admin",
		PublicKey:           body.PublicKey,
		PrivateKeyEncrypted: body.PrivateKeyEncrypted,
		FullName:            fullName,
	})
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username or email already exists"})
		return
	}

	if err := qtx.CreatePersonalWorkspace(ctx, userID, body.EncryptedWorkspaceSymmetricKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create workspace"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit"})
		return
	}

	token, err := h.AH.createSession(c, userID, "web")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session creation failed"})
		return
	}

	wsID, _ := h.Queries.GetPersonalWorkspaceID(ctx, userID)
	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user": gin.H{
			"id":                    userID,
			"username":              body.Username,
			"email":                 strings.ToLower(body.Email),
			"role":                  "admin",
			"public_key":            body.PublicKey,
			"private_key_encrypted": body.PrivateKeyEncrypted,
			"totpEnabled":           false,
			"personal_workspace_id": wsID,
		},
	})
}
