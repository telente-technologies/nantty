package confirmboostpayment

import (
	"context"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adboost"
	campaignservices "zudomart/modules/ads/src/modules/campaigns/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deployed := handler.Container
	boost, err := deployed.Client.AdBoost.Get(ctx, command.BoostId)
	if ent.IsNotFound(err) {
		return adserrors.NotFound
	}
	if err != nil {
		return err
	}
	if boost.Status != adboost.StatusPendingPayment {
		return nil
	}
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.AdAccount.UpdateOneID(boost.AccountID).AddBalanceMinor(boost.TotalBudgetMinor).Exec(ctx); err != nil {
			return err
		}
		if err := tx.AdFundsTransaction.Create().SetAccountID(boost.AccountID).SetType("top_up").SetAmountMinor(boost.TotalBudgetMinor).SetCurrency(boost.Currency).SetDescription("Post boost funding").SetReference("boost:" + boost.CampaignID.String()).Exec(ctx); err != nil {
			return err
		}
		if _, err := campaignservices.SubmitAdsForReviewInTransaction(ctx, tx, boost.CampaignID, deployed.Now()); err != nil {
			return err
		}
		return tx.AdBoost.UpdateOneID(boost.ID).SetStatus(adboost.StatusInReview).Exec(ctx)
	})
}
