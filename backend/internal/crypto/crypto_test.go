package crypto_test

import (
	"bytes"
	"testing"

	"github.com/void-project/void-backend/internal/crypto"
)

// ── Argon2id ──────────────────────────────────────────────────────────────────

func TestHashAndVerifyPassword(t *testing.T) {
	hash, err := crypto.HashPassword("my-secure-password")
	if err != nil {
		t.Fatalf("HashPassword error: %v", err)
	}
	if hash == "" {
		t.Fatal("expected non-empty hash")
	}

	ok, err := crypto.VerifyPassword("my-secure-password", hash)
	if err != nil {
		t.Fatalf("VerifyPassword error: %v", err)
	}
	if !ok {
		t.Fatal("expected password to verify successfully")
	}
}

func TestVerifyPassword_WrongPassword(t *testing.T) {
	hash, _ := crypto.HashPassword("correct-password")
	ok, err := crypto.VerifyPassword("wrong-password", hash)
	if err != nil {
		t.Fatalf("VerifyPassword error: %v", err)
	}
	if ok {
		t.Fatal("expected wrong password to fail verification")
	}
}

func TestHashPassword_Unique(t *testing.T) {
	h1, _ := crypto.HashPassword("same-password")
	h2, _ := crypto.HashPassword("same-password")
	if h1 == h2 {
		t.Fatal("expected different hashes for same password (random salt)")
	}
}

// ── ChaCha20-Poly1305 ─────────────────────────────────────────────────────────

func TestEncryptDecrypt(t *testing.T) {
	key, err := crypto.GenerateSymmetricKey()
	if err != nil {
		t.Fatalf("GenerateSymmetricKey: %v", err)
	}

	plaintext := []byte("DATABASE_URL=postgresql://localhost/mydb")

	encrypted, err := crypto.Encrypt(key, plaintext)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	decrypted, err := crypto.Decrypt(key, encrypted)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}

	if !bytes.Equal(plaintext, decrypted) {
		t.Fatalf("decrypted %q != original %q", decrypted, plaintext)
	}
}

func TestEncrypt_Unique(t *testing.T) {
	key, _ := crypto.GenerateSymmetricKey()
	plaintext := []byte("same plaintext")
	e1, _ := crypto.Encrypt(key, plaintext)
	e2, _ := crypto.Encrypt(key, plaintext)
	if e1 == e2 {
		t.Fatal("expected different ciphertexts due to random nonce")
	}
}

func TestDecrypt_WrongKey(t *testing.T) {
	key1, _ := crypto.GenerateSymmetricKey()
	key2, _ := crypto.GenerateSymmetricKey()
	encrypted, _ := crypto.Encrypt(key1, []byte("secret"))
	_, err := crypto.Decrypt(key2, encrypted)
	if err == nil {
		t.Fatal("expected error decrypting with wrong key")
	}
}

// ── X25519 ────────────────────────────────────────────────────────────────────

func TestX25519EncryptDecrypt(t *testing.T) {
	recipientPub, recipientPriv, err := crypto.GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair: %v", err)
	}

	symKey, _ := crypto.GenerateSymmetricKey()
	encrypted, err := crypto.EncryptForRecipient(recipientPub, symKey)
	if err != nil {
		t.Fatalf("EncryptForRecipient: %v", err)
	}

	decrypted, err := crypto.DecryptFromSender(recipientPriv, encrypted)
	if err != nil {
		t.Fatalf("DecryptFromSender: %v", err)
	}

	if !bytes.Equal(symKey, decrypted) {
		t.Fatalf("decrypted key %x != original %x", decrypted, symKey)
	}
}

func TestX25519Decrypt_WrongKey(t *testing.T) {
	recipientPub, _, _ := crypto.GenerateKeyPair()
	_, wrongPriv, _ := crypto.GenerateKeyPair()

	symKey, _ := crypto.GenerateSymmetricKey()
	encrypted, _ := crypto.EncryptForRecipient(recipientPub, symKey)

	_, err := crypto.DecryptFromSender(wrongPriv, encrypted)
	if err == nil {
		t.Fatal("expected error decrypting with wrong private key")
	}
}

// ── DeriveKey ─────────────────────────────────────────────────────────────────

func TestDeriveKey_Deterministic(t *testing.T) {
	salt := make([]byte, 16)
	k1 := crypto.DeriveKey("password", salt)
	k2 := crypto.DeriveKey("password", salt)
	if !bytes.Equal(k1, k2) {
		t.Fatal("DeriveKey should be deterministic with same password+salt")
	}
}

func TestDeriveKey_DifferentSalt(t *testing.T) {
	salt1 := []byte("salt-number-one-!")
	salt2 := []byte("salt-number-two-!")
	k1 := crypto.DeriveKey("password", salt1)
	k2 := crypto.DeriveKey("password", salt2)
	if bytes.Equal(k1, k2) {
		t.Fatal("DeriveKey should produce different keys for different salts")
	}
}

// ── JWT ───────────────────────────────────────────────────────────────────────

func TestJWT_IssueAndVerify(t *testing.T) {
	mgr, err := crypto.NewJWTManager()
	if err != nil {
		t.Fatalf("NewJWTManager: %v", err)
	}

	token, err := mgr.IssueAccessToken("user-uuid-123", "alice@example.com")
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}

	claims, err := mgr.VerifyAccessToken(token)
	if err != nil {
		t.Fatalf("VerifyAccessToken: %v", err)
	}

	if claims.UserID != "user-uuid-123" {
		t.Fatalf("expected user_id 'user-uuid-123', got %q", claims.UserID)
	}
	if claims.Email != "alice@example.com" {
		t.Fatalf("expected email 'alice@example.com', got %q", claims.Email)
	}
}

func TestJWT_InvalidToken(t *testing.T) {
	mgr, _ := crypto.NewJWTManager()
	_, err := mgr.VerifyAccessToken("not.a.valid.jwt")
	if err == nil {
		t.Fatal("expected error for invalid token")
	}
}

func TestJWT_WrongKey(t *testing.T) {
	mgr1, _ := crypto.NewJWTManager()
	mgr2, _ := crypto.NewJWTManager()

	token, _ := mgr1.IssueAccessToken("user-uuid", "x@y.com")
	_, err := mgr2.VerifyAccessToken(token)
	if err == nil {
		t.Fatal("expected error verifying with wrong key")
	}
}
