package getinventorysummary

import (
	"context"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
	"nantty/platform/money"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.InventorySummaryView, error) {
	total, _, err := services.AggregateListedStock(ctx, handler.Container, query.StoreId, query.LocationId)
	if err != nil {
		return types.InventorySummaryView{}, err
	}
	currency := money.CurrencyCode(query.Currency)
	view := types.InventorySummaryView{
		SkuCount: len(total.Variants), OnHand: total.OnHand, Reserved: total.Reserved, Available: total.Available,
		LowStockCount: total.LowStockCount, OutOfStockCount: total.OutOfStockCount, NeedsReorderCount: total.NeedsReorderCount,
		StockValue: money.Money{AmountMinor: total.StockValueMinor, Currency: currency}, RetailValue: money.Money{AmountMinor: total.RetailValueMinor, Currency: currency},
	}
	if query.LocationId != nil {
		identifier := query.LocationId.String()
		view.LocationId = &identifier
	}
	return view, nil
}
