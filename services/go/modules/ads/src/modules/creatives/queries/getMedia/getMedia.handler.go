package getmedia

import (
	"context"
	"strings"
	"time"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/admedia"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/creatives/dtos"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
)

type Handler struct{ Container *container.Container }

const previewUrlLifetime = 30 * time.Minute

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.UploadedMedia, error) {
	deployed := handler.Container
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionCampaignsView); err != nil {
		return dtos.UploadedMedia{}, err
	}
	media, err := deployed.Client.AdMedia.Query().Where(admedia.ID(query.MediaId), admedia.AccountID(query.AccountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.UploadedMedia{}, adserrors.MediaNotFound
	}
	if err != nil {
		return dtos.UploadedMedia{}, err
	}
	result := dtos.UploadedMedia{MediaId: media.ID.String(), Status: string(media.Status)}
	if media.Status == admedia.StatusReady {
		previewUrl := strings.TrimRight(deployed.Settings.MediaBaseUrl, "/") + "/" + media.ID.String()
		if deployed.Storage != nil {
			if signed, signErr := deployed.Storage.PresignDownload(ctx, media.ObjectKey, previewUrlLifetime); signErr == nil {
				previewUrl = signed
			}
		}
		result.Media = &types.CreativeMedia{
			Id: media.ID.String(), Kind: string(media.Kind), Url: previewUrl,
			Width: media.Width, Height: media.Height, DurationSeconds: media.DurationSeconds,
		}
	}
	return result, nil
}
