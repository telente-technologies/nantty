package services

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/databases/schema"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

func additionsFixture() (ReportData, uuid.UUID, uuid.UUID) {
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
	data := ReportData{Currency: "NGN", From: monday.Truncate(24 * time.Hour), To: monday.AddDate(0, 0, 13).Truncate(24 * time.Hour), Groups: groups, Items: items, Now: monday,
		FirstOrderAt: map[uuid.UUID]time.Time{loyal: monday.AddDate(0, -2, 0), fresh: monday.AddDate(0, 0, 7)}}
	return data, category, loyal
}

func TestSalesByLocationGroupsSalesByShippingState(t *testing.T) {
	data, _, _ := additionsFixture()
	result, _ := BuildReport("sales-by-location", data)
	if len(result.Rows) != 2 || result.Rows[0]["group"] != "Ogun" || result.Rows[0]["share"] != int64(7_500) || result.Rows[1]["orders"] != 1 {
		t.Fatalf("rows: %+v", result.Rows)
	}
}

func TestTaxReportSplitsRatesExemptAndIncludedTax(t *testing.T) {
	data, category, _ := additionsFixture()
	data.Tax = &commerceports.StoreTaxSettings{PricesIncludeTax: true, Rates: []commerceports.StoreTaxRate{{Name: "VAT", RateBasisPoints: 750, CategoryIds: []uuid.UUID{category}}}}
	result, _ := BuildReport("tax", data)
	vat, exempt := result.Rows[0], result.Rows[1]
	if vat["taxName"] != "VAT" || vat["taxCollected"].(money.Money).AmountMinor != 697 || vat["taxableSales"].(money.Money).AmountMinor != 9_303 {
		t.Fatalf("vat row: %+v", vat)
	}
	if exempt["grossSales"].(money.Money).AmountMinor != 30_000 || exempt["taxCollected"].(money.Money).AmountMinor != 0 || len(result.Rows) != 2 {
		t.Fatalf("exempt row: %+v (%d rows)", exempt, len(result.Rows))
	}
}

func TestFulfilmentTimeIsWeeklyWithTheShareShippedWithin48Hours(t *testing.T) {
	data, _, _ := additionsFixture()
	result, _ := BuildReport("order-fulfilment-time", data)
	if len(result.Rows) != 2 || result.Rows[0]["week"] != "2026-09-28" || result.Rows[0]["averageHoursToShip"] != 20.0 || result.Rows[0]["averageHoursToDeliver"] != 24.0 {
		t.Fatalf("first week: %+v", result.Rows)
	}
	if result.Rows[0]["shippedWithin48Hours"] != int64(10_000) || result.Rows[1]["shippedWithin48Hours"] != int64(0) || result.Rows[1]["averageHoursToDeliver"] != nil {
		t.Fatalf("second week: %+v", result.Rows[1])
	}
}

func TestNewVersusReturningUsesTheFirstEverOrder(t *testing.T) {
	data, _, _ := additionsFixture()
	result, _ := BuildReport("customers-new-vs-returning", data)
	if result.Rows[0]["returningCustomers"] != 1 || result.Rows[0]["newCustomers"] != 0 || result.Rows[1]["newCustomers"] != 1 || result.Rows[1]["returningShare"] != int64(0) {
		t.Fatalf("rows: %+v", result.Rows)
	}
}

func TestStockReportsValueStockAndSuggestReorders(t *testing.T) {
	data, _, _ := additionsFixture()
	product, variant, archived, location := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	cost := money.Money{AmountMinor: 1_000, Currency: "NGN"}
	stock := storeStock{
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
	valuation := inventoryValuation(data, stock, nil)
	if len(valuation.Rows) != 1 || valuation.Rows[0]["costValue"].(money.Money).AmountMinor != 4_000 || valuation.Rows[0]["potentialProfit"].(money.Money).AmountMinor != 6_000 || valuation.Rows[0]["location"] != "Main" {
		t.Fatalf("valuation: %+v", valuation.Rows)
	}
	other := uuid.New()
	if filtered := inventoryValuation(data, stock, &other); len(filtered.Rows) != 0 {
		t.Fatalf("another location has no rows: %+v", filtered.Rows)
	}
	low := lowStock(data, stock, nil)
	if len(low.Rows) != 1 || low.Rows[0]["available"] != 2 || low.Rows[0]["suggestedReorder"] != 4 || low.Rows[0]["reorderCost"].(money.Money).AmountMinor != 4_000 || low.Rows[0]["status"] != "Low stock" {
		t.Fatalf("low stock: %+v", low.Rows)
	}
	slow := slowSellers(data, stock, map[uuid.UUID]string{product: "Fashion"})
	if len(slow.Rows) != 1 || slow.Rows[0]["category"] != "Fashion" || slow.Rows[0]["stockValue"].(money.Money).AmountMinor != 4_000 {
		t.Fatalf("slow sellers: %+v", slow.Rows)
	}
}
