package changeboostdelivery

import (
	"context"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/ad"
	"nantty/modules/ads/src/generated/ent/adboost"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/generated/ent/adgroup"
	"nantty/modules/ads/src/modules/boosts/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	now := handler.Container.Now()
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		boost, err := services.LoadOwnedBoostForUpdate(ctx, tx, command.BoostId, command.UserId)
		if err != nil {
			return err
		}
		from, to := adboost.StatusActive, adboost.StatusPaused
		if command.Action == ActionResume {
			from, to = adboost.StatusPaused, adboost.StatusActive
		}
		if boost.Status == to {
			return nil
		}
		if boost.Status != from {
			return adserrors.BoostStatusChange
		}
		if boost.EndsAt != nil && !boost.EndsAt.After(now) {
			return adserrors.BoostEnded
		}
		if err := tx.AdBoost.UpdateOneID(boost.ID).SetStatus(to).Exec(ctx); err != nil {
			return err
		}
		delivery := string(to)
		if err := tx.Ad.Update().Where(ad.CampaignID(boost.CampaignID), ad.ReviewStatusEQ(ad.ReviewStatusApproved), ad.StatusIn(ad.StatusActive, ad.StatusPaused)).SetStatus(ad.Status(delivery)).Exec(ctx); err != nil {
			return err
		}
		if err := tx.AdGroup.Update().Where(adgroup.CampaignID(boost.CampaignID), adgroup.StatusIn(adgroup.StatusActive, adgroup.StatusPaused)).SetStatus(adgroup.Status(delivery)).Exec(ctx); err != nil {
			return err
		}
		return tx.AdCampaign.Update().Where(adcampaign.ID(boost.CampaignID), adcampaign.StatusIn(adcampaign.StatusActive, adcampaign.StatusPaused)).SetStatus(adcampaign.Status(delivery)).Exec(ctx)
	})
}
