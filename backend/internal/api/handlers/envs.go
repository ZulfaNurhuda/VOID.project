package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/void-project/void-backend/internal/api/deps"
	"github.com/void-project/void-backend/internal/api/middleware"
	"github.com/void-project/void-backend/internal/models"
	"github.com/void-project/void-backend/internal/repository"
)

type EnvsHandler struct {
	deps    *deps.Deps
	Queries *repository.Queries
}

func NewEnvsHandler(d *deps.Deps) *EnvsHandler {
	return &EnvsHandler{deps: d, Queries: d.Queries}
}

func (h *EnvsHandler) ListEnvs(c *gin.Context) {
	appID := c.Param("app_id")
	ctx := context.Background()
	rows, err := h.Queries.ListEnvs(ctx, appID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list environments"})
		return
	}
	envs := []models.Environment{}
	for _, e := range rows {
		envs = append(envs, models.Environment{
			ID: e.ID, AppID: e.AppID, Name: e.Name,
			CreatedAt: e.CreatedAt, UpdatedAt: e.UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, envs)
}

func (h *EnvsHandler) CreateEnv(c *gin.Context) {
	appID := c.Param("app_id")
	var req struct {
		Name string `json:"name" binding:"required,min=1,max=50"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	env, err := h.Queries.CreateEnv(ctx, appID, req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create environment"})
		return
	}
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "envs.create", ResourceType: "environment", ResourceID: env.ID,
	})
	c.JSON(http.StatusCreated, gin.H{"id": env.ID, "app_id": appID, "name": env.Name})
}

func (h *EnvsHandler) UpdateEnv(c *gin.Context) {
	envID := c.Param("env_id")
	var req struct {
		Name string `json:"name" binding:"required,min=1,max=50"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	if err := h.Queries.UpdateEnv(ctx, req.Name, envID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update environment"})
		return
	}
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "envs.update", ResourceType: "environment", ResourceID: envID,
	})
	c.JSON(http.StatusOK, gin.H{"id": envID, "name": req.Name})
}

func (h *EnvsHandler) DeleteEnv(c *gin.Context) {
	envID := c.Param("env_id")
	ctx := context.Background()
	if err := h.Queries.DeleteEnv(ctx, envID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete environment"})
		return
	}
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "envs.delete", ResourceType: "environment", ResourceID: envID,
	})
	c.JSON(http.StatusOK, gin.H{"message": "environment deleted"})
}
