package crypto

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/crypto/curve25519"
)

// GenerateKeyPair generates an X25519 key pair.
// Returns (publicKey, privateKey) as 32-byte slices.
func GenerateKeyPair() (publicKey, privateKey []byte, err error) {
	privateKey = make([]byte, curve25519.ScalarSize)
	if _, err = rand.Read(privateKey); err != nil {
		return nil, nil, fmt.Errorf("generate private key: %w", err)
	}

	// Clamp per RFC 7748
	privateKey[0] &= 248
	privateKey[31] &= 127
	privateKey[31] |= 64

	publicKey, err = curve25519.X25519(privateKey, curve25519.Basepoint)
	if err != nil {
		return nil, nil, fmt.Errorf("derive public key: %w", err)
	}

	return publicKey, privateKey, nil
}

// EncryptForRecipient encrypts a symmetric key for a recipient using their X25519 public key.
// Returns "base64(ephemeral_pub):base64(nonce):base64(encrypted_key)"
func EncryptForRecipient(recipientPublicKey, symmetricKey []byte) (string, error) {
	ephemeralPub, ephemeralPriv, err := GenerateKeyPair()
	if err != nil {
		return "", fmt.Errorf("generate ephemeral key: %w", err)
	}

	sharedSecret, err := curve25519.X25519(ephemeralPriv, recipientPublicKey)
	if err != nil {
		return "", fmt.Errorf("compute shared secret: %w", err)
	}

	encrypted, err := Encrypt(sharedSecret, symmetricKey)
	if err != nil {
		return "", fmt.Errorf("encrypt symmetric key: %w", err)
	}

	return base64.RawStdEncoding.EncodeToString(ephemeralPub) + ":" + encrypted, nil
}

// DecryptFromSender decrypts a symmetric key encrypted by EncryptForRecipient.
// encoded format: "base64(ephemeral_pub):base64(nonce):base64(encrypted_key)"
func DecryptFromSender(recipientPrivateKey []byte, encoded string) ([]byte, error) {
	idx := strings.Index(encoded, ":")
	if idx < 0 {
		return nil, fmt.Errorf("invalid encrypted key format")
	}

	ephemeralPubB64 := encoded[:idx]
	nonceCipher := encoded[idx+1:]

	ephemeralPub, err := base64.RawStdEncoding.DecodeString(ephemeralPubB64)
	if err != nil {
		return nil, fmt.Errorf("decode ephemeral public key: %w", err)
	}

	sharedSecret, err := curve25519.X25519(recipientPrivateKey, ephemeralPub)
	if err != nil {
		return nil, fmt.Errorf("compute shared secret: %w", err)
	}

	return Decrypt(sharedSecret, nonceCipher)
}
