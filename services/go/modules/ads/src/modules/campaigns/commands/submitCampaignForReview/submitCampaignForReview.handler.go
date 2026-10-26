package submitcampaignforreview

import (
	"context"
	"fmt"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/campaigns/dtos"
	"nantty/modules/ads/src/modules/campaigns/services"
	adsservices "nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.Campaign, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionCampaignsManage)
	if err != nil {
		return dtos.Campaign{}, err
	}
	if err := accountservices.RequireActiveAccount(account); err != nil {
		return dtos.Campaign{}, err
	}
	if err := adsservices.RequirePayoutVerified(ctx, deployed.Verification, command.UserId.String()); err != nil {
		return dtos.Campaign{}, err
	}
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	campaign, err := loader.FindCampaign(ctx, account.ID, command.CampaignId)
	if err != nil {
		return dtos.Campaign{}, err
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		submitted, err := services.SubmitAdsForReviewInTransaction(ctx, tx, campaign.ID, deployed.Now())
		if err != nil {
			return err
		}
		if submitted == 0 {
			return adserrors.NothingToSubmit
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "campaign", campaign.ID.String(), actor, fmt.Sprintf("Submitted %d ad(s) for review", submitted), nil)
	})
	if err != nil {
		return dtos.Campaign{}, err
	}
	saved, err := loader.FindCampaign(ctx, account.ID, campaign.ID)
	if err != nil {
		return dtos.Campaign{}, err
	}
	presented, err := loader.PresentCampaigns(ctx, account, []*ent.AdCampaign{saved}, loader.Window(account, "", ""))
	return presented[0], err
}
