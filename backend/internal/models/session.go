package models

import "time"

type Session struct {
	ID         string    `json:"id"         db:"id"`
	UserID     string    `json:"userId"     db:"user_id"`
	TokenHash  string    `json:"-"          db:"token_hash"`
	DeviceInfo *string   `json:"deviceInfo" db:"device_info"`
	IPAddress  *string   `json:"ipAddress"  db:"ip_address"`
	ExpiresAt  time.Time `json:"expiresAt"  db:"expires_at"`
	CreatedAt  time.Time `json:"createdAt"  db:"created_at"`
	LastUsedAt time.Time `json:"lastUsedAt" db:"last_used_at"`
}
