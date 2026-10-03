package application

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

const maximumProfileImageBytes = 5 * 1024 * 1024

var allowedImageContentTypes = map[string]string{"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

func mediaKeyPrefixFor(accountId, purpose string) string {
	return "users/" + accountId + "/" + purpose + "/"
}

func SignUploadAuthorization(signingKey []byte, key, contentType string, maximumBytes int64, expiresAt time.Time) string {
	mac := hmac.New(sha256.New, signingKey)
	fmt.Fprintf(mac, "PUT\n%s\n%s\n%d\n%d", key, contentType, maximumBytes, expiresAt.Unix())
	return hex.EncodeToString(mac.Sum(nil))
}

func (application *UsersApplication) publicUrlForMediaKey(key string) string {
	return strings.TrimRight(application.Settings.MediaPublicBaseUrl, "/") + "/" + key
}

func (application *UsersApplication) assertImageUrlIsAllowed(raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || len(raw) > 500 {
		return unprocessable("Enter a valid image link.")
	}
	if parsed.Scheme == "https" || (parsed.Scheme == "http" && !application.Settings.IsProduction()) {
		return nil
	}
	return unprocessable("Image links must use https.")
}

type UploadIntentInput struct {
	AccountId   string
	Purpose     string
	ContentType string
	SizeBytes   int64
}

type UploadIntentView struct {
	MediaId     string            `json:"mediaId"`
	UploadUrl   string            `json:"uploadUrl"`
	Method      string            `json:"method"`
	Headers     map[string]string `json:"headers"`
	PublicUrl   string            `json:"publicUrl"`
	ExpiresAt   string            `json:"expiresAt"`
	MaximumSize int64             `json:"maximumSizeBytes"`
	Placeholder bool              `json:"placeholder"`
}

func (application *UsersApplication) CreateProfileImageUploadIntent(ctx context.Context, input UploadIntentInput) (UploadIntentView, error) {
	extension, allowed := allowedImageContentTypes[input.ContentType]
	if !allowed {
		return UploadIntentView{}, unprocessable("Upload a JPEG, PNG or WebP image.")
	}
	if input.SizeBytes <= 0 || input.SizeBytes > maximumProfileImageBytes {
		return UploadIntentView{}, unprocessable("Images can be at most 5 MB.")
	}
	key := mediaKeyPrefixFor(input.AccountId, input.Purpose) + uuid.NewString() + "." + extension
	expiresAt := application.Now().Add(application.Settings.MediaUploadIntentTimeToLive)
	signature := SignUploadAuthorization(application.Settings.MediaUploadSigningKey, key, input.ContentType, maximumProfileImageBytes, expiresAt)
	query := url.Values{"expires": {strconv.FormatInt(expiresAt.Unix(), 10)}, "maxBytes": {strconv.Itoa(maximumProfileImageBytes)}, "signature": {signature}}
	return UploadIntentView{
		MediaId: key, UploadUrl: strings.TrimRight(application.Settings.MediaUploadBaseUrl, "/") + "/" + key + "?" + query.Encode(),
		Method: "PUT", Headers: map[string]string{"Content-Type": input.ContentType}, PublicUrl: application.publicUrlForMediaKey(key),
		ExpiresAt: expiresAt.UTC().Format(time.RFC3339), MaximumSize: maximumProfileImageBytes, Placeholder: true,
	}, nil
}
