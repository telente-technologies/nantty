package listinventorymovements

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/predicate"
	"nantty/modules/inventory/src/generated/ent/stockmovement"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
	"nantty/modules/inventory/src/utils"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.InventoryMovementView], error) {
	empty := httpserver.CursorPage[types.InventoryMovementView]{}
	conditions := []predicate.StockMovement{stockmovement.StoreID(query.StoreId)}
	if query.LocationId != nil {
		conditions = append(conditions, stockmovement.LocationID(*query.LocationId))
	}
	if query.VariantId != nil {
		conditions = append(conditions, stockmovement.VariantID(*query.VariantId))
	}
	if query.Kind != "" {
		conditions = append(conditions, stockmovement.Kind(query.Kind))
	}
	if query.From != nil {
		conditions = append(conditions, stockmovement.CreatedAtGTE(*query.From))
	}
	if query.To != nil {
		conditions = append(conditions, stockmovement.CreatedAtLT(query.To.AddDate(0, 0, 1)))
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
		conditions = append(conditions, stockmovement.Or(stockmovement.VariantIDIn(matches...), stockmovement.ReferenceContainsFold(query.Text)))
	}
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return empty, err
	}
	if after != nil {
		conditions = append(conditions, stockmovement.IDLT(*after))
	}
	rows, err := handler.Container.Client.StockMovement.Query().Where(conditions...).Order(ent.Desc(stockmovement.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	descriptions, err := services.DescribeVariantsOfStore(ctx, query.StoreId, services.UniqueVariantIds(rows, func(row *ent.StockMovement) uuid.UUID { return row.VariantID }))
	if err != nil {
		return empty, err
	}
	return utils.PageFromOverfetchedRows(rows, query.Limit,
		func(row *ent.StockMovement) types.InventoryMovementView {
			return services.MovementView(row, descriptions[row.VariantID])
		},
		func(row *ent.StockMovement) string { return utils.IdentifierCursor(row.ID) }), nil
}
