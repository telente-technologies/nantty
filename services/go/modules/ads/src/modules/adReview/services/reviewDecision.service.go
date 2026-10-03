package services

import (
	"context"
	"time"

	"zudomart/modules/ads/src/events"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adboost"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	campaignservices "zudomart/modules/ads/src/modules/campaigns/services"
)

type Reviewer struct {
	Name string
}

func ApproveInTransaction(ctx context.Context, tx *ent.Tx, review ReviewContext, reviewer Reviewer, reason string, now time.Time) error {
	if err := tx.Ad.UpdateOneID(review.Ad.ID).SetReviewStatus(ad.ReviewStatusApproved).SetStatus(ad.StatusActive).SetPolicyCode("").SetPolicyReason(reason).SetReviewedAt(now).SetReviewedByName(reviewer.Name).Exec(ctx); err != nil {
		return err
	}
	if err := campaignservices.RecomputeParentStatusesInTransaction(ctx, tx, review.Campaign.ID); err != nil {
		return err
	}
	if review.IsBoost() {
		if err := startBoostInTransaction(ctx, tx, review, now); err != nil {
			return err
		}
	}
	return emitReviewed(ctx, tx, review, "approved", "", reviewer, now)
}

func RejectInTransaction(ctx context.Context, tx *ent.Tx, review ReviewContext, reviewer Reviewer, policyCode, reason string, now time.Time) error {
	update := tx.Ad.UpdateOneID(review.Ad.ID).SetReviewStatus(ad.ReviewStatusRejected).SetStatus(ad.StatusRejected).SetPolicyCode(policyCode).SetPolicyReason(reason).SetReviewedAt(now).SetReviewedByName(reviewer.Name).ClearAppealStatus().SetAppealMessage("")
	if err := update.Exec(ctx); err != nil {
		return err
	}
	if err := tx.AdAccount.UpdateOneID(review.Account.ID).AddViolationCount(1).SetLastViolationAt(now).Exec(ctx); err != nil {
		return err
	}
	if err := campaignservices.RecomputeParentStatusesInTransaction(ctx, tx, review.Campaign.ID); err != nil {
		return err
	}
	if review.IsBoost() {
		if err := refundBoostToAdBalance(ctx, tx, review); err != nil {
			return err
		}
		if err := tx.AdBoost.Update().Where(adboost.CampaignID(review.Campaign.ID)).SetStatus(adboost.StatusRejected).SetRejectionReason(reason).Exec(ctx); err != nil {
			return err
		}
	}
	return emitReviewed(ctx, tx, review, "rejected", policyCode, reviewer, now)
}

func startBoostInTransaction(ctx context.Context, tx *ent.Tx, review ReviewContext, now time.Time) error {
	boost, err := tx.AdBoost.Query().Where(adboost.CampaignID(review.Campaign.ID)).Only(ctx)
	if err != nil {
		return err
	}
	end := now.AddDate(0, 0, boost.DurationDays)
	if err := tx.AdBoost.UpdateOneID(boost.ID).SetStatus(adboost.StatusActive).SetStartsAt(now).SetEndsAt(end).Exec(ctx); err != nil {
		return err
	}
	if err := tx.AdCampaign.UpdateOneID(review.Campaign.ID).SetStartAt(now).SetEndAt(end).SetStatus(adcampaign.StatusActive).Exec(ctx); err != nil {
		return err
	}
	return tx.AdGroup.UpdateOneID(review.Group.ID).SetStartAt(now).SetEndAt(end).SetStatus(adgroup.StatusActive).Exec(ctx)
}

func refundBoostToAdBalance(ctx context.Context, tx *ent.Tx, review ReviewContext) error {
	boost, err := tx.AdBoost.Query().Where(adboost.CampaignID(review.Campaign.ID)).Only(ctx)
	if err != nil || boost.Status != adboost.StatusInReview {
		return err
	}
	if err := tx.AdAccount.UpdateOneID(review.Account.ID).AddBalanceMinor(boost.TotalBudgetMinor).Exec(ctx); err != nil {
		return err
	}
	return tx.AdFundsTransaction.Create().SetAccountID(review.Account.ID).SetType("refund").SetAmountMinor(boost.TotalBudgetMinor).SetCurrency(boost.Currency).SetDescription("Boost not approved").SetReference("boostRefund:" + boost.ID.String()).Exec(ctx)
}

func emitReviewed(ctx context.Context, tx *ent.Tx, review ReviewContext, decision, policyCode string, reviewer Reviewer, now time.Time) error {
	return events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdReviewed, review.Ad.ID.String(), now, events.AdReviewedEventData{
		AdId: review.Ad.ID.String(), AccountId: review.Account.ID.String(), Decision: decision, PolicyCode: policyCode, ReviewerName: reviewer.Name,
	})
}
