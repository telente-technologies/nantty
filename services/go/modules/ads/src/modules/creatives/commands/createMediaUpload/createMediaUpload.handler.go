package createmediaupload

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent/admedia"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/creatives/dtos"
	"zudomart/modules/ads/src/modules/creatives/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

type Handler struct{ Container *container.Container }

// Execute reserves a media row and returns a presigned S3 PUT; the browser uploads straight to S3.
func (handler Handler) Execute(ctx context.Context, command Command) (dtos.MediaUploadIntent, error) {
	deployed, request := handler.Container, command.Request
	kind, extension, supported := services.MediaKindForMimeType(request.MimeType)
	fileName := services.SafeFileName(request.FileName)
	switch {
	case fileName == "" || fileName == ".":
		return dtos.MediaUploadIntent{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "fileName", Message: "Send the file name."}})
	case !supported:
		return dtos.MediaUploadIntent{}, adserrors.MediaTypeNotSupported
	case request.SizeBytes < 1:
		return dtos.MediaUploadIntent{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "sizeBytes", Message: "The file is empty."}})
	case request.SizeBytes > services.MaximumMediaBytes:
		return dtos.MediaUploadIntent{}, adserrors.MediaTooLarge
	}
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionCampaignsManage)
	if err != nil {
		return dtos.MediaUploadIntent{}, err
	}
	if deployed.Storage == nil {
		return dtos.MediaUploadIntent{}, adserrors.StorageUnavailable
	}
	mediaId, err := uuid.NewV7()
	if err != nil {
		return dtos.MediaUploadIntent{}, err
	}
	objectKey := services.ObjectKeyForMedia(account.ID, mediaId, extension)
	create := deployed.Client.AdMedia.Create().SetID(mediaId).SetAccountID(account.ID).SetUploadedBy(command.UserId).SetFileName(fileName).SetMimeType(request.MimeType).
		SetSizeBytes(request.SizeBytes).SetKind(admedia.Kind(kind)).SetObjectKey(objectKey)
	if hints := request.ClientMetadata; hints != nil && hints.Width > 0 && hints.Height > 0 && hints.Width <= 20_000 && hints.Height <= 20_000 {
		create.SetWidth(hints.Width).SetHeight(hints.Height)
	}
	if err := create.Exec(ctx); err != nil {
		return dtos.MediaUploadIntent{}, err
	}
	ticket, err := deployed.Storage.PresignUpload(ctx, objectKey, request.MimeType, request.SizeBytes, deployed.Settings.UploadUrlLifetime)
	if err != nil {
		return dtos.MediaUploadIntent{}, adserrors.StorageUnavailable
	}
	return dtos.MediaUploadIntent{MediaId: mediaId.String(), UploadUrl: ticket.Url, UploadHeaders: ticket.Headers, ExpiresAt: deployed.Now().Add(deployed.Settings.UploadUrlLifetime).UTC().Format(time.RFC3339)}, nil
}
