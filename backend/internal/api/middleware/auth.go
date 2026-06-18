package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"
	"github.com/void-project/void-backend/internal/repository"
)

const SessionCookieName = "void_session"
const ContextKeyUser = "user"

type UserContext struct {
	ID       string
	Username string
	Email    string
	Role     string
	Status   string
}

func HashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func Auth(db *pgxpool.Pool, rdb *goredis.Client, q *repository.Queries) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Determine token source and expected client type
		var token string
		var expectedClient string

		cookieToken, _ := c.Cookie(SessionCookieName)
		if cookieToken != "" {
			token = cookieToken
			expectedClient = "web"
		} else if ah := c.GetHeader("Authorization"); strings.HasPrefix(ah, "Bearer ") {
			candidate := strings.TrimPrefix(ah, "Bearer ")
			if !strings.HasPrefix(candidate, "vd_sk_") {
				token = candidate
				expectedClient = "cli"
			}
		}

		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		tokenHash := HashToken(token)

		// Check Redis blacklist
		if rdb != nil {
			val, _ := rdb.Get(context.Background(), "blacklist:"+tokenHash).Result()
			if val != "" {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "session revoked"})
				return
			}
		}

		row, err := q.GetSessionForAuth(c.Request.Context(), tokenHash)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid session"})
			return
		}

		// Enforce client type: web sessions must come via cookie, CLI via Bearer
		if row.Client != expectedClient {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		if time.Now().After(row.ExpiresAt) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "session expired"})
			return
		}

		if row.Status == "banned" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "account banned"})
			return
		}

		go func() {
			db.Exec(context.Background(),
				"UPDATE sessions SET last_used_at = NOW() WHERE token_hash = $1", tokenHash)
		}()

		c.Set(ContextKeyUser, &UserContext{
			ID:       row.ID,
			Username: row.Username,
			Email:    row.Email,
			Role:     row.Role,
			Status:   row.Status,
		})
		c.Next()
	}
}

// AuthWithAPIKey accepts both session cookies (existing) and Bearer vd_sk_* API keys.
func AuthWithAPIKey(db *pgxpool.Pool, rdb *goredis.Client, q *repository.Queries) gin.HandlerFunc {
	sessionAuth := Auth(db, rdb, q)
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer vd_sk_") {
			key := strings.TrimPrefix(authHeader, "Bearer ")
			h := sha256.Sum256([]byte(key))
			keyHash := hex.EncodeToString(h[:])

			row, err := q.GetUserFromAPIKey(c.Request.Context(), keyHash)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid API key"})
				return
			}
			uc := &UserContext{ID: row.ID, Username: row.Username, Email: row.Email, Role: row.Role, Status: row.Status}
			go db.Exec(context.Background(),
				"UPDATE api_keys SET last_used = NOW() WHERE key_hash = $1", keyHash)
			c.Set(ContextKeyUser, uc)
			c.Next()
			return
		}
		sessionAuth(c)
	}
}

func GetUser(c *gin.Context) *UserContext {
	u, _ := c.Get(ContextKeyUser)
	if uc, ok := u.(*UserContext); ok {
		return uc
	}
	return nil
}
