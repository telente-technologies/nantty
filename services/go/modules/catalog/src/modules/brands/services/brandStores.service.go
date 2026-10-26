package services

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	catalogservices "nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/types"
)

func loadStoreSummaries(ctx context.Context, deployed *container.Container, row *ent.Store) (types.StoreSummaryView, error) {
	summaries, err := catalogservices.LoadStoreSummaries(ctx, deployed, []*ent.Store{row})
	return summaries[row.ID], err
}
