package models

import "time"

type User struct {
	ID                  string    `json:"id"`
	Username            string    `json:"username"`
	Email               string    `json:"email"`
	PasswordHash        string    `json:"-"`
	PublicKey           string    `json:"public_key"`
	PrivateKeyEncrypted string    `json:"-"`
	Role                string    `json:"role"        db:"role"`
	Status              string    `json:"status"      db:"status"`
	TOTPSecret          *string   `json:"-"           db:"totp_secret"`
	TOTPEnabled         bool      `json:"totpEnabled" db:"totp_enabled"`
	BackupCodes         []string  `json:"-"           db:"backup_codes"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type RegisterRequest struct {
	Username                       string `json:"username" binding:"required,min=3,max=50"`
	Email                          string `json:"email" binding:"required,email"`
	Password                       string `json:"password" binding:"required,min=8"`
	PublicKey                      string `json:"public_key" binding:"required"`
	PrivateKeyEncrypted            string `json:"private_key_encrypted" binding:"required"`
	EncryptedWorkspaceSymmetricKey string `json:"encrypted_workspace_symmetric_key" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	AccessToken string `json:"access_token"`
	User        User   `json:"user"`
}

type UserContext struct {
	ID       string
	Username string
	Email    string
	Role     string
	Status   string
}
