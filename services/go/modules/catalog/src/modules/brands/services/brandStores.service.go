package services

import (
	"context"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent"
	catalogservices "zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
)

func loadStoreSummaries(ctx context.Context, deployed *container.Container, row *ent.Store) (types.StoreSummaryView, error) {
	summaries, err := catalogservices.LoadStoreSummaries(ctx, deployed, []*ent.Store{row})
	return summaries[row.ID], err
}
