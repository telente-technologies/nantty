package services_test

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/databases/schema"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/services"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

func additionsFixture() (services.ReportData, uuid.UUID, uuid.UUID) {
	monday := time.Date(2026, 9, 28, 9, 0, 0, 0, time.UTC)
	loyal, fresh, category := uuid.New(), uuid.New(), uuid.New()
	shipped, delivered := monday.Add(20*time.Hour), monday.Add(44*time.Hour)
	lateShip := monday.AddDate(0, 0, 7).Add(72 * time.Hour)
	first, second, third := uuid.New(), uuid.New(), uuid.New()
	groups := []*ent.OrderGroup{
		{ID: first, Status: enums.StatusCompleted, PaymentStatus: "paid", SubtotalMinor: 10_000, CreatedAt: monday, ShippedAt: &shipped, DeliveredAt: &delivered,
			BuyerAccountID: loyal, Address: schema.AddressSnapshot{RegionName: "Lagos"}},
		{ID: second, Status: enums.StatusShipped, PaymentStatus: "paid", SubtotalMinor: 30_000, CreatedAt: monday.AddDate(0, 0, 7), ShippedAt: &lateShip,
			BuyerAccountID: fresh, Address: schema.AddressSnapshot{RegionName: "Ogun"}},
		{ID: third, Status: enums.StatusCancelled, PaymentStatus: "paid", SubtotalMinor: 99_000, CreatedAt: monday, BuyerAccountID: fresh, Address: schema.AddressSnapshot{RegionName: "Lagos"}},
	}
	items := map[uuid.UUID][]*ent.OrderItem{
		first:  {{ProductID: uuid.New(), Quantity: 1, LineTotalMinor: 10_000, Taxable: true, CategoryID: &category}},
		second: {{ProductID: uuid.New(), Quantity: 3, LineTotalMinor: 30_000, Taxable: false}},
		third:  {{ProductID: uuid.New(), Quantity: 1, LineTotalMinor: 99_000, Taxable: true}},
	}
	data := services.ReportData{Currency: "NGN", From: monday.Truncate(24 * time.Hour), To: monday.AddDate(0, 0, 13).Truncate(24 * time.Hour), Groups: groups, Items: items, Now: monday,
		FirstOrderAt: map[uuid.UUID]time.Time{loyal: monday.AddDate(0, -2, 0), fresh: monday.AddDate(0, 0, 7)}}
	return data, category, loyal
}

func TestStockReportsValueStockAndSuggestReorders(t *testing.T) {
	data, _, _ := additionsFixture()
	product, variant, archived, location := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	cost := money.Money{AmountMinor: 1_000, Currency: "NGN"}
	stock := services.StoreStock{
		References: []commerceports.VariantReference{{ProductId: product, VariantId: variant}, {ProductId: uuid.New(), VariantId: archived}},
		Variants: map[uuid.UUID]commerceports.VariantDescription{
			variant:  {ProductTitle: "Shirt", VariantTitle: "M", CostPrice: &cost, RetailPrice: money.Money{AmountMinor: 2_500, Currency: "NGN"}, ProductState: "active", TracksStock: true},
			archived: {ProductTitle: "Old", ProductState: "archived", TracksStock: true},
		},
		Levels: map[uuid.UUID][]commerceports.VariantStockLevel{
			variant:  {{LocationId: location, OnHand: 4, Reserved: 2, LowStockLevel: 3}},
			archived: {{LocationId: location, OnHand: 9}},
		},
		Locations: map[uuid.UUID]string{location: "Main"},
	}
	valuation := services.InventoryValuationReport(data, stock, nil)
	if len(valuation.Rows) != 1 || valuation.Rows[0]["costValue"].(money.Money).AmountMinor != 4_000 || valuation.Rows[0]["potentialProfit"].(money.Money).AmountMinor != 6_000 || valuation.Rows[0]["location"] != "Main" {
		t.Fatalf("valuation: %+v", valuation.Rows)
	}
	other := uuid.New()
	if filtered := services.InventoryValuationReport(data, stock, &other); len(filtered.Rows) != 0 {
		t.Fatalf("another location has no rows: %+v", filtered.Rows)
	}
	low := services.LowStockReport(data, stock, nil)
	if len(low.Rows) != 1 || low.Rows[0]["available"] != 2 || low.Rows[0]["suggestedReorder"] != 4 || low.Rows[0]["reorderCost"].(money.Money).AmountMinor != 4_000 || low.Rows[0]["status"] != "Low stock" {
		t.Fatalf("low stock: %+v", low.Rows)
	}
	slow := services.SlowSellersReport(data, stock, map[uuid.UUID]string{product: "Fashion"})
	if len(slow.Rows) != 1 || slow.Rows[0]["category"] != "Fashion" || slow.Rows[0]["stockValue"].(money.Money).AmountMinor != 4_000 {
		t.Fatalf("slow sellers: %+v", slow.Rows)
	}
}
