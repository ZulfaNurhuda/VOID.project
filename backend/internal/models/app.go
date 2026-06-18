package models

import "time"

type App struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	WorkspaceID   string    `json:"workspace_id"`
	WorkspaceType string    `json:"workspace_type"`
	CreatedBy     string    `json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type CreateAppRequest struct {
	Name          string `json:"name" binding:"required,min=1,max=100"`
	Description   string `json:"description"`
	WorkspaceID   string `json:"workspace_id" binding:"required"`
	WorkspaceType string `json:"workspace_type" binding:"required,oneof=team personal"`
}

type Environment struct {
	ID        string    `json:"id"`
	AppID     string    `json:"app_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Secret struct {
	ID             string    `json:"id"`
	EnvironmentID  string    `json:"environment_id"`
	Key            string    `json:"key"`
	EncryptedValue string    `json:"encrypted_value"`
	CreatedBy      string    `json:"created_by"`
	CreatedByName  string    `json:"created_by_name,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// SecretsListResponse wraps secrets with the encrypted sym key for this user.
// The client uses encrypted_team_symmetric_key to decrypt each secret's value.
type SecretsListResponse struct {
	EncryptedTeamSymmetricKey string   `json:"encrypted_team_symmetric_key"`
	Secrets                   []Secret `json:"secrets"`
}

type CreateSecretRequest struct {
	Key            string `json:"key" binding:"required"`
	EncryptedValue string `json:"encrypted_value" binding:"required"`
}

type UpdateSecretRequest struct {
	EncryptedValue string `json:"encrypted_value" binding:"required"`
}

type ImportSecretsRequest struct {
	Secrets []CreateSecretRequest `json:"secrets" binding:"required,min=1"`
}

type SecretHistoryEntry struct {
	ID                string    `json:"id"`
	SecretID          *string   `json:"secret_id"`
	OldEncryptedValue *string   `json:"old_encrypted_value"`
	NewEncryptedValue *string   `json:"new_encrypted_value"`
	ChangedBy         string    `json:"changed_by"`
	ChangedByName     string    `json:"changed_by_name"`
	Action            string    `json:"action"`
	CreatedAt         time.Time `json:"created_at"`
}
