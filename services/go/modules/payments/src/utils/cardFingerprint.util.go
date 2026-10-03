package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

func HashSavedCardFingerprint(key, providerFingerprint, brand, last4 string, expiryMonth, expiryYear int) string {
	material := "fp:" + providerFingerprint
	if providerFingerprint == "" {
		material = fmt.Sprintf("card:%s:%s:%02d:%04d", strings.ToLower(brand), last4, expiryMonth, expiryYear)
	}
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(material))
	return hex.EncodeToString(mac.Sum(nil))
}
