package crypto

import (
	"fmt"

	"github.com/google/uuid"
)

// GenerateUUID generates a new RFC 4122 UUID v4.
func GenerateUUID() (string, error) {
	id, err := uuid.NewRandom()
	if err != nil {
		return "", fmt.Errorf("generate uuid: %w", err)
	}
	return id.String(), nil
}
