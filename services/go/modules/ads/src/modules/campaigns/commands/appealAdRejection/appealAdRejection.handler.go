package appealadrejection

import (
	"context"
	"strings"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/ad"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/campaigns/dtos"
	"nantty/modules/ads/src/modules/campaigns/services"
	adsservices "nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.Ad, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionCampaignsManage)
	if err != nil {
		return dtos.Ad{}, err
	}
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	row, err := loader.FindAd(ctx, account.ID, command.AdId)
	if err != nil {
		return dtos.Ad{}, err
	}
	if row.ReviewStatus != ad.ReviewStatusRejected {
		return dtos.Ad{}, adserrors.NotRejected
	}
	if row.AppealStatus != nil {
		return dtos.Ad{}, adserrors.AlreadyAppealed
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.Ad.UpdateOneID(row.ID).SetAppealStatus(ad.AppealStatusPending).SetAppealMessage(strings.TrimSpace(command.Message)).SetAppealSubmittedAt(deployed.Now()).Exec(ctx); err != nil {
			return err
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "ad", row.ID.String(), actor, "Appealed the rejection of "+row.Name, nil)
	})
	if err != nil {
		return dtos.Ad{}, err
	}
	saved, err := loader.FindAd(ctx, account.ID, row.ID)
	if err != nil {
		return dtos.Ad{}, err
	}
	presented, err := loader.PresentAds(ctx, account, []*ent.Ad{saved}, loader.Window(account, "", ""))
	return presented[0], err
}
