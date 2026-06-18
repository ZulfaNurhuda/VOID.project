package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/void-project/void-backend/internal/api/deps"
	"github.com/void-project/void-backend/internal/api/middleware"
	"github.com/void-project/void-backend/internal/models"
	"github.com/void-project/void-backend/internal/repository"
)

type SecretsHandler struct {
	deps    *deps.Deps
	Queries *repository.Queries
}

func NewSecretsHandler(d *deps.Deps) *SecretsHandler {
	return &SecretsHandler{deps: d, Queries: d.Queries}
}

// strPtr returns a pointer to s, or nil if s is empty.
func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// uuidFromString converts a string UUID to pgtype.UUID.
func uuidFromString(s string) pgtype.UUID {
	parsed, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: parsed, Valid: true}
}

// pgUUIDToString converts a pgtype.UUID to its string representation.
func pgUUIDToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	return uuid.UUID(u.Bytes).String()
}

func (h *SecretsHandler) getEncryptedSymKey(ctx context.Context, appID, userID string) (string, error) {
	app, err := h.Queries.GetAppByID(ctx, appID)
	if err != nil {
		return "", fmt.Errorf("app not found")
	}
	if app.WorkspaceType == "personal" {
		pw, err := h.Queries.GetPersonalWorkspaceByUser(ctx, userID)
		if err != nil {
			return "", err
		}
		return pw.EncryptedWorkspaceSymmetricKey, nil
	}
	key, err := h.Queries.GetEncryptedTeamKey(ctx, app.WorkspaceID, userID)
	return key, err
}

func (h *SecretsHandler) getWorkspaceForApp(ctx context.Context, appID string) (string, string) {
	app, err := h.Queries.GetAppByID(ctx, appID)
	if err != nil {
		return "", ""
	}
	return app.WorkspaceID, app.WorkspaceType
}

func (h *SecretsHandler) ListSecrets(c *gin.Context) {
	user := middleware.GetUser(c)
	appID := c.Param("app_id")
	envID := c.Param("env_id")
	ctx := context.Background()

	encSymKey, err := h.getEncryptedSymKey(ctx, appID, user.ID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot retrieve encryption key"})
		return
	}

	rows, err := h.Queries.ListSecrets(ctx, envID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list secrets"})
		return
	}

	secrets := []models.Secret{}
	for _, s := range rows {
		secrets = append(secrets, models.Secret{
			ID: s.ID, EnvironmentID: s.EnvironmentID, Key: s.Key,
			EncryptedValue: s.EncryptedValue, CreatedBy: s.CreatedBy,
			CreatedByName: s.CreatedByName, CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, models.SecretsListResponse{
		EncryptedTeamSymmetricKey: encSymKey,
		Secrets:                   secrets,
	})
}

func (h *SecretsHandler) GetSecret(c *gin.Context) {
	user := middleware.GetUser(c)
	appID := c.Param("app_id")
	envID := c.Param("env_id")
	secretID := c.Param("secret_id")
	ctx := context.Background()

	encSymKey, err := h.getEncryptedSymKey(ctx, appID, user.ID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot retrieve encryption key"})
		return
	}
	row, err := h.Queries.GetSecretByID(ctx, secretID, envID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "secret not found"})
		return
	}
	s := models.Secret{
		ID: row.ID, EnvironmentID: row.EnvironmentID, Key: row.Key,
		EncryptedValue: row.EncryptedValue, CreatedBy: row.CreatedBy,
		CreatedByName: row.CreatedByName, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
	c.JSON(http.StatusOK, gin.H{"encrypted_team_symmetric_key": encSymKey, "secret": s})
}

func (h *SecretsHandler) CreateSecret(c *gin.Context) {
	user := middleware.GetUser(c)
	appID := c.Param("app_id")
	envID := c.Param("env_id")
	var req models.CreateSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	secret, err := h.Queries.CreateSecret(ctx, envID, req.Key, req.EncryptedValue, user.ID)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "secret key already exists in this environment"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create secret"})
		return
	}
	// Record history entry
	newVal := req.EncryptedValue
	h.Queries.CreateSecretHistoryEntry(ctx, uuidFromString(secret.ID), nil, &newVal, user.ID, "created")
	wsID, wsType := h.getWorkspaceForApp(ctx, appID)
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "secrets.create", ResourceType: "secret", ResourceID: secret.ID,
		WorkspaceID: wsID, WorkspaceType: wsType,
	})
	c.JSON(http.StatusCreated, gin.H{"id": secret.ID, "key": secret.Key})
}

func (h *SecretsHandler) UpdateSecret(c *gin.Context) {
	user := middleware.GetUser(c)
	appID := c.Param("app_id")
	secretID := c.Param("secret_id")
	var req models.UpdateSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	// RBAC: Members can only update their own secrets
	wsID0, wsType0 := h.getWorkspaceForApp(ctx, appID)
	role0 := middleware.GetWorkspaceRole(ctx, h.deps.DB, wsID0, wsType0, user.ID)
	if role0 == "member" {
		existing, err := h.Queries.GetSecretByID(ctx, secretID, c.Param("env_id"))
		if err != nil || existing.CreatedBy != user.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "members can only update their own secrets"})
			return
		}
	}
	// Get old value for history
	oldSecret, _ := h.Queries.GetSecretByID(ctx, secretID, c.Param("env_id"))
	updated, err := h.Queries.UpdateSecret(ctx, req.EncryptedValue, secretID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update secret"})
		return
	}
	oldVal := oldSecret.EncryptedValue
	newVal := req.EncryptedValue
	h.Queries.CreateSecretHistoryEntry(ctx, uuidFromString(updated.ID), &oldVal, &newVal, user.ID, "updated")
	wsID, wsType := h.getWorkspaceForApp(ctx, appID)
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "secrets.update", ResourceType: "secret", ResourceID: secretID,
		WorkspaceID: wsID, WorkspaceType: wsType,
	})
	c.JSON(http.StatusOK, gin.H{"id": secretID})
}

