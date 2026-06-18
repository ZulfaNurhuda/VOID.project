package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pquerna/otp/totp"
	goredis "github.com/redis/go-redis/v9"
	"golang.org/x/crypto/argon2"

	"github.com/void-project/void-backend/internal/api/deps"
	"github.com/void-project/void-backend/internal/api/lib"
	"github.com/void-project/void-backend/internal/api/middleware"
	"github.com/void-project/void-backend/internal/repository"
)

type AuthHandler struct {
	DB      *pgxpool.Pool
	RDB     *goredis.Client
	Queries *repository.Queries
}

func NewAuthHandler(d *deps.Deps) *AuthHandler {
	return &AuthHandler{DB: d.DB, RDB: d.Redis, Queries: d.Queries}
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, 3, 65540, 4, 32)
	return hex.EncodeToString(salt) + "$" + hex.EncodeToString(hash), nil
}

func verifyPassword(password, storedHash string) bool {
	parts := strings.SplitN(storedHash, "$", 2)
	if len(parts) != 2 {
		return false
	}
	salt, err1 := hex.DecodeString(parts[0])
	stored, err2 := hex.DecodeString(parts[1])
	if err1 != nil || err2 != nil {
		return false
	}
	input := argon2.IDKey([]byte(password), salt, 3, 65540, 4, 32)
	return hex.EncodeToString(input) == hex.EncodeToString(stored)
}

func (h *AuthHandler) sessionDuration() time.Duration {
	return 24 * time.Hour
}

func (h *AuthHandler) createSession(c *gin.Context, userID string, client string) (string, error) {
	token, err := generateToken()
	if err != nil {
		return "", err
	}
	tokenHash := middleware.HashToken(token)
	expires := time.Now().Add(h.sessionDuration())
	deviceInfo := c.Request.UserAgent()
	ip := c.ClientIP()

	err = h.Queries.CreateSession(context.Background(), repository.CreateSessionParams{
		UserID:     userID,
		TokenHash:  tokenHash,
		DeviceInfo: &deviceInfo,
		IpAddress:  &ip,
		ExpiresAt:  expires,
		Client:     client,
	})
	if err != nil {
		return "", err
	}

	// Only set cookie for web sessions
	if client == "web" {
		secure := c.Request.TLS != nil
		c.SetCookie(middleware.SessionCookieName, token,
			int(h.sessionDuration().Seconds()), "/", "", secure, true)
	}

	return token, nil
}

