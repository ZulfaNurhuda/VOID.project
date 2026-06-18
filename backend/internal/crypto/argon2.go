package crypto

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	argonTime    = 2
	argonMemory  = 65540
	argonThreads = 1
	argonKeyLen  = 32
	saltLen      = 16
)

// HashPassword hashes a plaintext password using Argon2id.
// Returns a string in format: base64(salt):base64(hash)
func HashPassword(password string) (string, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}

	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	return base64.RawStdEncoding.EncodeToString(salt) + ":" +
		base64.RawStdEncoding.EncodeToString(hash), nil
}

// VerifyPassword checks a plaintext password against a stored hash.
func VerifyPassword(password, stored string) (bool, error) {
	parts := strings.SplitN(stored, ":", 2)
	if len(parts) != 2 {
		return false, fmt.Errorf("invalid stored hash format")
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[0])
	if err != nil {
		return false, fmt.Errorf("decode salt: %w", err)
	}

	expected, err := base64.RawStdEncoding.DecodeString(parts[1])
	if err != nil {
		return false, fmt.Errorf("decode hash: %w", err)
	}

	actual := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return subtle.ConstantTimeCompare(actual, expected) == 1, nil
}

// DeriveKey derives a 32-byte key from a password + salt using Argon2id.
func DeriveKey(password string, salt []byte) []byte {
	return argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
}
