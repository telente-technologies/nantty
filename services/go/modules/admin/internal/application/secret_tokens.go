package application

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/mail"
	"strings"
	"unicode"
)

func generateOpaqueUrlSafeToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func hashOpaqueTokenForStorage(token string) string {
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:])
}

func NormalizeStaffEmail(raw string) (string, bool) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if len(trimmed) < 3 || len(trimmed) > 254 {
		return "", false
	}
	parsed, err := mail.ParseAddress(trimmed)
	if err != nil || parsed.Address != trimmed || !strings.Contains(trimmed[strings.LastIndex(trimmed, "@"):], ".") {
		return "", false
	}
	return trimmed, true
}

func AssertStaffPasswordMeetsPolicy(password string) error {
	if len(password) < 12 || len(password) > 128 {
		return unprocessable("Staff passwords must be 12-128 characters long.")
	}
	hasLetter, hasDigit := false, false
	for _, character := range password {
		hasLetter = hasLetter || unicode.IsLetter(character)
		hasDigit = hasDigit || unicode.IsDigit(character)
	}
	if !hasLetter || !hasDigit {
		return unprocessable("Staff passwords must contain at least one letter and one number.")
	}
	return nil
}
