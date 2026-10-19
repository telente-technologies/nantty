package services

import (
	"context"
	"time"

	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/events"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adboost"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	boostservices "zudomart/modules/ads/src/modules/boosts/services"
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
	rejected, err := tx.Ad.Update().Where(ad.ID(review.Ad.ID), ad.ReviewStatusEQ(ad.ReviewStatusPending)).SetReviewStatus(ad.ReviewStatusRejected).SetStatus(ad.StatusRejected).
		SetPolicyCode(policyCode).SetPolicyReason(reason).SetReviewedAt(now).SetReviewedByName(reviewer.Name).ClearAppealStatus().SetAppealMessage("").Save(ctx)
	if err != nil {
		return err
	}
	if rejected == 0 {
		return adserrors.AdAlreadyReviewed
	}
	if err := tx.AdAccount.UpdateOneID(review.Account.ID).AddViolationCount(1).SetLastViolationAt(now).Exec(ctx); err != nil {
		return err
	}
	if err := campaignservices.RecomputeParentStatusesInTransaction(ctx, tx, review.Campaign.ID); err != nil {
		return err
	}
	if review.IsBoost() {
		if err := settleRejectedBoostBudget(ctx, tx, review); err != nil {
			return err
		}
		if err := tx.AdBoost.Update().Where(adboost.CampaignID(review.Campaign.ID), adboost.StatusIn(adboost.StatusInReview, adboost.StatusActive, adboost.StatusPaused)).SetStatus(adboost.StatusRejected).SetRejectionReason(reason).Exec(ctx); err != nil {
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
	start := now
	if boost.ScheduledStartAt != nil && boost.ScheduledStartAt.After(now) {
		start = *boost.ScheduledStartAt
	}
	end := start.AddDate(0, 0, boost.DurationDays)
	if err := tx.AdBoost.UpdateOneID(boost.ID).SetStatus(adboost.StatusActive).SetStartsAt(start).SetEndsAt(end).Exec(ctx); err != nil {
		return err
	}
	if err := tx.AdCampaign.UpdateOneID(review.Campaign.ID).SetStartAt(start).SetEndAt(end).SetStatus(adcampaign.StatusActive).Exec(ctx); err != nil {
		return err
	}
	return tx.AdGroup.UpdateOneID(review.Group.ID).SetStartAt(start).SetEndAt(end).SetStatus(adgroup.StatusActive).Exec(ctx)
}

func settleRejectedBoostBudget(ctx context.Context, tx *ent.Tx, review ReviewContext) error {
	boost, err := tx.AdBoost.Query().Where(adboost.CampaignID(review.Campaign.ID)).ForUpdate().Only(ctx)
	if err != nil || (boost.Status != adboost.StatusInReview && boost.Status != adboost.StatusActive && boost.Status != adboost.StatusPaused) {
		return err
	}
	return boostservices.ReleaseFreeBoostBudgetInTransaction(ctx, tx, boost)
}

func emitReviewed(ctx context.Context, tx *ent.Tx, review ReviewContext, decision, policyCode string, reviewer Reviewer, now time.Time) error {
	return events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdReviewed, review.Ad.ID.String(), now, events.AdReviewedEventData{
		AdId: review.Ad.ID.String(), AccountId: review.Account.ID.String(), Decision: decision, PolicyCode: policyCode, ReviewerName: reviewer.Name,
	})
}
