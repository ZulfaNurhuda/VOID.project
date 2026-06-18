package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/void-project/void-backend/internal/api/deps"
	"github.com/void-project/void-backend/internal/api/middleware"
	"github.com/void-project/void-backend/internal/models"
	"github.com/void-project/void-backend/internal/repository"
)

type AppsHandler struct {
	deps    *deps.Deps
	Queries *repository.Queries
}

func NewAppsHandler(d *deps.Deps) *AppsHandler {
	return &AppsHandler{deps: d, Queries: d.Queries}
}

func repoAppToModel(a repository.App) models.App {
	desc := ""
	if a.Description != nil {
		desc = *a.Description
	}
	return models.App{
		ID: a.ID, Name: a.Name, Description: desc,
		WorkspaceID: a.WorkspaceID, WorkspaceType: a.WorkspaceType,
		CreatedBy: a.CreatedBy, CreatedAt: a.CreatedAt, UpdatedAt: a.UpdatedAt,
	}
}

func (h *AppsHandler) ListApps(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := context.Background()
	wsType := c.Query("workspace_type")
	wsID := c.Query("workspace_id")

	apps := []models.App{}

	if wsType != "" && wsID != "" {
		rows, err := h.Queries.ListAppsForWorkspace(ctx, wsID, wsType)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list apps"})
			return
		}
		for _, a := range rows {
			apps = append(apps, repoAppToModel(a))
		}
	} else {
		personal, err := h.Queries.ListPersonalApps(ctx, user.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list apps"})
			return
		}
		team, err := h.Queries.ListTeamApps(ctx, user.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list apps"})
			return
		}
		for _, a := range personal {
			apps = append(apps, repoAppToModel(a))
		}
		for _, a := range team {
			apps = append(apps, repoAppToModel(a))
		}
	}
	c.JSON(http.StatusOK, apps)
}

func (h *AppsHandler) CreateApp(c *gin.Context) {
	user := middleware.GetUser(c)
	var req models.CreateAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	var desc *string
	if req.Description != "" {
		desc = &req.Description
	}
	app, err := h.Queries.CreateApp(ctx, req.Name, desc, req.WorkspaceID, req.WorkspaceType, user.ID)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "app name already exists in this workspace"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create app"})
		return
	}
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "apps.create", ResourceType: "app", ResourceID: app.ID,
		WorkspaceID: req.WorkspaceID, WorkspaceType: req.WorkspaceType,
	})
	c.JSON(http.StatusCreated, gin.H{"id": app.ID, "name": app.Name})
}

func (h *AppsHandler) GetApp(c *gin.Context) {
	appID := c.Param("app_id")
	ctx := context.Background()
	a, err := h.Queries.GetAppByID(ctx, appID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "app not found"})
		return
	}
	c.JSON(http.StatusOK, repoAppToModel(a))
}

func (h *AppsHandler) UpdateApp(c *gin.Context) {
	appID := c.Param("app_id")
	var req struct {
		Name        string `json:"name" binding:"required,min=1,max=100"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	var desc *string
	if req.Description != "" {
		desc = &req.Description
	}
	if err := h.Queries.UpdateApp(ctx, req.Name, desc, appID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update app"})
		return
	}
	// Fetch workspace info for audit
	a, _ := h.Queries.GetAppByID(ctx, appID)
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "apps.update", ResourceType: "app", ResourceID: appID,
		WorkspaceID: a.WorkspaceID, WorkspaceType: a.WorkspaceType,
	})
	c.JSON(http.StatusOK, gin.H{"id": appID, "name": req.Name})
}

func (h *AppsHandler) DeleteApp(c *gin.Context) {
	appID := c.Param("app_id")
	ctx := context.Background()
	a, _ := h.Queries.GetAppByID(ctx, appID)
	if err := h.Queries.DeleteApp(ctx, appID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete app"})
		return
	}
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "apps.delete", ResourceType: "app", ResourceID: appID,
		WorkspaceID: a.WorkspaceID, WorkspaceType: a.WorkspaceType,
	})
	c.JSON(http.StatusOK, gin.H{"message": "app deleted"})
}
