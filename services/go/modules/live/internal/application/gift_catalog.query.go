package application

import (
	"context"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/gift"
)

func (application *LiveApplication) ListGiftCatalog(ctx context.Context, includeInactive bool) ([]LiveGiftView, error) {
	query := application.Client.Gift.Query()
	if !includeInactive {
		query = query.Where(gift.IsActive(true))
	}
	rows, err := query.Order(ent.Asc(gift.FieldSortOrder), ent.Asc(gift.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]LiveGiftView, 0, len(rows))
	for _, row := range rows {
		views = append(views, presentGift(row))
	}
	return views, nil
}
