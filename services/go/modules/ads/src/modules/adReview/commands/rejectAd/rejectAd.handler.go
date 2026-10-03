package rejectad

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adpolicycategory"
	"zudomart/modules/ads/src/modules/adReview/dtos"
	"zudomart/modules/ads/src/modules/adReview/services"
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
	category, err := handler.findActiveCategory(ctx, command.Request.PolicyCategoryId)
	if err != nil {
		return dtos.AdForReview{}, err
	}
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.AdPolicyCategory.UpdateOneID(category.ID).AddRejectionCount(1).Exec(ctx); err != nil {
			return err
		}
		return services.RejectInTransaction(ctx, tx, review, command.Reviewer, category.Code, strings.TrimSpace(command.Request.Reason), deployed.Now())
	})
	if err != nil {
		return dtos.AdForReview{}, err
	}
	review, err = services.LoadReviewContext(ctx, deployed.Client, command.AdId)
	if err != nil {
		return dtos.AdForReview{}, err
	}
	return services.PresentAdForReview(review.Ad, review.Account, review.Campaign, review.Group, review.IsBoost()), nil
}

func (handler Handler) findActiveCategory(ctx context.Context, identifier string) (*ent.AdPolicyCategory, error) {
	query := handler.Container.Client.AdPolicyCategory.Query().Where(adpolicycategory.IsActive(true))
	if id, err := uuid.Parse(identifier); err == nil {
		query.Where(adpolicycategory.ID(id))
	} else {
		query.Where(adpolicycategory.Code(identifier))
	}
	category, err := query.Only(ctx)
	if ent.IsNotFound(err) {
		return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "policyCategoryId", Message: "Choose an active policy."}})
	}
	return category, err
}
