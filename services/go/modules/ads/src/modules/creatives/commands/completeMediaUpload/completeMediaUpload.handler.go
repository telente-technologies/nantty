package completemediaupload

import (
	"bytes"
	"context"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/events"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/admedia"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/creatives/dtos"
	adsservices "nantty/modules/ads/src/services"
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
	width, height, probed := probeImageDimensions(ctx, deployed, media)
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if probed {
			return tx.AdMedia.UpdateOne(media).SetStatus(admedia.StatusReady).SetWidth(width).SetHeight(height).Exec(ctx)
		}
		if err := tx.AdMedia.UpdateOne(media).SetStatus(admedia.StatusProcessing).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdMediaUploaded, media.ID.String(), deployed.Now(), events.AdMediaUploadedEventData{
			MediaId: media.ID.String(), AccountId: media.AccountID.String(), ObjectKey: media.ObjectKey, MimeType: media.MimeType, Kind: string(media.Kind), SizeBytes: media.SizeBytes,
		})
	})
	if probed {
		return dtos.CompletedUpload{MediaId: media.ID.String(), Status: "ready"}, err
	}
	return dtos.CompletedUpload{MediaId: media.ID.String(), Status: "processing"}, err
}

const imageHeaderProbeBytes = 512 * 1024

func probeImageDimensions(ctx context.Context, deployed *container.Container, media *ent.AdMedia) (int, int, bool) {
	if media.Kind != admedia.KindImage {
		return 0, 0, false
	}
	header, err := deployed.Storage.ReadPrefix(ctx, media.ObjectKey, imageHeaderProbeBytes)
	if err != nil {
		return 0, 0, false
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(header))
	if err != nil || config.Width < 1 || config.Height < 1 {
		return 0, 0, false
	}
	return config.Width, config.Height, true
}