// POST /api/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var body struct {
		Username            string `json:"username"                 binding:"required"`
		Email               string `json:"email"                    binding:"required,email"`
		Password            string `json:"password"                 binding:"required,min=8"`
		PublicKey           string `json:"publicKey"                binding:"required"`
		PrivateKeyEncrypted string `json:"privateKeyEncrypted"      binding:"required"`
		WorkspaceSymKeyEnc  string `json:"workspaceSymKeyEncrypted" binding:"required"`
		InviteCode          string `json:"inviteCode"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()

	// Check registration mode from instance_settings
	orgRaw, _ := h.Queries.GetOrgSetting(ctx)
	if orgRaw != nil {
		var org map[string]interface{}
		json.Unmarshal(orgRaw, &org)
		regMode, _ := org["registrationMode"].(string)
		if regMode == "closed" {
			c.JSON(http.StatusForbidden, gin.H{"error": "registration is closed"})
			return
		}
		if regMode == "invite-only" {
			if body.InviteCode == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invite code required"})
				return
			}
			invite, err := h.Queries.GetInviteByCode(ctx, body.InviteCode)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid invite code"})
				return
			}
			if !invite.IsActive {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invite code is inactive"})
				return
			}
			if invite.ExpiresAt.Valid && time.Now().After(invite.ExpiresAt.Time) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invite code has expired"})
				return
			}
			if invite.MaxUses != nil && invite.UseCount >= *invite.MaxUses {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invite code depleted"})
				return
			}
			defer h.Queries.IncrementInviteUseCount(ctx, invite.ID)
		}
	}

	passwordHash, err := hashPassword(body.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "registration failed"})
		return
	}

	userID, err := h.Queries.CreateUser(ctx,
		body.Username,
		strings.ToLower(body.Email),
		passwordHash,
		body.PublicKey,
		body.PrivateKeyEncrypted,
	)
	if err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			c.JSON(http.StatusConflict, gin.H{"error": "username or email already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "registration failed"})
		return
	}

	// Create personal workspace
	h.Queries.CreatePersonalWorkspace(ctx, userID, body.WorkspaceSymKeyEnc)

	if _, err := h.createSession(c, userID, "web"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session creation failed"})
		return
	}

	wsID, _ := h.Queries.GetPersonalWorkspaceID(ctx, userID)
	c.JSON(http.StatusCreated, gin.H{
		"user": gin.H{
			"id":                    userID,
			"username":              body.Username,
			"email":                 strings.ToLower(body.Email),
			"role":                  "user",
			"public_key":            body.PublicKey,
			"private_key_encrypted": body.PrivateKeyEncrypted,
			"totpEnabled":          false,
			"personal_workspace_id": wsID,
		},
	})
}

// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var body struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	user, err := h.Queries.GetUserForLoginByUsername(ctx, body.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if user.Status == "banned" {
		c.JSON(http.StatusForbidden, gin.H{"error": "account banned"})
		return
	}

	if !verifyPassword(body.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// 2FA check
	if user.TotpEnabled {
		tempToken, _ := generateToken()
		if h.RDB != nil {
			h.RDB.Set(ctx, "2fa:temp:"+middleware.HashToken(tempToken), user.ID, 10*time.Minute)
		}
		c.JSON(http.StatusOK, gin.H{
			"requiresTwoFactor": true,
			"tempToken":         tempToken,
		})
		return
	}

	token, err := h.createSession(c, user.ID, "web")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session creation failed"})
		return
	}

	wsID, _ := h.Queries.GetPersonalWorkspaceID(ctx, user.ID)
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":                    user.ID,
			"username":              user.Username,
			"email":                 user.Email,
			"role":                  user.Role,
			"public_key":            user.PublicKey,
			"private_key_encrypted": user.PrivateKeyEncrypted,
			"totpEnabled":          user.TotpEnabled,
			"personal_workspace_id": wsID,
		},
	})
}

// POST /api/cli/auth/login — CLI-only login; returns token in body, no cookie
func (h *AuthHandler) CLILogin(c *gin.Context) {
	var body struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	user, err := h.Queries.GetUserForLoginByUsername(ctx, body.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if user.Status == "banned" {
		c.JSON(http.StatusForbidden, gin.H{"error": "account banned"})
		return
	}

	if !verifyPassword(body.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := h.createSession(c, user.ID, "cli")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session creation failed"})
		return
	}

	wsID, _ := h.Queries.GetPersonalWorkspaceID(ctx, user.ID)
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":                    user.ID,
			"username":              user.Username,
			"email":                 user.Email,
			"role":                  user.Role,
			"public_key":            user.PublicKey,
			"private_key_encrypted": user.PrivateKeyEncrypted,
			"totpEnabled":          user.TotpEnabled,
			"personal_workspace_id": wsID,
		},
	})
}

// POST /api/auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	token, err := c.Cookie(middleware.SessionCookieName)
	if err == nil && token != "" {
		tokenHash := middleware.HashToken(token)
		ctx := context.Background()
		h.Queries.DeleteSessionByHash(ctx, tokenHash)
		if h.RDB != nil {
			h.RDB.Set(ctx, "blacklist:"+tokenHash, "1", 1*time.Hour)
		}
	}
	c.SetCookie(middleware.SessionCookieName, "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

// GET /api/auth/session
func (h *AuthHandler) GetSession(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	ctx := context.Background()
	row, err := h.Queries.GetUserPrivateKeyInfo(ctx, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user info"})
		return
	}

	wsID, _ := h.Queries.GetPersonalWorkspaceID(ctx, user.ID)
	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":                    user.ID,
			"username":              user.Username,
			"email":                 user.Email,
			"role":                  user.Role,
			"public_key":            row.PublicKey,
			"private_key_encrypted": row.PrivateKeyEncrypted,
			"totpEnabled":          row.TotpEnabled,
			"personal_workspace_id": wsID,
		},
	})
}

// GET /api/auth/providers
func (h *AuthHandler) GetProviders(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"google":  os.Getenv("GOOGLE_CLIENT_ID") != "",
		"github":  os.Getenv("GITHUB_CLIENT_ID") != "",
		"discord": os.Getenv("DISCORD_CLIENT_ID") != "",
	})
}

// POST /api/auth/2fa/setup
func (h *AuthHandler) Setup2FA(c *gin.Context) {
	user := middleware.GetUser(c)
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "VOID",
		AccountName: user.Email,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate 2FA"})
		return
	}
	if h.RDB != nil {
		h.RDB.Set(context.Background(), "2fa:setup:"+user.ID, key.Secret(), 10*time.Minute)
	}
	c.JSON(http.StatusOK, gin.H{
		"secret": key.Secret(),
		"qrUri":  key.URL(),
	})
}

// POST /api/auth/2fa/verify
func (h *AuthHandler) Verify2FA(c *gin.Context) {
	user := middleware.GetUser(c)
	var body struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var secret string
	if h.RDB != nil {
		secret, _ = h.RDB.Get(context.Background(), "2fa:setup:"+user.ID).Result()
	}
	if secret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no pending 2FA setup"})
		return
	}
	if !totp.Validate(body.Code, secret) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid code"})
		return
	}

	backupCodes := make([]string, 8)
	for i := range backupCodes {
		b := make([]byte, 5)
		rand.Read(b)
		backupCodes[i] = hex.EncodeToString(b)
	}

	h.Queries.EnableTOTP(context.Background(), &secret, backupCodes, user.ID)
	if h.RDB != nil {
		h.RDB.Del(context.Background(), "2fa:setup:"+user.ID)
	}

	c.JSON(http.StatusOK, gin.H{"backupCodes": backupCodes})
}

// POST /api/auth/2fa/disable
func (h *AuthHandler) Disable2FA(c *gin.Context) {
	user := middleware.GetUser(c)
	var body struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	secretPtr, err := h.Queries.GetUserTOTPSecret(context.Background(), user.ID)
	if err != nil || secretPtr == nil || *secretPtr == "" || !totp.Validate(body.Code, *secretPtr) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid code"})
		return
	}

	h.Queries.DisableTOTP(context.Background(), user.ID)
	c.JSON(http.StatusOK, gin.H{"message": "2FA disabled"})
}

// POST /api/auth/2fa/check  (during login flow)
func (h *AuthHandler) Check2FA(c *gin.Context) {
	var body struct {
		TempToken string `json:"tempToken" binding:"required"`
		Code      string `json:"code"      binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	var userID string
	if h.RDB != nil {
		userID, _ = h.RDB.Get(ctx, "2fa:temp:"+middleware.HashToken(body.TempToken)).Result()
	}
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired temp token"})
		return
	}

	secretPtr, err := h.Queries.GetUserTOTPSecret(ctx, userID)
	if err != nil || secretPtr == nil || !totp.Validate(body.Code, *secretPtr) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid 2FA code"})
		return
	}

	if h.RDB != nil {
		h.RDB.Del(ctx, "2fa:temp:"+middleware.HashToken(body.TempToken))
	}

	if _, err := h.createSession(c, userID, "web"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session creation failed"})
		return
	}

	u, err := h.Queries.GetUserPrivateKeyInfo(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user info"})
		return
	}

	// Need username/email/role — use GetUserByID
	uFull, err := h.Queries.GetUserByID(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user info"})
		return
	}

	wsID, _ := h.Queries.GetPersonalWorkspaceID(ctx, userID)
	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":                    userID,
			"username":              uFull.Username,
			"email":                 uFull.Email,
			"role":                  uFull.Role,
			"public_key":            u.PublicKey,
			"private_key_encrypted": u.PrivateKeyEncrypted,
			"totpEnabled":           u.TotpEnabled,
			"personal_workspace_id": wsID,
		},
	})
}

