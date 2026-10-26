package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"net/url"
	"strings"
	"time"
)

const MaximumProfileImageBytes = 5 * 1024 * 1024

var AllowedImageContentTypes = map[string]string{"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

func MediaKeyPrefixFor(accountId, purpose string) string {
	return "users/" + accountId + "/" + purpose + "/"
}

func SignUploadAuthorization(signingKey []byte, key, contentType string, maximumBytes int64, expiresAt time.Time) string {
	mac := hmac.New(sha256.New, signingKey)
	fmt.Fprintf(mac, "PUT\n%s\n%s\n%d\n%d", key, contentType, maximumBytes, expiresAt.Unix())
	return hex.EncodeToString(mac.Sum(nil))
}

func PublicUrlForMediaKey(application *container.Container, key string) string {
	return strings.TrimRight(application.Settings.MediaPublicBaseUrl, "/") + "/" + key
}

func AssertImageUrlIsAllowed(application *container.Container, raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || len(raw) > 500 {
		return usersErrors.Unprocessable("Enter a valid image link.")
	}
	if parsed.Scheme == "https" || (parsed.Scheme == "http" && !application.Settings.IsProduction()) {
		return nil
	}
	return usersErrors.Unprocessable("Image links must use https.")
}
