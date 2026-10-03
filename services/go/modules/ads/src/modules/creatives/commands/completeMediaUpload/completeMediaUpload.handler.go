package completemediaupload

import (
	"context"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/events"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/admedia"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/creatives/dtos"
	adsservices "zudomart/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.CompletedUpload, error) {
	deployed := handler.Container
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionCampaignsManage); err != nil {
		return dtos.CompletedUpload{}, err
	}
	media, err := deployed.Client.AdMedia.Query().Where(admedia.ID(command.MediaId), admedia.AccountID(command.AccountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.CompletedUpload{}, adserrors.MediaNotFound
	}
	if err != nil {
		return dtos.CompletedUpload{}, err
	}
	if media.Status != admedia.StatusPendingUpload {
		return dtos.CompletedUpload{MediaId: media.ID.String(), Status: string(media.Status)}, nil
	}
	if deployed.Storage == nil {
		return dtos.CompletedUpload{}, adserrors.StorageUnavailable
	}
	exists, size, err := deployed.Storage.Exists(ctx, media.ObjectKey)
	if err != nil {
		return dtos.CompletedUpload{}, adserrors.StorageUnavailable
	}
	if !exists || size != media.SizeBytes {
		return dtos.CompletedUpload{}, adserrors.UploadIncomplete
	}
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.AdMedia.UpdateOne(media).SetStatus(admedia.StatusProcessing).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdMediaUploaded, media.ID.String(), deployed.Now(), events.AdMediaUploadedEventData{
			MediaId: media.ID.String(), AccountId: media.AccountID.String(), ObjectKey: media.ObjectKey, MimeType: media.MimeType, Kind: string(media.Kind), SizeBytes: media.SizeBytes,
		})
	})
	return dtos.CompletedUpload{MediaId: media.ID.String(), Status: "processing"}, err
}
