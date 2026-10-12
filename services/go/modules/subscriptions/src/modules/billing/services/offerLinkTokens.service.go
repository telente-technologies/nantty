package services

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/url"
	"regexp"
)

var offerTokenPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)

func newOfferLinkTokenSalt() (string, error) {
	salt := make([]byte, 32)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	return hex.EncodeToString(salt), nil
}

func (billing Billing) offerLinkTokenFromSalt(salt string) string {
	mac := hmac.New(sha256.New, []byte(billing.Container.Settings.OfferLinkKey))
	mac.Write([]byte("subscription-offer-link:" + salt))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func HashOfferLinkToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func IsWellFormedOfferToken(token string) bool {
	return offerTokenPattern.MatchString(token)
}

func (billing Billing) offerClaimUrl(token string) string {
	return billing.Container.Settings.PublicWebBaseUrl + "/offer/" + url.PathEscape(token)
}
