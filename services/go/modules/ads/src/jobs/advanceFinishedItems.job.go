package jobs

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/ad"
	"nantty/modules/ads/src/generated/ent/adaccountinvite"
	"nantty/modules/ads/src/generated/ent/adboost"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/generated/ent/adgroup"
)

func AdvanceFinishedItemsToCompleted(ctx context.Context, deployed *container.Container) error {
	now := deployed.Now()
	client := deployed.Client
	if err := client.AdCampaign.Update().Where(adcampaign.StatusEQ(adcampaign.StatusActive), adcampaign.EndAtLT(now)).SetStatus(adcampaign.StatusCompleted).Exec(ctx); err != nil {
		return err
	}
	finishedGroups, err := client.AdGroup.Query().Where(adgroup.StatusEQ(adgroup.StatusActive), adgroup.EndAtLT(now)).IDs(ctx)
	if err != nil {
		return err
	}
	if len(finishedGroups) > 0 {
		if err := client.Ad.Update().Where(ad.StatusEQ(ad.StatusActive), ad.AdGroupIDIn(finishedGroups...)).SetStatus(ad.StatusCompleted).Exec(ctx); err != nil {
			return err
		}
		if err := client.AdGroup.Update().Where(adgroup.IDIn(finishedGroups...)).SetStatus(adgroup.StatusCompleted).Exec(ctx); err != nil {
			return err
		}
	}
	finishedPausedCampaigns, err := client.AdBoost.Query().Where(adboost.StatusEQ(adboost.StatusPaused), adboost.EndsAtLT(now)).Select(adboost.FieldCampaignID).Strings(ctx)
	if err != nil {
		return err
	}
	if err := completePausedBoostCampaigns(ctx, client, finishedPausedCampaigns); err != nil {
		return err
	}
	if err := client.AdBoost.Update().Where(adboost.StatusIn(adboost.StatusActive, adboost.StatusPaused), adboost.EndsAtLT(now)).SetStatus(adboost.StatusCompleted).Exec(ctx); err != nil {
		return err
	}
	return client.AdAccountInvite.Update().Where(adaccountinvite.StatusEQ(adaccountinvite.StatusPending), adaccountinvite.ExpiresAtLT(now)).SetStatus(adaccountinvite.StatusExpired).Exec(ctx)
}

func completePausedBoostCampaigns(ctx context.Context, client *ent.Client, campaignIds []string) error {
	ids := make([]uuid.UUID, 0, len(campaignIds))
	for _, raw := range campaignIds {
		if parsed, err := uuid.Parse(raw); err == nil {
			ids = append(ids, parsed)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	if err := client.Ad.Update().Where(ad.CampaignIDIn(ids...), ad.StatusEQ(ad.StatusPaused)).SetStatus(ad.StatusCompleted).Exec(ctx); err != nil {
		return err
	}
	if err := client.AdGroup.Update().Where(adgroup.CampaignIDIn(ids...), adgroup.StatusEQ(adgroup.StatusPaused)).SetStatus(adgroup.StatusCompleted).Exec(ctx); err != nil {
		return err
	}
	return client.AdCampaign.Update().Where(adcampaign.IDIn(ids...), adcampaign.StatusEQ(adcampaign.StatusPaused)).SetStatus(adcampaign.StatusCompleted).Exec(ctx)
}
