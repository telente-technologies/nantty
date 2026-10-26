package getadforreview

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/adReview/dtos"
	"nantty/modules/ads/src/modules/adReview/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.AdForReviewDetail, error) {
	review, err := services.LoadReviewContext(ctx, handler.Container.Client, query.AdId)
	if err != nil {
		return dtos.AdForReviewDetail{}, err
	}
	presented := services.PresentAdForReview(review.Ad, review.Account, review.Campaign, review.Group, review.IsBoost())
	return dtos.AdForReviewDetail{AdForReview: presented, History: services.ReadHistory(ctx, handler.Container, services.AdAuditSubject, review.Ad.ID.String())}, nil
}
