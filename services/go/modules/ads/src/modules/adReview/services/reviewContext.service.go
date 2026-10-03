package services

import (
	"context"

	"github.com/google/uuid"

	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
)

type ReviewContext struct {
	Ad       *ent.Ad
	Account  *ent.AdAccount
	Campaign *ent.AdCampaign
	Group    *ent.AdGroup
}

func LoadReviewContext(ctx context.Context, client *ent.Client, adId uuid.UUID) (ReviewContext, error) {
	row, err := client.Ad.Get(ctx, adId)
	if ent.IsNotFound(err) {
		return ReviewContext{}, adserrors.NotFound
	}
	if err != nil {
		return ReviewContext{}, err
	}
	account, err := client.AdAccount.Get(ctx, row.AccountID)
	if err != nil {
		return ReviewContext{}, err
	}
	campaign, err := client.AdCampaign.Get(ctx, row.CampaignID)
	if err != nil {
		return ReviewContext{}, err
	}
	group, err := client.AdGroup.Get(ctx, row.AdGroupID)
	if err != nil {
		return ReviewContext{}, err
	}
	return ReviewContext{Ad: row, Account: account, Campaign: campaign, Group: group}, nil
}

func (review ReviewContext) IsBoost() bool { return review.Campaign.Kind == "boost" }

func (review ReviewContext) Present() any {
	return PresentAdForReview(review.Ad, review.Account, review.Campaign, review.Group, review.IsBoost())
}
