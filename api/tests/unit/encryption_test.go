package unit

import (
	"testing"

	"github.com/kest-labs/kest/api/pkg/encryption"
)

func TestEncryption_EncryptDecrypt(t *testing.T) {
	enc := encryption.New("my-secret-key")

	plaintext := "Hello, World!"
	ciphertext, err := enc.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt() error: %v", err)
	}

	if ciphertext == plaintext {
		t.Error("Ciphertext should not equal plaintext")
	}

	decrypted, err := enc.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("Decrypt() error: %v", err)
	}

	if decrypted != plaintext {
		t.Errorf("Expected '%s', got '%s'", plaintext, decrypted)
	}
}

func TestEncryption_DifferentNonce(t *testing.T) {
	enc := encryption.New("my-secret-key")
	plaintext := "Same message"

	cipher1, _ := enc.Encrypt(plaintext)
	cipher2, _ := enc.Encrypt(plaintext)

	if cipher1 == cipher2 {
		t.Error("Same plaintext should produce different ciphertext (different nonce)")
	}
}

func TestEncryption_WrongKey(t *testing.T) {
	enc1 := encryption.New("key1")
	enc2 := encryption.New("key2")

	ciphertext, _ := enc1.Encrypt("secret")
	_, err := enc2.Decrypt(ciphertext)

	if err == nil {
		t.Error("Decryption with wrong key should fail")
	}
}

func TestEncryption_EmptyString(t *testing.T) {
	enc := encryption.New("key")

	ciphertext, err := enc.Encrypt("")
	if err != nil {
		t.Fatalf("Encrypt empty string error: %v", err)
	}

	decrypted, err := enc.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("Decrypt empty string error: %v", err)
	}

	if decrypted != "" {
		t.Errorf("Expected empty string, got '%s'", decrypted)
	}
}

func TestEncryption_LongString(t *testing.T) {
	enc := encryption.New("key")

	// 10KB of data
	plaintext := ""
	for i := 0; i < 10000; i++ {
		plaintext += "a"
	}

	ciphertext, err := enc.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt long string error: %v", err)
	}

	decrypted, err := enc.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("Decrypt long string error: %v", err)
	}

	if decrypted != plaintext {
		t.Error("Decrypted text doesn't match original")
	}
}

func TestEncryption_EncryptBytes(t *testing.T) {
	enc := encryption.New("key")

	data := []byte{0x00, 0x01, 0x02, 0xFF, 0xFE}
	encrypted, err := enc.EncryptBytes(data)
	if err != nil {
		t.Fatalf("EncryptBytes() error: %v", err)
	}

	decrypted, err := enc.DecryptBytes(encrypted)
	if err != nil {
		t.Fatalf("DecryptBytes() error: %v", err)
	}

	if len(decrypted) != len(data) {
		t.Errorf("Length mismatch: expected %d, got %d", len(data), len(decrypted))
	}

	for i, b := range data {
		if decrypted[i] != b {
			t.Errorf("Byte %d mismatch: expected %x, got %x", i, b, decrypted[i])
		}
	}
}

func TestEncryption_HashPassword(t *testing.T) {
	password := "mysecretpassword"

	hash, err := encryption.HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error: %v", err)
	}

	if hash == password {
		t.Error("Hash should not equal password")
	}

	// Same password should produce different hashes (salt)
	hash2, _ := encryption.HashPassword(password)
	if hash == hash2 {
		t.Error("Same password should produce different hashes")
	}
}

func TestEncryption_CheckPassword(t *testing.T) {
	password := "mysecretpassword"
	hash, _ := encryption.HashPassword(password)

	if !encryption.CheckPassword(password, hash) {
		t.Error("CheckPassword should return true for correct password")
	}

	if encryption.CheckPassword("wrongpassword", hash) {
		t.Error("CheckPassword should return false for wrong password")
	}
}

func TestEncryption_SHA256(t *testing.T) {
	hash := encryption.SHA256("hello")

	// Known SHA-256 hash of "hello"
	expected := "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
	if hash != expected {
		t.Errorf("Expected %s, got %s", expected, hash)
	}
}

func TestEncryption_RandomBytes(t *testing.T) {
	bytes1, err := encryption.RandomBytes(32)
	if err != nil {
		t.Fatalf("RandomBytes() error: %v", err)
	}

	if len(bytes1) != 32 {
		t.Errorf("Expected 32 bytes, got %d", len(bytes1))
	}

	bytes2, _ := encryption.RandomBytes(32)
	if string(bytes1) == string(bytes2) {
		t.Error("Random bytes should be different each time")
	}
}

func TestEncryption_RandomString(t *testing.T) {
	str1, err := encryption.RandomString(16)
	if err != nil {
		t.Fatalf("RandomString() error: %v", err)
	}

	if len(str1) != 16 {
		t.Errorf("Expected length 16, got %d", len(str1))
	}

	str2, _ := encryption.RandomString(16)
	if str1 == str2 {
		t.Error("Random strings should be different")
	}
}

func TestEncryption_GenerateKey(t *testing.T) {
	key, err := encryption.GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey() error: %v", err)
	}

	if len(key) != 32 {
		t.Errorf("Expected 32 bytes, got %d", len(key))
	}
}

func TestEncryption_GenerateKeyString(t *testing.T) {
	keyStr, err := encryption.GenerateKeyString()
	if err != nil {
		t.Fatalf("GenerateKeyString() error: %v", err)
	}

	if len(keyStr) != 64 { // 32 bytes = 64 hex chars
		t.Errorf("Expected 64 chars, got %d", len(keyStr))
	}
}

func TestEncryption_PackageFunctions(t *testing.T) {
	encryption.SetKey("test-key")

	ciphertext, err := encryption.Encrypt("secret")
	if err != nil {
		t.Fatalf("Encrypt() error: %v", err)
	}

	decrypted, err := encryption.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("Decrypt() error: %v", err)
	}

	if decrypted != "secret" {
		t.Errorf("Expected 'secret', got '%s'", decrypted)
	}
}

func TestEncryption_NewFromBytes(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}

	enc, err := encryption.NewFromBytes(key)
	if err != nil {
		t.Fatalf("NewFromBytes() error: %v", err)
	}

	ciphertext, _ := enc.Encrypt("test")
	decrypted, _ := enc.Decrypt(ciphertext)

	if decrypted != "test" {
		t.Error("Encryption/decryption failed")
	}
}

func TestEncryption_NewFromBytesInvalidLength(t *testing.T) {
	_, err := encryption.NewFromBytes([]byte("short"))
	if err == nil {
		t.Error("Expected error for invalid key length")
	}
}

func TestEncryption_DecryptInvalidBase64(t *testing.T) {
	enc := encryption.New("key")
	_, err := enc.Decrypt("not-valid-base64!!!")
	if err == nil {
		t.Error("Expected error for invalid base64")
	}
}

func TestEncryption_DecryptTooShort(t *testing.T) {
	enc := encryption.New("key")
	// Valid base64 but too short to contain nonce
	_, err := enc.Decrypt("YWJj") // "abc" in base64
	if err == nil {
		t.Error("Expected error for ciphertext too short")
	}
}
