package liststockadjustments

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/predicate"
	"nantty/modules/inventory/src/generated/ent/stockadjustment"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
	"nantty/modules/inventory/src/utils"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.StockAdjustmentView], error) {
	empty := httpserver.CursorPage[types.StockAdjustmentView]{}
	conditions := []predicate.StockAdjustment{stockadjustment.StoreID(query.StoreId)}
	if query.LocationId != nil {
		conditions = append(conditions, stockadjustment.LocationID(*query.LocationId))
	}
	if query.Reason != "" {
		conditions = append(conditions, stockadjustment.Reason(query.Reason))
	}
	if query.Text != "" {
		catalog, err := commerceports.Default.CatalogReader()
		if err != nil {
			return empty, err
		}
		matches, err := catalog.SearchStoreVariantIds(ctx, query.StoreId, query.Text, 500)
		if err != nil {
			return empty, err
		}
		conditions = append(conditions, stockadjustment.VariantIDIn(matches...))
	}
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return empty, err
	}
	if after != nil {
		conditions = append(conditions, stockadjustment.IDLT(*after))
	}
	rows, err := handler.Container.Client.StockAdjustment.Query().Where(conditions...).Order(ent.Desc(stockadjustment.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	descriptions, err := services.DescribeVariantsOfStore(ctx, query.StoreId, services.UniqueVariantIds(rows, func(row *ent.StockAdjustment) uuid.UUID { return row.VariantID }))
	if err != nil {
		return empty, err
	}
	return utils.PageFromOverfetchedRows(rows, query.Limit,
		func(row *ent.StockAdjustment) types.StockAdjustmentView {
			return services.AdjustmentView(row, descriptions[row.VariantID])
		},
		func(row *ent.StockAdjustment) string { return utils.IdentifierCursor(row.ID) }), nil
}
