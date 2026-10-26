package deletecampaign

import (
	"context"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/ad"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/generated/ent/adgroup"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/campaigns/services"
	adsservices "nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionCampaignsManage)
	if err != nil {
		return err
	}
	campaign, err := (services.Loader{Client: deployed.Client, Now: deployed.Now}).FindCampaign(ctx, account.ID, command.CampaignId)
	if err != nil {
		return err
	}
	if campaign.Status != adcampaign.StatusDraft {
		return adserrors.OnlyDraftsCanBeDeleted
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.Ad.Delete().Where(ad.CampaignID(campaign.ID)).Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.AdGroup.Delete().Where(adgroup.CampaignID(campaign.ID)).Exec(ctx); err != nil {
			return err
		}
		if err := tx.AdCampaign.DeleteOneID(campaign.ID).Exec(ctx); err != nil {
			return err
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "campaign", campaign.ID.String(), actor, "Deleted draft campaign "+campaign.Name, nil)
	})
}
