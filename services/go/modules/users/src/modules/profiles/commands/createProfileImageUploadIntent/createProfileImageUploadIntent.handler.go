package createprofileimageuploadintent

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	extension, allowed := services.AllowedImageContentTypes[command.ContentType]
	if !allowed {
		return Result{}, usersErrors.Unprocessable("Upload a JPEG, PNG or WebP image.")
	}
	if command.SizeBytes <= 0 || command.SizeBytes > services.MaximumProfileImageBytes {
		return Result{}, usersErrors.Unprocessable("Images can be at most 5 MB.")
	}
	settings := handler.Container.Settings
	key := services.MediaKeyPrefixFor(command.AccountId, command.Purpose) + uuid.NewString() + "." + extension
	expiresAt := handler.Container.Now().Add(settings.MediaUploadIntentTimeToLive)
	signature := services.SignUploadAuthorization(settings.MediaUploadSigningKey, key, command.ContentType, services.MaximumProfileImageBytes, expiresAt)
	query := url.Values{"expires": {strconv.FormatInt(expiresAt.Unix(), 10)}, "maxBytes": {strconv.Itoa(services.MaximumProfileImageBytes)}, "signature": {signature}}
	return Result{
		MediaId: key, UploadUrl: strings.TrimRight(settings.MediaUploadBaseUrl, "/") + "/" + key + "?" + query.Encode(),
		Method: "PUT", Headers: map[string]string{"Content-Type": command.ContentType}, PublicUrl: services.PublicUrlForMediaKey(handler.Container, key),
		ExpiresAt: expiresAt.UTC().Format(time.RFC3339), MaximumSize: services.MaximumProfileImageBytes, Placeholder: true,
	}, nil
}
