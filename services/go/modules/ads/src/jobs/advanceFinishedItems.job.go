package jobs

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adaccountinvite"
	"zudomart/modules/ads/src/generated/ent/adboost"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/adgroup"
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
	if err := client.AdBoost.Update().Where(adboost.StatusEQ(adboost.StatusActive), adboost.EndsAtLT(now)).SetStatus(adboost.StatusCompleted).Exec(ctx); err != nil {
		return err
	}
	return client.AdAccountInvite.Update().Where(adaccountinvite.StatusEQ(adaccountinvite.StatusPending), adaccountinvite.ExpiresAtLT(now)).SetStatus(adaccountinvite.StatusExpired).Exec(ctx)
}
