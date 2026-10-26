package listinventorylocationsummaries

import (
	"context"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/stocklocation"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
	"nantty/platform/httpserver"
	"nantty/platform/money"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.InventoryLocationSummaryView], error) {
	empty := httpserver.CursorPage[types.InventoryLocationSummaryView]{}
	locations, err := handler.Container.Client.StockLocation.Query().Where(stocklocation.StoreID(query.StoreId)).
		Order(ent.Desc(stocklocation.FieldIsDefault), ent.Asc(stocklocation.FieldName)).All(ctx)
	if err != nil {
		return empty, err
	}
	_, aggregates, err := services.AggregateListedStock(ctx, handler.Container, query.StoreId, nil)
	if err != nil {
		return empty, err
	}
	views := make([]types.InventoryLocationSummaryView, 0, len(locations))
	for _, location := range locations {
		aggregate := aggregates[location.ID]
		view := types.InventoryLocationSummaryView{
			LocationId: location.ID.String(), Name: location.Name, Kind: location.Kind, City: location.City, IsDefault: location.IsDefault,
			Active: location.Active, StockValue: money.Money{Currency: money.CurrencyCode(query.Currency)},
		}
		if aggregate != nil {
			view.SkuCount, view.OnHand, view.Reserved = len(aggregate.Variants), aggregate.OnHand, aggregate.Reserved
			view.LowStockCount = aggregate.LowStockCount + aggregate.OutOfStockCount
			view.StockValue.AmountMinor = aggregate.StockValueMinor
		}
		views = append(views, view)
	}
	return httpserver.NewCursorPage(views, ""), nil
}