func (h *SecretsHandler) DeleteSecret(c *gin.Context) {
	user := middleware.GetUser(c)
	appID := c.Param("app_id")
	envID := c.Param("env_id")
	secretID := c.Param("secret_id")
	ctx := context.Background()
	// RBAC: Members can only delete their own secrets
	wsID1, wsType1 := h.getWorkspaceForApp(ctx, appID)
	role1 := middleware.GetWorkspaceRole(ctx, h.deps.DB, wsID1, wsType1, user.ID)
	if role1 == "member" {
		existing, err := h.Queries.GetSecretByID(ctx, secretID, envID)
		if err != nil || existing.CreatedBy != user.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "members can only delete their own secrets"})
			return
		}
	}
	// Fetch old value for history before delete
	oldSecret, _ := h.Queries.GetSecretByID(ctx, secretID, envID)
	oldVal := oldSecret.EncryptedValue
	// Record history BEFORE delete (secret_id becomes NULL after delete due to ON DELETE SET NULL)
	h.Queries.CreateSecretHistoryEntry(ctx, uuidFromString(secretID), &oldVal, nil, user.ID, "deleted")
	if err := h.Queries.DeleteSecret(ctx, secretID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete secret"})
		return
	}
	wsID, wsType := h.getWorkspaceForApp(ctx, appID)
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "secrets.delete", ResourceType: "secret", ResourceID: secretID,
		WorkspaceID: wsID, WorkspaceType: wsType,
	})
	c.JSON(http.StatusOK, gin.H{"message": "secret deleted"})
}

func (h *SecretsHandler) ImportSecrets(c *gin.Context) {
	user := middleware.GetUser(c)
	envID := c.Param("env_id")
	var req models.ImportSecretsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	imported, updated := 0, 0
	for _, s := range req.Secrets {
		result, err := h.Queries.UpsertSecret(ctx, envID, s.Key, s.EncryptedValue, user.ID)
		if err != nil {
			continue
		}
		newVal := s.EncryptedValue
		// Determine if this was a create or update by checking if created_at == updated_at
		if result.CreatedAt.Equal(result.UpdatedAt) {
			h.Queries.CreateSecretHistoryEntry(ctx, uuidFromString(result.ID), nil, &newVal, user.ID, "created")
			imported++
		} else {
			h.Queries.CreateSecretHistoryEntry(ctx, uuidFromString(result.ID), nil, &newVal, user.ID, "updated")
			updated++
		}
	}
	appID := c.Param("app_id")
	wsID, wsType := h.getWorkspaceForApp(ctx, appID)
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "secrets.import", ResourceType: "environment", ResourceID: envID,
		WorkspaceID: wsID, WorkspaceType: wsType,
		Details: map[string]any{"imported": imported, "updated": updated},
	})
	c.JSON(http.StatusOK, gin.H{"imported": imported, "updated": updated})
}

func (h *SecretsHandler) ExportSecrets(c *gin.Context) {
	user := middleware.GetUser(c)
	appID := c.Param("app_id")
	envID := c.Param("env_id")
	format := c.DefaultQuery("format", "env")
	ctx := context.Background()

	encSymKey, err := h.getEncryptedSymKey(ctx, appID, user.ID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot retrieve encryption key"})
		return
	}
	rows, err := h.Queries.ListSecretsForExport(ctx, envID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch secrets"})
		return
	}
	type exportItem struct {
		Key            string `json:"key"`
		EncryptedValue string `json:"encrypted_value"`
	}
	items := []exportItem{}
	for _, r := range rows {
		items = append(items, exportItem{Key: r.Key, EncryptedValue: r.EncryptedValue})
	}
	if format == "json" {
		c.JSON(http.StatusOK, gin.H{
			"encrypted_team_symmetric_key": encSymKey,
			"secrets":                      items,
		})
		return
	}
	// .env format — include sym key as a comment header so clients can decrypt
	var sb strings.Builder
	fmt.Fprintf(&sb, "# VOID_ENCRYPTED_SYM_KEY=%s\n", encSymKey)
	for _, item := range items {
		fmt.Fprintf(&sb, "%s=%s\n", item.Key, item.EncryptedValue)
	}
	c.Header("Content-Disposition", "attachment; filename=.env.enc")
	c.Data(http.StatusOK, "text/plain", []byte(sb.String()))
}

func (h *SecretsHandler) GetHistory(c *gin.Context) {
	secretID := c.Param("secret_id")
	ctx := context.Background()

	rows, err := h.Queries.GetSecretHistory(ctx, uuidFromString(secretID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch history"})
		return
	}
	history := []models.SecretHistoryEntry{}
	for _, h := range rows {
		var sid *string
		if h.SecretID.Valid {
			s := pgUUIDToString(h.SecretID)
			sid = &s
		}
		history = append(history, models.SecretHistoryEntry{
			ID:                h.ID,
			SecretID:          sid,
			OldEncryptedValue: h.OldEncryptedValue,
			NewEncryptedValue: h.NewEncryptedValue,
			ChangedByName:     h.ChangedByName,
			Action:            h.Action,
			CreatedAt:         h.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, history)
}
