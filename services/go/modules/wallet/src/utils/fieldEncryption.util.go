package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
)

const fieldEncryptionVersion = byte(1)

var ErrUndecryptableField = errors.New("encrypted field could not be decrypted")

type FieldEncryptor struct {
	key []byte
}

func NewFieldEncryptor(key []byte) (FieldEncryptor, error) {
	if len(key) != 32 {
		return FieldEncryptor{}, errors.New("field encryption key must be 32 bytes")
	}
	return FieldEncryptor{key: key}, nil
}

func (encryptor FieldEncryptor) aead() (cipher.AEAD, error) {
	block, err := aes.NewCipher(encryptor.key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func (encryptor FieldEncryptor) Encrypt(plaintext, associatedData string) ([]byte, error) {
	aead, err := encryptor.aead()
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	sealed := aead.Seal(nil, nonce, []byte(plaintext), []byte(associatedData))
	return append(append([]byte{fieldEncryptionVersion}, nonce...), sealed...), nil
}

func (encryptor FieldEncryptor) Decrypt(ciphertext []byte, associatedData string) (string, error) {
	aead, err := encryptor.aead()
	if err != nil {
		return "", err
	}
	if len(ciphertext) < 1+aead.NonceSize() || ciphertext[0] != fieldEncryptionVersion {
		return "", ErrUndecryptableField
	}
	nonce := ciphertext[1 : 1+aead.NonceSize()]
	plaintext, err := aead.Open(nil, nonce, ciphertext[1+aead.NonceSize():], []byte(associatedData))
	if err != nil {
		return "", ErrUndecryptableField
	}
	return string(plaintext), nil
}

func (encryptor FieldEncryptor) Fingerprint(value string) string {
	mac := hmac.New(sha256.New, encryptor.key)
	mac.Write([]byte("fingerprint:" + value))
	return hex.EncodeToString(mac.Sum(nil))
}
