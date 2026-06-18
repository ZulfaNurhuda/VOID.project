package crypto

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
)

// JWTManager holds the RSA key pair for JWT signing/verification.
type JWTManager struct {
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
}

// Claims is the JWT payload for VOID access tokens.
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	gojwt.RegisteredClaims
}

// NewJWTManager loads an RSA-2048 key from JWT_PRIVATE_KEY env var (PEM).
// Falls back to generating an ephemeral key if the env var is not set (dev only).
func NewJWTManager() (*JWTManager, error) {
	pemData := os.Getenv("JWT_PRIVATE_KEY")
	if pemData != "" {
		return loadFromPEM([]byte(pemData))
	}

	// Dev fallback: generate ephemeral key (sessions lost on restart)
	fmt.Fprintln(os.Stderr, "warning: JWT_PRIVATE_KEY not set — generating ephemeral key (sessions will be lost on restart)")
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, fmt.Errorf("generate RSA key: %w", err)
	}
	return &JWTManager{privateKey: privateKey, publicKey: &privateKey.PublicKey}, nil
}

func loadFromPEM(pemData []byte) (*JWTManager, error) {
	block, _ := pem.Decode(pemData)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block from JWT_PRIVATE_KEY")
	}

	privateKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse RSA private key: %w", err)
	}

	return &JWTManager{privateKey: privateKey, publicKey: &privateKey.PublicKey}, nil
}

// IssueAccessToken creates a signed RS256 JWT access token valid for 15 minutes.
func (m *JWTManager) IssueAccessToken(userID, email string) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: gojwt.RegisteredClaims{
			IssuedAt:  gojwt.NewNumericDate(time.Now()),
			ExpiresAt: gojwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			Issuer:    "void",
		},
	}

	token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, claims)
	signed, err := token.SignedString(m.privateKey)
	if err != nil {
		return "", fmt.Errorf("sign access token: %w", err)
	}
	return signed, nil
}

// VerifyAccessToken parses and validates a JWT access token.
func (m *JWTManager) VerifyAccessToken(tokenStr string) (*Claims, error) {
	token, err := gojwt.ParseWithClaims(tokenStr, &Claims{}, func(t *gojwt.Token) (any, error) {
		if _, ok := t.Method.(*gojwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return m.publicKey, nil
	})
	if err != nil {
		return nil, fmt.Errorf("parse token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}
