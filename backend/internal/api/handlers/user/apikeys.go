// backend/internal/api/handlers/user/apikeys.go
package user

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"math/big"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/void-project/void-backend/internal/api/deps"
	voidmw "github.com/void-project/void-backend/internal/api/middleware"
	"github.com/void-project/void-backend/internal/repository"
)

type APIKeyHandler struct {
	DB      *pgxpool.Pool
	Queries *repository.Queries
}

func NewAPIKeyHandler(d *deps.Deps) *APIKeyHandler {
	return &APIKeyHandler{DB: d.DB, Queries: d.Queries}
}

const base62Chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

func generateAPIKey() (fullKey, prefix, keyHash string, err error) {
	result := make([]byte, 32)
	for i := range result {
		n, e := rand.Int(rand.Reader, big.NewInt(62))
		if e != nil {
			return "", "", "", e
		}
		result[i] = base62Chars[n.Int64()]
	}
	suffix := string(result)
	fullKey = "vd_sk_" + suffix
	prefix = fullKey[:12] // "vd_sk_" + first 6 chars
	h := sha256.Sum256([]byte(fullKey))
	keyHash = hex.EncodeToString(h[:])
	return fullKey, prefix, keyHash, nil
}

// GET /api/user/api-keys
func (h *APIKeyHandler) ListKeys(c *gin.Context) {
	user := voidmw.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	rows, err := h.Queries.ListAPIKeys(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list keys"})
		return
	}

	type KeyRow struct {
		ID        string  `json:"id"`
		Name      string  `json:"name"`
		KeyPrefix string  `json:"prefix"`
		LastUsed  *string `json:"lastUsed"`
		CreatedAt string  `json:"createdAt"`
	}
	keys := make([]KeyRow, 0, len(rows))
	for _, k := range rows {
		kr := KeyRow{
			ID:        k.ID,
			Name:      k.Name,
			KeyPrefix: k.KeyPrefix,
			CreatedAt: k.CreatedAt.Format(time.RFC3339),
		}
		if k.LastUsed.Valid {
			s := k.LastUsed.Time.Format(time.RFC3339)
			kr.LastUsed = &s
		}
		keys = append(keys, kr)
	}
	c.JSON(http.StatusOK, gin.H{"apiKeys": keys})
}

// POST /api/user/api-keys
func (h *APIKeyHandler) CreateKey(c *gin.Context) {
	user := voidmw.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	var body struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fullKey, prefix, keyHash, err := generateAPIKey()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "key generation failed"})
		return
	}

	result, err := h.Queries.CreateAPIKey(c.Request.Context(),
		user.ID,
		body.Name,
		keyHash,
		prefix,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create key"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":        result.ID,
		"name":      body.Name,
		"key":       fullKey, // shown ONCE
		"prefix":    prefix,
		"createdAt": result.CreatedAt.Format(time.RFC3339),
	})
}

// DELETE /api/user/api-keys/:id
func (h *APIKeyHandler) DeleteKey(c *gin.Context) {
	user := voidmw.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	keyID := c.Param("id")

	n, err := h.Queries.DeleteAPIKey(c.Request.Context(), keyID, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete key"})
		return
	}
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "key not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "key deleted"})
}
