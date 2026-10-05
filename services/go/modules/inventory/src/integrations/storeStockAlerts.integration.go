package integrations

import (
	"context"
	"sort"

	"github.com/google/uuid"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/generated/ent/stocklevel"
	"zudomart/platform/commerceports"
)

type StoreStockAlerts struct {
	Container *container.Container
}

func (alerts StoreStockAlerts) StockAlertsForStore(ctx context.Context, storeId uuid.UUID, locationId *uuid.UUID, limit int) (commerceports.StockAlertSummary, error) {
	summary := commerceports.StockAlertSummary{Rows: []commerceports.LowStockRow{}, AvailableByProduct: map[uuid.UUID]int{}}
	query := alerts.Container.Client.StockLevel.Query().Where(stocklevel.StoreID(storeId), stocklevel.Listed(true))
	if locationId != nil {
		query = query.Where(stocklevel.LocationID(*locationId))
	}
	levels, err := query.All(ctx)
	if err != nil || len(levels) == 0 {
		return summary, err
	}
	variantIds := make([]uuid.UUID, 0, len(levels))
	for _, level := range levels {
		variantIds = append(variantIds, level.VariantID)
	}
	catalog, err := commerceports.Default.CatalogReader()
	if err != nil {
		return summary, err
	}
	described, err := catalog.DescribeVariants(ctx, storeId, variantIds)
	if err != nil {
		return summary, err
	}
	for _, level := range levels {
		variant, known := described[level.VariantID]
		if !known || !variant.TracksStock || variant.ProductState == "archived" {
			continue
		}
		available := level.OnHand - level.Reserved
		summary.AvailableByProduct[level.ProductID] += max(available, 0)
		if available > level.LowStockLevel {
			continue
		}
		if available <= 0 {
			summary.OutOfStockCount++
		} else {
			summary.LowStockCount++
		}
		summary.Rows = append(summary.Rows, commerceports.LowStockRow{
			ProductId: level.ProductID, VariantId: level.VariantID, LocationId: level.LocationID, ProductName: variant.ProductTitle, VariantTitle: variant.VariantTitle,
			Sku: variant.Sku, ImageUrl: variant.ImageUrl, Available: available, LowStockLevel: level.LowStockLevel,
		})
	}
	sort.SliceStable(summary.Rows, func(left, right int) bool { return summary.Rows[left].Available < summary.Rows[right].Available })
	if limit > 0 && len(summary.Rows) > limit {
		summary.Rows = summary.Rows[:limit]
	}
	return summary, nil
}
