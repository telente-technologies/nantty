package getadforreview

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/adReview/dtos"
	"zudomart/modules/ads/src/modules/adReview/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.AdForReview, error) {
	review, err := services.LoadReviewContext(ctx, handler.Container.Client, query.AdId)
	if err != nil {
		return dtos.AdForReview{}, err
	}
	return services.PresentAdForReview(review.Ad, review.Account, review.Campaign, review.Group, review.IsBoost()), nil
}
