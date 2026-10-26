package listadsforreview

import (
	"context"
	"slices"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/ad"
	"nantty/modules/ads/src/generated/ent/predicate"
	"nantty/modules/ads/src/modules/adReview/dtos"
	"nantty/modules/ads/src/modules/adReview/services"
)

type Handler struct{ Container *container.Container }

var statusFilters = map[string]ad.ReviewStatus{"PENDING": ad.ReviewStatusPending, "APPROVED": ad.ReviewStatusApproved, "REJECTED": ad.ReviewStatusRejected}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.PagedList[dtos.AdForReview], error) {
	filters := []predicate.Ad{ad.ReviewStatusNEQ(ad.ReviewStatusNotSubmitted)}
	if status, known := statusFilters[query.Status]; known {
		filters = append(filters, ad.ReviewStatusEQ(status))
	}
	if query.AdvertiserId != nil {
		filters = append(filters, ad.AccountID(*query.AdvertiserId))
	}
	if query.Search != "" {
		filters = append(filters, ad.NameContainsFold(query.Search))
	}
	client := handler.Container.Client
	total, err := client.Ad.Query().Where(filters...).Count(ctx)
	if err != nil {
		return dtos.PagedList[dtos.AdForReview]{}, err
	}
	rows, err := client.Ad.Query().Where(filters...).Order(ent.Asc(ad.FieldSubmittedAt)).Offset((query.Page - 1) * query.PageSize).Limit(query.PageSize).All(ctx)
	if err != nil {
		return dtos.PagedList[dtos.AdForReview]{}, err
	}
	items := make([]dtos.AdForReview, 0, len(rows))
	for _, row := range rows {
		review, err := services.LoadReviewContext(ctx, client, row.ID)
		if err != nil {
			return dtos.PagedList[dtos.AdForReview]{}, err
		}
		items = append(items, services.PresentAdForReview(review.Ad, review.Account, review.Campaign, review.Group, review.IsBoost()))
	}
	slices.SortStableFunc(items, func(left, right dtos.AdForReview) int { return len(right.AutoCheckFlags) - len(left.AutoCheckFlags) })
	return dtos.PagedList[dtos.AdForReview]{Data: items, Page: query.Page, PageSize: query.PageSize, Total: total}, nil
}
