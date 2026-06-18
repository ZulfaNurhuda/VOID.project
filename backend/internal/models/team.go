package models

import "time"

type Team struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	OwnerID   string    `json:"owner_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TeamMember struct {
	ID                        string    `json:"id"`
	TeamID                    string    `json:"team_id"`
	UserID                    string    `json:"user_id"`
	Username                  string    `json:"username"`
	Email                     string    `json:"email"`
	Role                      string    `json:"role"`
	EncryptedTeamSymmetricKey string    `json:"encrypted_team_symmetric_key,omitempty"`
	CreatedAt                 time.Time `json:"created_at"`
}

type CreateTeamRequest struct {
	Name                      string `json:"name" binding:"required,min=1,max=100"`
	EncryptedTeamSymmetricKey string `json:"encrypted_team_symmetric_key" binding:"required"`
}

type AddMemberRequest struct {
	Username                  string `json:"username" binding:"required,min=1"`
	EncryptedTeamSymmetricKey string `json:"encrypted_team_symmetric_key" binding:"required"`
}

type UpdateRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=admin member"`
}
