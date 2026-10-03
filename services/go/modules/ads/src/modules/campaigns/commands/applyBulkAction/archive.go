package applybulkaction

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/campaigns/services"
	adsservices "zudomart/modules/ads/src/services"
)

func (handler Handler) archive(ctx context.Context, command Command, id uuid.UUID) error {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionCampaignsManage)
	if err != nil {
		return err
	}
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	switch command.Request.Level {
	case "campaign":
		campaign, err := loader.FindCampaign(ctx, account.ID, id)
		if err != nil {
			return err
		}
		return deployed.Client.AdCampaign.UpdateOneID(campaign.ID).SetStatus(adcampaign.StatusCompleted).Exec(ctx)
	case "ad_set":
		group, err := loader.FindAdSet(ctx, account.ID, id)
		if err != nil {
			return err
		}
		return deployed.Client.AdGroup.UpdateOneID(group.ID).SetStatus(adgroup.StatusCompleted).Exec(ctx)
	default:
		row, err := loader.FindAd(ctx, account.ID, id)
		if err != nil {
			return err
		}
		return deployed.Client.Ad.UpdateOneID(row.ID).SetStatus(ad.StatusCompleted).Exec(ctx)
	}
}