// POST /api/auth/forgot-password
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var body struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Always return 200 to prevent email enumeration
	c.JSON(http.StatusOK, gin.H{"message": "if this email exists, a reset link was sent"})

	ctx := context.Background()
	row, err := h.Queries.GetUserByEmail(ctx, strings.ToLower(body.Email))
	if err != nil {
		return
	}

	resetToken, _ := generateToken()
	tokenHash := middleware.HashToken(resetToken)
	expires := time.Now().Add(1 * time.Hour)

	h.Queries.CreatePasswordResetToken(ctx, row.ID, tokenHash, expires)

	baseURL := os.Getenv("VOID_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:38271"
	}
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", baseURL, resetToken)

	mailer := lib.NewMailer()
	if mailer.Enabled() {
		go mailer.Send(body.Email, "Reset your VOID password",
			fmt.Sprintf(`<p>Hi %s,</p><p>Click <a href="%s">here</a> to reset your password. This link expires in 1 hour.</p>`,
				row.Username, resetURL))
	}
}

// POST /api/auth/reset-password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var body struct {
		Token       string `json:"token"       binding:"required"`
		NewPassword string `json:"newPassword" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	tokenHash := middleware.HashToken(body.Token)

	token, err := h.Queries.GetPasswordResetToken(ctx, tokenHash)
	if err != nil || token.Used || time.Now().After(token.ExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired reset token"})
		return
	}

	newHash, err := hashPassword(body.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed"})
		return
	}

	h.Queries.UpdateUserPassword(ctx, newHash, token.UserID)
	h.Queries.MarkResetTokenUsed(ctx, token.ID)
	h.Queries.DeleteUserSessions(ctx, token.UserID)

	c.JSON(http.StatusOK, gin.H{"message": "password reset successful"})
}
