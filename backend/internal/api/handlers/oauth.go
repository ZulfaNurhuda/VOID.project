package handlers

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"

	"github.com/void-project/void-backend/internal/api/deps"
	"github.com/void-project/void-backend/internal/repository"
)

type OAuthHandler struct {
	DB      *pgxpool.Pool
	AH      *AuthHandler
	Queries *repository.Queries
}

func NewOAuthHandler(d *deps.Deps, ah *AuthHandler) *OAuthHandler {
	return &OAuthHandler{DB: d.DB, AH: ah, Queries: d.Queries}
}

func (h *OAuthHandler) getConfig(provider string) (*oauth2.Config, error) {
	baseURL := os.Getenv("VOID_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:38271"
	}
	callbackURL := fmt.Sprintf("%s/api/auth/oauth/%s/callback", baseURL, provider)

	switch provider {
	case "google":
		if os.Getenv("GOOGLE_CLIENT_ID") == "" {
			return nil, fmt.Errorf("google not configured")
		}
		return &oauth2.Config{
			ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
			ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
			RedirectURL:  callbackURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		}, nil
	case "github":
		if os.Getenv("GITHUB_CLIENT_ID") == "" {
			return nil, fmt.Errorf("github not configured")
		}
		return &oauth2.Config{
			ClientID:     os.Getenv("GITHUB_CLIENT_ID"),
			ClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
			RedirectURL:  callbackURL,
			Scopes:       []string{"user:email"},
			Endpoint:     github.Endpoint,
		}, nil
	case "discord":
		if os.Getenv("DISCORD_CLIENT_ID") == "" {
			return nil, fmt.Errorf("discord not configured")
		}
		return &oauth2.Config{
			ClientID:     os.Getenv("DISCORD_CLIENT_ID"),
			ClientSecret: os.Getenv("DISCORD_CLIENT_SECRET"),
			RedirectURL:  callbackURL,
			Scopes:       []string{"identify", "email"},
			Endpoint: oauth2.Endpoint{
				AuthURL:  "https://discord.com/api/oauth2/authorize",
				TokenURL: "https://discord.com/api/oauth2/token",
			},
		}, nil
	}
	return nil, fmt.Errorf("unsupported provider: %s", provider)
}

// GET /api/auth/oauth/:provider
func (h *OAuthHandler) Redirect(c *gin.Context) {
	provider := c.Param("provider")
	cfg, err := h.getConfig(provider)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	state := fmt.Sprintf("%d", time.Now().UnixNano())
	url := cfg.AuthCodeURL(state, oauth2.AccessTypeOnline)
	c.Redirect(http.StatusTemporaryRedirect, url)
}

// GET /api/auth/oauth/:provider/callback
func (h *OAuthHandler) Callback(c *gin.Context) {
	provider := c.Param("provider")
	code := c.Query("code")
	if code == "" {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=oauth_failed")
		return
	}

	cfg, err := h.getConfig(provider)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=provider_not_configured")
		return
	}

	oauthToken, err := cfg.Exchange(context.Background(), code)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=token_exchange_failed")
		return
	}

	email, providerID, username, err := h.fetchUserInfo(provider, oauthToken)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=userinfo_failed")
		return
	}

	ctx := context.Background()

	// Find existing OAuth account
	existing, err := h.Queries.GetOAuthAccount(ctx, provider, providerID)
	var userID string
	if err != nil {
		// New OAuth user — create account
		userID, err = h.Queries.UpsertOAuthUser(ctx, username, strings.ToLower(email))
		if err != nil {
			c.Redirect(http.StatusTemporaryRedirect, "/login?error=user_creation_failed")
			return
		}

		h.Queries.CreateOAuthAccount(ctx, userID, provider, providerID)
		h.Queries.CreatePersonalWorkspace(ctx, userID, "")
	} else {
		userID = existing.ID
	}

	if _, err := h.AH.createSession(c, userID, "web"); err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/login?error=session_failed")
		return
	}
	c.Redirect(http.StatusTemporaryRedirect, "/dashboard/secrets")
}

func (h *OAuthHandler) fetchUserInfo(provider string, token *oauth2.Token) (email, id, username string, err error) {
	var infoURL string
	switch provider {
	case "google":
		infoURL = "https://www.googleapis.com/oauth2/v2/userinfo"
	case "github":
		infoURL = "https://api.github.com/user"
	case "discord":
		infoURL = "https://discord.com/api/users/@me"
	default:
		return "", "", "", fmt.Errorf("unknown provider")
	}

	req, _ := http.NewRequest("GET", infoURL, nil)
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var data map[string]interface{}
	json.Unmarshal(body, &data)

	switch provider {
	case "google":
		email = fmt.Sprint(data["email"])
		id = fmt.Sprint(data["id"])
		username = strings.Split(email, "@")[0]
	case "github":
		email = fmt.Sprint(data["email"])
		id = fmt.Sprint(data["id"])
		if n, ok := data["login"]; ok {
			username = fmt.Sprint(n)
		} else {
			username = strings.Split(email, "@")[0]
		}
	case "discord":
		email = fmt.Sprint(data["email"])
		id = fmt.Sprint(data["id"])
		username = fmt.Sprint(data["username"])
	}
	return
}

// DeliverWebhook — helper used by instance handler
func DeliverWebhook(webhookURL, secret string, payload map[string]interface{}) {
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
	client.Do(req)
}
