package duplicatecampaign

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/ad"
	"nantty/modules/ads/src/generated/ent/adgroup"
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
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	source, err := loader.FindCampaign(ctx, account.ID, command.CampaignId)
	if err != nil {
		return dtos.Campaign{}, err
	}
	groups, err := deployed.Client.AdGroup.Query().Where(adgroup.CampaignID(source.ID)).All(ctx)
	if err != nil {
		return dtos.Campaign{}, err
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	var copied *ent.AdCampaign
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		input := services.CampaignInputFromRow(source, account.Currency)
		input.Name = "Copy of " + source.Name
		if len(input.Name) > 120 {
			input.Name = input.Name[:120]
		}
		copied, err = services.ApplyCampaignInput(tx.AdCampaign.Create().SetAccountID(account.ID).SetCreatedByUserID(command.UserId), input).Save(ctx)
		if err != nil {
			return err
		}
		for _, group := range groups {
			newGroup, err := services.ApplyAdSetInput(tx.AdGroup.Create().SetAccountID(account.ID).SetCampaignID(copied.ID), services.AdSetInputFromRow(group, account.Currency)).Save(ctx)
			if err != nil {
				return err
			}
			if err := copyAds(ctx, tx, group, newGroup, copied); err != nil {
				return err
			}
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "campaign", copied.ID.String(), actor, "Duplicated campaign "+source.Name, nil)
	})
	if err != nil {
		return dtos.Campaign{}, err
	}
	presented, err := loader.PresentCampaigns(ctx, account, []*ent.AdCampaign{copied}, loader.Window(account, "", ""))
	return presented[0], err
}

func copyAds(ctx context.Context, tx *ent.Tx, from, to *ent.AdGroup, campaign *ent.AdCampaign) error {
	ads, err := tx.Ad.Query().Where(ad.AdGroupID(from.ID)).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range ads {
		if err := tx.Ad.Create().SetAccountID(row.AccountID).SetCampaignID(campaign.ID).SetAdGroupID(to.ID).SetName(row.Name).SetFormat(row.Format).SetCreative(row.Creative).SetStatus(ad.StatusDraft).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}
