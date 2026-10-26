package listreordersuggestions

import (
	"context"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/predicate"
	"nantty/modules/inventory/src/generated/ent/stocklevel"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
	"nantty/modules/inventory/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/money"
)

type Handler struct {
	Container *container.Container
}

func SuggestedReorderQuantity(available, reorderPoint, reorderQuantity int) int {
	shortfall := reorderPoint - available + 1
	return max(reorderQuantity, shortfall)
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.ReorderSuggestionView], error) {
	empty := httpserver.CursorPage[types.ReorderSuggestionView]{}
	conditions := []predicate.StockLevel{stocklevel.StoreID(query.StoreId), stocklevel.LocationID(query.LocationId), stocklevel.Listed(true),
		predicate.StockLevel(func(selector *sql.Selector) { selector.Where(sql.ExprP("on_hand - reserved <= reorder_point")) })}
	if after, err := utils.DecodeIdentifierCursor(query.Cursor); err != nil {
		return empty, err
	} else if after != nil {
		conditions = append(conditions, stocklevel.IDLT(*after))
	}
	rows, err := handler.Container.Client.StockLevel.Query().Where(conditions...).Order(ent.Desc(stocklevel.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	descriptions, err := services.DescribeVariantsOfStore(ctx, query.StoreId, services.UniqueVariantIds(rows, func(row *ent.StockLevel) uuid.UUID { return row.VariantID }))
	if err != nil {
		return empty, err
	}
	suppliers, err := handler.loadSuppliers(ctx, query.StoreId, descriptions)
	if err != nil {
		return empty, err
	}
	return utils.PageFromOverfetchedRows(rows, query.Limit, func(row *ent.StockLevel) types.ReorderSuggestionView {
		description := descriptions[row.VariantID]
		available := row.OnHand - row.Reserved
		suggested := SuggestedReorderQuantity(available, row.ReorderPoint, row.ReorderQuantity)
		view := types.ReorderSuggestionView{
			VariantId: row.VariantID.String(), ProductId: row.ProductID.String(), ProductName: description.ProductTitle, VariantTitle: description.VariantTitle,
			Sku: description.Sku, LocationId: row.LocationID.String(), Available: available, ReorderPoint: row.ReorderPoint,
			ReorderQuantity: row.ReorderQuantity, SuggestedQuantity: suggested,
		}
		if description.SupplierId != nil {
			view.Supplier = suppliers[*description.SupplierId]
		}
		if description.CostPrice != nil {
			cost := money.Money{AmountMinor: description.CostPrice.AmountMinor * int64(suggested), Currency: description.CostPrice.Currency}
			view.EstimatedCost = &cost
		}
		return view
	}, func(row *ent.StockLevel) string { return utils.IdentifierCursor(row.ID) }), nil
}
