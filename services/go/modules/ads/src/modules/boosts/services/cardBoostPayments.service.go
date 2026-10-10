package services

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adboost"
	campaignservices "zudomart/modules/ads/src/modules/campaigns/services"
)

func StartBoostsPaidByTopUp(ctx context.Context, deployed *container.Container, topUpId string) error {
	if topUpId == "" {
		return nil
	}
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		boosts, err := tx.AdBoost.Query().Where(adboost.PaymentTopUpID(topUpId), adboost.StatusEQ(adboost.StatusPendingPayment)).ForUpdate().All(ctx)
		if err != nil {
			return err
		}
		for _, boost := range boosts {
			if _, err := campaignservices.SubmitAdsForReviewInTransaction(ctx, tx, boost.CampaignID, deployed.Now()); err != nil {
				return err
			}
			if err := tx.AdBoost.UpdateOneID(boost.ID).SetStatus(adboost.StatusInReview).Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	})
}
