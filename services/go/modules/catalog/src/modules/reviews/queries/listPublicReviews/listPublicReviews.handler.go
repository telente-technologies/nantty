package listpublicreviews

import (
	"context"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/predicate"
	"zudomart/modules/catalog/src/generated/ent/review"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
	"zudomart/modules/catalog/src/utils"
)

type Handler struct {
	Container *container.Container
}

type Page struct {
	Average    float64                  `json:"average"`
	Count      int                      `json:"count"`
	Reviews    []types.PublicReviewView `json:"reviews"`
	NextCursor *string                  `json:"nextCursor"`
}

func (handler Handler) Execute(ctx context.Context, query Query) (Page, error) {
	conditions := []predicate.Review{review.StatusNEQ(enums.ReviewHidden)}
	if query.ProductId != nil {
		conditions = append(conditions, review.ProductID(*query.ProductId))
	} else {
		conditions = append(conditions, review.StoreID(*query.StoreId), review.Kind(enums.ReviewKindStore))
	}
	count, err := handler.Container.Client.Review.Query().Where(conditions...).Count(ctx)
	if err != nil {
		return Page{}, err
	}
	ratings, err := handler.Container.Client.Review.Query().Where(conditions...).Select(review.FieldRating).Ints(ctx)
	if err != nil {
		return Page{}, err
	}
	average := 0.0
	for _, rating := range ratings {
		average += float64(rating)
	}
	if count > 0 {
		average /= float64(count)
	}
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return Page{}, err
	}
	if after != nil {
		conditions = append(conditions, review.IDLT(*after))
	}
	rows, err := handler.Container.Client.Review.Query().Where(conditions...).Order(ent.Desc(review.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return Page{}, err
	}
	page := Page{Average: average, Count: count}
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		cursor := utils.IdentifierCursor(rows[len(rows)-1].ID)
		page.NextCursor = &cursor
	}
	page.Reviews = services.PublicReviewViews(ctx, handler.Container, rows)
	return page, nil
}
