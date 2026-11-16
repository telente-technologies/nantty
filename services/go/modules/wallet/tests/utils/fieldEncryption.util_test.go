package utils_test

import (
	"bytes"
	"errors"
	"testing"

	"nantty/modules/wallet/src/utils"
)

func TestFieldEncryptionRoundTripsAndBindsAssociatedData(t *testing.T) {
	encryptor, err := utils.NewFieldEncryptor(bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatal(err)
	}
	ciphertext, err := encryptor.Encrypt("0123456789", "user-1")
	if err != nil || bytes.Contains(ciphertext, []byte("0123456789")) {
		t.Fatalf("encrypt: %v", err)
	}
	if plaintext, err := encryptor.Decrypt(ciphertext, "user-1"); err != nil || plaintext != "0123456789" {
		t.Fatalf("decrypt = %q %v", plaintext, err)
	}
	if _, err := encryptor.Decrypt(ciphertext, "user-2"); !errors.Is(err, utils.ErrUndecryptableField) {
		t.Fatal("ciphertext moved to another owner must not decrypt")
	}
	tampered := append([]byte{}, ciphertext...)
	tampered[len(tampered)-1] ^= 1
	if _, err := encryptor.Decrypt(tampered, "user-1"); !errors.Is(err, utils.ErrUndecryptableField) {
		t.Fatal("tampered ciphertext decrypted")
	}
	second, _ := encryptor.Encrypt("0123456789", "user-1")
	if bytes.Equal(ciphertext, second) {
		t.Fatal("encryption is not randomised")
	}
	if encryptor.Fingerprint("0123456789") != encryptor.Fingerprint("0123456789") || encryptor.Fingerprint("0123456789") == encryptor.Fingerprint("0123456780") {
		t.Fatal("fingerprints must be deterministic and distinct")
	}
	if _, err := utils.NewFieldEncryptor([]byte("short")); err == nil {
		t.Fatal("short key accepted")
	}
}
