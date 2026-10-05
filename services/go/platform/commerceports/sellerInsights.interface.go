package commerceports

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type LowStockRow struct {
	ProductId     uuid.UUID
	VariantId     uuid.UUID
	LocationId    uuid.UUID
	ProductName   string
	VariantTitle  string
	Sku           string
	ImageUrl      string
	Available     int
	LowStockLevel int
}

type StockAlertSummary struct {
	Rows               []LowStockRow
	LowStockCount      int
	OutOfStockCount    int
	AvailableByProduct map[uuid.UUID]int
}

type StoreStockAlertsReader interface {
	StockAlertsForStore(ctx context.Context, storeId uuid.UUID, locationId *uuid.UUID, limit int) (StockAlertSummary, error)
}

type CatalogCounts struct {
	TotalProducts  int
	ActiveProducts int
	DraftProducts  int
}

type ProductCard struct {
	ProductId    uuid.UUID
	Name         string
	ImageUrl     string
	CategoryName string
	Active       bool
}

type DailyTraffic struct {
	Day          string
	StoreViews   int
	ProductViews int
	Visitors     int
}

type StoreInsightsReader interface {
	CatalogCountsForStore(ctx context.Context, storeId uuid.UUID) (CatalogCounts, error)
	DailyTrafficForStore(ctx context.Context, storeId uuid.UUID, from, until time.Time) ([]DailyTraffic, error)
	ProductViewsForStore(ctx context.Context, storeId uuid.UUID, from, until time.Time) (map[uuid.UUID]int, error)
	DescribeStoreProducts(ctx context.Context, storeId uuid.UUID, onlyActive bool) (map[uuid.UUID]ProductCard, error)
}
