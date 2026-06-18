package api

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/void-project/void-backend/internal/api/deps"
	"github.com/void-project/void-backend/internal/api/handlers"
	adminHandlers "github.com/void-project/void-backend/internal/api/handlers/admin"
	userhandlers "github.com/void-project/void-backend/internal/api/handlers/user"
	"github.com/void-project/void-backend/internal/api/middleware"
)

func SetupRouter(d *deps.Deps) *gin.Engine {
	r := gin.Default()
	r.Use(middleware.CORS())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "version": "1.0.0"})
	})

	// CLI compatibility probe — public, no auth
	r.GET("/api/void/compat", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"void": true, "version": "1.0.0"})
	})

	// Public instance info (no auth required — used by login page and sidebar)
	r.GET("/api/instance/public", func(c *gin.Context) {
		ctx := c.Request.Context()
		var orgRaw []byte
		d.DB.QueryRow(ctx, "SELECT value FROM instance_settings WHERE key = 'organization'").Scan(&orgRaw)
		var org map[string]interface{}
		if orgRaw != nil {
			json.Unmarshal(orgRaw, &org)
		}
		var genRaw []byte
		d.DB.QueryRow(ctx, "SELECT value FROM instance_settings WHERE key = 'general'").Scan(&genRaw)
		var general map[string]interface{}
		if genRaw != nil {
			json.Unmarshal(genRaw, &general)
		}
		if org == nil {
			org = map[string]interface{}{"registrationMode": "open", "disableEmailSignup": false}
		}
		if general == nil {
			general = map[string]interface{}{"instanceName": "VOID"}
		}
		c.JSON(http.StatusOK, gin.H{
			"instanceName":       general["instanceName"],
			"registrationMode":   org["registrationMode"],
			"disableEmailSignup": org["disableEmailSignup"],
		})
	})

	setupHandler   := handlers.NewSetupHandler(d)
	authHandler    := handlers.NewAuthHandler(d)
	oauthHandler   := handlers.NewOAuthHandler(d, authHandler)
	sessionHandler := handlers.NewSessionHandler(d)
	teamsHandler   := handlers.NewTeamsHandler(d)
	appsHandler    := handlers.NewAppsHandler(d)
	envsHandler    := handlers.NewEnvsHandler(d)
	secretsHandler := handlers.NewSecretsHandler(d)
	auditHandler   := handlers.NewAuditHandler(d)

	// ── Setup routes (public, only works when no users exist) ────────────────
	r.GET("/api/auth/setup/status", setupHandler.Status)
	r.POST("/api/auth/setup",       setupHandler.Complete)

	// ── CLI auth routes (separate client type) ───────────────────────────────
	cliGroup := r.Group("/api/cli")
	{
		cliGroup.POST("/auth/login", middleware.LoginRateLimit(d.Redis), authHandler.CLILogin)
	}

	// ── Public auth routes ────────────────────────────────────────────────────
	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/register",  middleware.LoginRateLimit(d.Redis), authHandler.Register)
		authGroup.POST("/login",     middleware.LoginRateLimit(d.Redis), authHandler.Login)
		authGroup.POST("/logout",    authHandler.Logout)
		authGroup.GET("/providers",  authHandler.GetProviders)
		authGroup.POST("/2fa/check", authHandler.Check2FA)
		authGroup.GET("/oauth/:provider",          oauthHandler.Redirect)
		authGroup.GET("/oauth/:provider/callback", oauthHandler.Callback)
		authGroup.POST("/forgot-password",         authHandler.ForgotPassword)
		authGroup.POST("/reset-password",          authHandler.ResetPassword)
	}

	// ── Protected auth routes ─────────────────────────────────────────────────
	authProtected := r.Group("/api/auth", middleware.Auth(d.DB, d.Redis, d.Queries))
	{
		authProtected.GET("/session",          authHandler.GetSession)
		authProtected.POST("/2fa/setup",       authHandler.Setup2FA)
		authProtected.POST("/2fa/verify",      authHandler.Verify2FA)
		authProtected.POST("/2fa/disable",     authHandler.Disable2FA)
		authProtected.GET("/sessions",         sessionHandler.ListSessions)
		authProtected.DELETE("/sessions/:id",  sessionHandler.RevokeSession)
		authProtected.DELETE("/sessions",      sessionHandler.RevokeOtherSessions)
	}

	// ── Authenticated routes ──────────────────────────────────────────────────
	api := r.Group("/api")
	api.Use(middleware.Auth(d.DB, d.Redis, d.Queries))
	api.Use(middleware.APIRateLimit(d.Redis))
	api.Use(middleware.AuditLog(d.DB))
	{
		// Auth helpers
		api.GET("/auth/me",    authHandler.GetSession)
		api.GET("/auth/users", handlers.GetUserByEmail(d))

		// Teams
		api.GET("/teams",    teamsHandler.ListTeams)
		api.POST("/teams",   teamsHandler.CreateTeam)
		api.GET("/teams/:team_id",    middleware.RequireTeamMember(d.DB), teamsHandler.GetTeam)
		api.PUT("/teams/:team_id",    middleware.RequireTeamAdmin(d.DB),  teamsHandler.UpdateTeam)
		api.DELETE("/teams/:team_id", middleware.RequireTeamOwner(d.DB),  teamsHandler.DeleteTeam)

		// Team Members
		api.GET("/teams/:team_id/members",               middleware.RequireTeamMember(d.DB), teamsHandler.ListMembers)
		api.POST("/teams/:team_id/members",              middleware.RequireTeamAdmin(d.DB),  teamsHandler.AddMember)
		api.DELETE("/teams/:team_id/members/:user_id",   middleware.RequireTeamAdmin(d.DB),  teamsHandler.RemoveMember)
		api.PUT("/teams/:team_id/members/:user_id/role", middleware.RequireTeamAdmin(d.DB),  teamsHandler.UpdateMemberRole)

		// Apps
		api.GET("/apps",         appsHandler.ListApps)
		api.POST("/apps",        appsHandler.CreateApp)
		api.GET("/apps/:app_id",    middleware.RequireAppAccess(d.DB), appsHandler.GetApp)
		api.PUT("/apps/:app_id",    middleware.RequireAppAdmin(d.DB),  appsHandler.UpdateApp)
		api.DELETE("/apps/:app_id", middleware.RequireAppAdmin(d.DB),  appsHandler.DeleteApp)

		// Environments
		api.GET("/apps/:app_id/envs",            middleware.RequireAppAccess(d.DB), envsHandler.ListEnvs)
		api.POST("/apps/:app_id/envs",           middleware.RequireAppAdmin(d.DB),  envsHandler.CreateEnv)
		api.PUT("/apps/:app_id/envs/:env_id",    middleware.RequireAppAdmin(d.DB),  envsHandler.UpdateEnv)
		api.DELETE("/apps/:app_id/envs/:env_id", middleware.RequireAppAdmin(d.DB),  envsHandler.DeleteEnv)

		// Secrets — static paths before :secret_id to avoid routing conflicts
		base := "/apps/:app_id/envs/:env_id"
		api.GET(base+"/secrets",         middleware.RequireAppAccess(d.DB), secretsHandler.ListSecrets)
		api.POST(base+"/secrets",        middleware.RequireAppAccess(d.DB), secretsHandler.CreateSecret)
		api.GET(base+"/secrets/export",  middleware.RequireAppAccess(d.DB), secretsHandler.ExportSecrets)
		api.POST(base+"/secrets/import", middleware.RequireAppAccess(d.DB), secretsHandler.ImportSecrets)
		api.GET(base+"/secrets/:secret_id",         middleware.RequireAppAccess(d.DB), secretsHandler.GetSecret)
		api.PUT(base+"/secrets/:secret_id",         middleware.RequireAppAccess(d.DB), secretsHandler.UpdateSecret)
		api.DELETE(base+"/secrets/:secret_id",      middleware.RequireAppAccess(d.DB), secretsHandler.DeleteSecret)
		api.GET(base+"/secrets/:secret_id/history", middleware.RequireAppAccess(d.DB), secretsHandler.GetHistory)

		// Audit Logs
		api.GET("/audit-logs",        auditHandler.ListLogs)
		api.GET("/audit-logs/export", auditHandler.ExportCSV)
	}

	// Admin routes (require auth + admin role)
	analyticsHandler  := adminHandlers.NewAnalyticsHandler(d)
	adminUsersHandler := adminHandlers.NewUsersHandler(d)
	invitesHandler    := adminHandlers.NewInvitesHandler(d)
	instanceHandler   := adminHandlers.NewInstanceHandler(d)

	adminGroup := r.Group("/api/admin",
		middleware.Auth(d.DB, d.Redis, d.Queries),
		middleware.AdminOnly(),
	)
	{
		adminGroup.GET("/analytics/summary",  analyticsHandler.Summary)
		adminGroup.GET("/analytics/activity", analyticsHandler.Activity)

		adminGroup.GET("/users",         adminUsersHandler.List)
		adminGroup.POST("/users",        adminUsersHandler.Create)
		adminGroup.PATCH("/users/:id",   adminUsersHandler.Update)
		adminGroup.DELETE("/users/:id",  adminUsersHandler.Delete)

		adminGroup.GET("/invites",              invitesHandler.List)
		adminGroup.POST("/invites",             invitesHandler.Create)
		adminGroup.PATCH("/invites/:id/status", invitesHandler.Deactivate)
		adminGroup.DELETE("/invites/:id",       invitesHandler.Delete)

		adminGroup.GET("/instance",                instanceHandler.Get)
		adminGroup.PATCH("/instance/general",      instanceHandler.UpdateGeneral)
		adminGroup.PATCH("/instance/security",     instanceHandler.UpdateSecurity)
		adminGroup.PATCH("/instance/organization", instanceHandler.UpdateOrganization)
		adminGroup.GET("/instance/webhooks",       instanceHandler.GetWebhook)
		adminGroup.PATCH("/instance/webhooks",     instanceHandler.UpdateWebhook)
		adminGroup.POST("/instance/webhooks/test", instanceHandler.TestWebhook)
		adminGroup.GET("/instance/metrics",        instanceHandler.GetMetrics)
		adminGroup.POST("/instance/metrics/token", instanceHandler.RegenerateMetricsToken)
	}

	// Scalar API docs
	r.GET("/api/docs", func(c *gin.Context) {
		c.Header("Content-Type", "text/html")
		c.String(http.StatusOK, `<!DOCTYPE html>
<html>
<head>
  <title>VOID API Docs</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/api/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`)
	})

	r.GET("/api/openapi.json", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"openapi": "3.1.0",
			"info": gin.H{
				"title":   "VOID API",
				"version": "1.0.0",
			},
			"servers": []gin.H{{"url": "/api"}},
			"paths":   gin.H{},
		})
	})

	// User routes (protected)
	profileHandler := userhandlers.NewProfileHandler(d)
	apiKeyHandler  := userhandlers.NewAPIKeyHandler(d)
	userGroup := r.Group("/api/user", middleware.AuthWithAPIKey(d.DB, d.Redis, d.Queries))
	{
		userGroup.PATCH("/profile",        profileHandler.UpdateProfile)
		userGroup.POST("/change-password", profileHandler.ChangePassword)
		userGroup.DELETE("/account",       profileHandler.DeleteAccount)
		userGroup.GET("/api-keys",         apiKeyHandler.ListKeys)
		userGroup.POST("/api-keys",        apiKeyHandler.CreateKey)
		userGroup.DELETE("/api-keys/:id",  apiKeyHandler.DeleteKey)
	}

	return r
}
