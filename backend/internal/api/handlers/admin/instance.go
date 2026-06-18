// backend/internal/api/handlers/admin/instance.go
package admin

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/void-project/void-backend/internal/api/deps"
	"github.com/void-project/void-backend/internal/repository"
)

type InstanceHandler struct {
	DB        *pgxpool.Pool
	startTime time.Time
	Queries   *repository.Queries
}

func NewInstanceHandler(d *deps.Deps) *InstanceHandler {
	return &InstanceHandler{DB: d.DB, startTime: time.Now(), Queries: d.Queries}
}

func (h *InstanceHandler) getSetting(ctx context.Context, key string) (map[string]interface{}, error) {
	raw, err := h.Queries.GetInstanceSetting(ctx, key)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (h *InstanceHandler) updateSetting(ctx context.Context, key string, value interface{}) error {
	data, _ := json.Marshal(value)
	return h.Queries.UpsertInstanceSetting(ctx, key, data)
}

// GET /api/admin/instance
func (h *InstanceHandler) Get(c *gin.Context) {
	ctx := c.Request.Context()
	defaults := map[string]map[string]interface{}{
		"general":      {"instanceName": "VOID", "description": "", "logoBase64": ""},
		"security":     {"enableRateLimiting": false, "allowPasswordProtection": true, "allowIpRestriction": false},
		"organization": {"requireInviteCode": false, "requireRegisteredUser": false, "disableEmailPasswordSignup": false, "allowedEmailDomains": ""},
		"webhook":      {"webhookEnabled": false, "webhookUrl": "", "webhookSecret": ""},
		"metrics":      {"metricsEnabled": false, "metricsSecret": ""},
	}
	result := map[string]interface{}{}
	for _, key := range []string{"general", "security", "organization", "webhook", "metrics"} {
		setting, err := h.getSetting(ctx, key)
		if err != nil {
			result[key] = defaults[key]
		} else {
			result[key] = setting
		}
	}
	result["isManaged"] = os.Getenv("VOID_MANAGED") == "true"
	c.JSON(http.StatusOK, result)
}

// PATCH /api/admin/instance/general
func (h *InstanceHandler) UpdateGeneral(c *gin.Context) {
	if os.Getenv("VOID_MANAGED") == "true" {
		c.JSON(http.StatusForbidden, gin.H{"error": "instance is managed externally"})
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.updateSetting(c.Request.Context(), "general", body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// PATCH /api/admin/instance/security
func (h *InstanceHandler) UpdateSecurity(c *gin.Context) {
	if os.Getenv("VOID_MANAGED") == "true" {
		c.JSON(http.StatusForbidden, gin.H{"error": "instance is managed externally"})
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.updateSetting(c.Request.Context(), "security", body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// PATCH /api/admin/instance/organization
func (h *InstanceHandler) UpdateOrganization(c *gin.Context) {
	if os.Getenv("VOID_MANAGED") == "true" {
		c.JSON(http.StatusForbidden, gin.H{"error": "instance is managed externally"})
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.updateSetting(c.Request.Context(), "organization", body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// GET /api/admin/instance/webhooks
func (h *InstanceHandler) GetWebhook(c *gin.Context) {
	setting, err := h.getSetting(c.Request.Context(), "webhook")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed"})
		return
	}
	c.JSON(http.StatusOK, setting)
}

// PATCH /api/admin/instance/webhooks
func (h *InstanceHandler) UpdateWebhook(c *gin.Context) {
	if os.Getenv("VOID_MANAGED") == "true" {
		c.JSON(http.StatusForbidden, gin.H{"error": "instance is managed externally"})
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.updateSetting(c.Request.Context(), "webhook", body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// POST /api/admin/instance/webhooks/test
func (h *InstanceHandler) TestWebhook(c *gin.Context) {
	setting, _ := h.getSetting(c.Request.Context(), "webhook")
	url, _ := setting["url"].(string)
	secret, _ := setting["secret"].(string)
	if url == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no webhook URL configured"})
		return
	}
	payload := map[string]interface{}{
		"event":     "test",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"data":      map[string]string{"message": "VOID webhook test ping"},
	}
	go deliverWebhook(url, secret, payload)
	c.JSON(http.StatusOK, gin.H{"message": "test ping sent"})
}

// GET /api/admin/instance/metrics
func (h *InstanceHandler) GetMetrics(c *gin.Context) {
	ctx := c.Request.Context()
	totalSecrets, _ := h.Queries.CountSecretsTotal(ctx)
	totalUsers, _ := h.Queries.CountUsersTotal(ctx)

	setting, _ := h.getSetting(ctx, "metrics")
	uptime := time.Since(h.startTime).String()

	c.JSON(http.StatusOK, gin.H{
		"totalSecrets": totalSecrets,
		"totalUsers":   totalUsers,
		"uptime":       uptime,
		"enabled":      setting["enabled"],
		"bearerToken":  nil,
	})
}

// POST /api/admin/instance/metrics/token
func (h *InstanceHandler) RegenerateMetricsToken(c *gin.Context) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}
	token := hex.EncodeToString(b)

	ctx := c.Request.Context()
	setting, _ := h.getSetting(ctx, "metrics")
	if setting == nil {
		setting = map[string]interface{}{}
	}
	setting["bearerToken"] = token
	if err := h.updateSetting(ctx, "metrics", setting); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"bearerToken": token})
}

func deliverWebhook(webhookURL, secret string, payload map[string]interface{}) {
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", webhookURL, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if secret != "" {
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(body)
		req.Header.Set("X-Void-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	}
	client := &http.Client{Timeout: 10 * time.Second}
	client.Do(req) //nolint:errcheck
}
