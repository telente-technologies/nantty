package services

import (
	"context"
	"nantty/modules/live/src/types"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/gift"
)

func (service *LiveService) ListGiftCatalog(ctx context.Context, includeInactive bool) ([]types.LiveGiftView, error) {
	query := service.Client.Gift.Query()
	if !includeInactive {
		query = query.Where(gift.IsActive(true))
	}
	rows, err := query.Order(ent.Asc(gift.FieldSortOrder), ent.Asc(gift.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]types.LiveGiftView, 0, len(rows))
	for _, row := range rows {
		views = append(views, presentGift(row))
	}
	return views, nil
}
