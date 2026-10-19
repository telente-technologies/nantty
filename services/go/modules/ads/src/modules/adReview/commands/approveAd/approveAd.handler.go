package approvead

import (
	"context"

	"zudomart/modules/ads/src/constants"
	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adaccount"
	"zudomart/modules/ads/src/modules/adReview/dtos"
	"zudomart/modules/ads/src/modules/adReview/services"
	campaignservices "zudomart/modules/ads/src/modules/campaigns/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.AdForReview, error) {
	deployed := handler.Container
	review, err := services.LoadReviewContext(ctx, deployed.Client, command.AdId)
	if err != nil {
		return dtos.AdForReview{}, err
	}
	if review.Ad.ReviewStatus != ad.ReviewStatusPending {
		return dtos.AdForReview{}, adserrors.AdAlreadyReviewed
	}
	if review.Account.Status == adaccount.StatusDisabled {
		return dtos.AdForReview{}, adserrors.AdvertiserSuspended
	}
	if campaignservices.HasCriticalFlag(review.Ad.AutoCheckFlags) && !command.OverrideCriticalFlags {
		return dtos.AdForReview{}, adserrors.CriticalFlagUnresolved
	}
	advertiser := adsservices.AdvertiserIdentity{OwnerUserId: review.Account.OwnerUserID.String(), StoreId: review.Account.StoreID}
	if err := adsservices.VerifyCreativeOwnership(ctx, deployed.Ownership, advertiser, review.Ad.Creative.Input, "creative"); err != nil {
		return dtos.AdForReview{}, err
	}
	if command.AdCategory != "" && !constants.IsKnownAdCategory(command.AdCategory) {
		return dtos.AdForReview{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "adCategory", Message: "Choose a known ad category."}})
	}
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if command.AdCategory != "" {
			if err := tx.Ad.UpdateOneID(review.Ad.ID).SetAdCategory(command.AdCategory).Exec(ctx); err != nil {
				return err
			}
		}
		return services.ApproveInTransaction(ctx, tx, review, command.Reviewer, command.Reason, deployed.Now())
	})
	if err != nil {
		return dtos.AdForReview{}, err
	}
	return handler.reload(ctx, command)
}

func (handler Handler) reload(ctx context.Context, command Command) (dtos.AdForReview, error) {
	review, err := services.LoadReviewContext(ctx, handler.Container.Client, command.AdId)
	if err != nil {
		return dtos.AdForReview{}, err
	}
	return services.PresentAdForReview(review.Ad, review.Account, review.Campaign, review.Group, review.IsBoost()), nil
}
