package credentials

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
)

func GenerateOpaqueUrlSafeToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func GenerateSixDigitOneTimeCode() (string, error) {
	number, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", number.Int64()), nil
}

func HashOpaqueTokenForStorage(token string) string {
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:])
}

func HashOneTimeCodeWithPepper(pepper []byte, destination, purpose, code string) string {
	mac := hmac.New(sha256.New, pepper)
	mac.Write([]byte(destination + "\x00" + purpose + "\x00" + code))
	return hex.EncodeToString(mac.Sum(nil))
}

func SealWithAesGcm(key, plaintext []byte) ([]byte, error) {
	aead, err := newAesGcm(key)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return aead.Seal(nonce, nonce, plaintext, nil), nil
}

func OpenWithAesGcm(key, sealed []byte) ([]byte, error) {
	aead, err := newAesGcm(key)
	if err != nil {
		return nil, err
	}
	if len(sealed) < aead.NonceSize() {
		return nil, errors.New("sealed value is too short")
	}
	return aead.Open(nil, sealed[:aead.NonceSize()], sealed[aead.NonceSize():], nil)
}

func newAesGcm(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
