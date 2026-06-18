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

type TeamsHandler struct {
	deps    *deps.Deps
	Queries *repository.Queries
}

func NewTeamsHandler(d *deps.Deps) *TeamsHandler {
	return &TeamsHandler{deps: d, Queries: d.Queries}
}

func (h *TeamsHandler) ListTeams(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := context.Background()

	// Fetch teams where user is owner OR member; merge and deduplicate by ID
	owned, err := h.Queries.ListTeamsByOwner(ctx, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list teams"})
		return
	}
	membered, err := h.Queries.ListTeamsByMember(ctx, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list teams"})
		return
	}

	seen := map[string]struct{}{}
	teams := []models.Team{}
	for _, t := range owned {
		if _, ok := seen[t.ID]; !ok {
			seen[t.ID] = struct{}{}
			teams = append(teams, models.Team{
				ID: t.ID, Name: t.Name, OwnerID: t.OwnerID,
				CreatedAt: t.CreatedAt, UpdatedAt: t.UpdatedAt,
			})
		}
	}
	for _, t := range membered {
		if _, ok := seen[t.ID]; !ok {
			seen[t.ID] = struct{}{}
			teams = append(teams, models.Team{
				ID: t.ID, Name: t.Name, OwnerID: t.OwnerID,
				CreatedAt: t.CreatedAt, UpdatedAt: t.UpdatedAt,
			})
		}
	}
	c.JSON(http.StatusOK, teams)
}

func (h *TeamsHandler) CreateTeam(c *gin.Context) {
	user := middleware.GetUser(c)
	var req models.CreateTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	team, err := h.Queries.CreateTeam(ctx, req.Name, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create team"})
		return
	}

	if err := h.Queries.AddTeamMember(ctx, team.ID, user.ID, "admin", req.EncryptedTeamSymmetricKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add owner to team"})
		return
	}

	h.deps.Redis.Del(ctx, "cache:user_teams:"+user.ID)

	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "teams.create", ResourceType: "team", ResourceID: team.ID,
		WorkspaceID: team.ID, WorkspaceType: "team",
	})

	c.JSON(http.StatusCreated, gin.H{"id": team.ID, "name": team.Name, "owner_id": user.ID})
}

func (h *TeamsHandler) GetTeam(c *gin.Context) {
	teamID := c.Param("team_id")
	ctx := context.Background()
	t, err := h.Queries.GetTeamByID(ctx, teamID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "team not found"})
		return
	}
	c.JSON(http.StatusOK, models.Team{
		ID: t.ID, Name: t.Name, OwnerID: t.OwnerID,
		CreatedAt: t.CreatedAt, UpdatedAt: t.UpdatedAt,
	})
}

func (h *TeamsHandler) UpdateTeam(c *gin.Context) {
	teamID := c.Param("team_id")
	var req struct {
		Name string `json:"name" binding:"required,min=1,max=100"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	if err := h.Queries.UpdateTeam(ctx, req.Name, teamID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update team"})
		return
	}
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "teams.update", ResourceType: "team", ResourceID: teamID,
		WorkspaceID: teamID, WorkspaceType: "team",
	})
	c.JSON(http.StatusOK, gin.H{"id": teamID, "name": req.Name})
}

func (h *TeamsHandler) DeleteTeam(c *gin.Context) {
	teamID := c.Param("team_id")
	ctx := context.Background()
	if err := h.Queries.DeleteTeam(ctx, teamID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete team"})
		return
	}
	h.deps.Redis.Del(ctx, "cache:team_members:"+teamID)
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "teams.delete", ResourceType: "team", ResourceID: teamID,
		WorkspaceID: teamID, WorkspaceType: "team",
	})
	c.JSON(http.StatusOK, gin.H{"message": "team deleted"})
}

func (h *TeamsHandler) ListMembers(c *gin.Context) {
	teamID := c.Param("team_id")
	ctx := context.Background()
	rows, err := h.Queries.ListTeamMembers(ctx, teamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list members"})
		return
	}
	members := []models.TeamMember{}
	for _, m := range rows {
		members = append(members, models.TeamMember{
			UserID: m.ID, Username: m.Username, Email: m.Email,
			Role: m.Role, CreatedAt: m.CreatedAt, TeamID: teamID,
			EncryptedTeamSymmetricKey: m.EncryptedTeamSymmetricKey,
		})
	}
	c.JSON(http.StatusOK, members)
}

func (h *TeamsHandler) AddMember(c *gin.Context) {
	teamID := c.Param("team_id")
	var req models.AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	userRow, err := h.Queries.GetUserPublicKeyByUsername(ctx, req.Username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user '" + req.Username + "' not found in the system"})
		return
	}
	if userRow.PublicKey == "" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "user '" + req.Username + "' has no public key — they need to re-register"})
		return
	}
	if err := h.Queries.AddTeamMember(ctx, teamID, userRow.ID, "member", req.EncryptedTeamSymmetricKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add member"})
		return
	}
	h.deps.Redis.Del(ctx, "cache:team_members:"+teamID)
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "members.add", ResourceType: "user", ResourceID: userRow.ID,
		WorkspaceID: teamID, WorkspaceType: "team",
	})
	c.JSON(http.StatusCreated, gin.H{"message": "member added"})
}

func (h *TeamsHandler) RemoveMember(c *gin.Context) {
	teamID := c.Param("team_id")
	targetUserID := c.Param("user_id")
	ctx := context.Background()
	if err := h.Queries.RemoveTeamMember(ctx, teamID, targetUserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove member"})
		return
	}
	h.deps.Redis.Del(ctx, "cache:team_members:"+teamID)
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "members.remove", ResourceType: "user", ResourceID: targetUserID,
		WorkspaceID: teamID, WorkspaceType: "team",
	})
	c.JSON(http.StatusOK, gin.H{"message": "member removed"})
}

func (h *TeamsHandler) UpdateMemberRole(c *gin.Context) {
	teamID := c.Param("team_id")
	targetUserID := c.Param("user_id")
	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx := context.Background()
	if err := h.Queries.UpdateTeamMemberRole(ctx, req.Role, teamID, targetUserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update role"})
		return
	}
	h.deps.Redis.Del(ctx, "cache:team_members:"+teamID)
	middleware.SetAudit(c, middleware.AuditEntry{
		Action: "members.update_role", ResourceType: "user", ResourceID: targetUserID,
		WorkspaceID: teamID, WorkspaceType: "team",
	})
	c.JSON(http.StatusOK, gin.H{"message": "role updated"})
}
