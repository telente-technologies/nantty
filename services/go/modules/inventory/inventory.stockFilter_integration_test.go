package inventory

import (
	"context"
	"slices"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/inventory/src/integrations"
	"zudomart/platform/commerceports"
)

func TestProductIdsMatchingStockFiltersByLevelAndLocation(t *testing.T) {
	module := startInventoryAgainstFreshSchema(t)
	ctx := context.Background()
	client := module.Container.Client
	storeId, main, annex := uuid.New(), uuid.New(), uuid.New()
	healthy, low, out := uuid.New(), uuid.New(), uuid.New()
	levels := []struct {
		product, location uuid.UUID
		onHand, reserved  int
	}{{healthy, main, 50, 0}, {low, main, 6, 3}, {out, main, 2, 2}, {healthy, annex, 1, 0}}
	for _, level := range levels {
		if err := client.StockLevel.Create().SetStoreID(storeId).SetProductID(level.product).SetVariantID(uuid.New()).SetLocationID(level.location).
			SetOnHand(level.onHand).SetReserved(level.reserved).SetLowStockLevel(5).Exec(ctx); err != nil {
			t.Fatal(err)
		}
	}
	stock := integrations.CommerceStock{Container: module.Container}
	match := func(filter commerceports.StockFilter) []uuid.UUID {
		found, err := stock.ProductIdsMatchingStock(ctx, storeId, filter)
		if err != nil {
			t.Fatal(err)
		}
		return found
	}
	if found := match(commerceports.StockFilter{Level: "low"}); len(found) != 2 || !slices.Contains(found, low) || !slices.Contains(found, healthy) {
		t.Fatalf("low stock is at or below the threshold per variant: %v", found)
	}
	if found := match(commerceports.StockFilter{Level: "out"}); len(found) != 1 || found[0] != out {
		t.Fatalf("out of stock means nothing available: %v", found)
	}
	if found := match(commerceports.StockFilter{Level: "low", LocationId: &main}); len(found) != 1 || found[0] != low {
		t.Fatalf("location narrows the check: %v", found)
	}
	if found := match(commerceports.StockFilter{LocationId: &annex}); len(found) != 1 || found[0] != healthy {
		t.Fatalf("location alone lists stocked products: %v", found)
	}
	if found, _ := stock.ProductIdsMatchingStock(ctx, uuid.New(), commerceports.StockFilter{Level: "out"}); len(found) != 0 {
		t.Fatalf("other stores never match: %v", found)
	}
}

func TestStoreLocationNamesReaderListsOnlyTheStoresLocations(t *testing.T) {
	module := startInventoryAgainstFreshSchema(t)
	ctx := context.Background()
	storeId := uuid.New()
	mine, err := module.Container.Client.StockLocation.Create().SetStoreID(storeId).SetName("Ikeja Warehouse").SetKind("warehouse").SetCountryCode("NG").Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := module.Container.Client.StockLocation.Create().SetStoreID(uuid.New()).SetName("Elsewhere").SetKind("warehouse").SetCountryCode("NG").Exec(ctx); err != nil {
		t.Fatal(err)
	}
	reader, err := commerceports.Default.StoreLocationNamesReader()
	if err != nil {
		t.Fatal(err)
	}
	names, err := reader.LocationNamesForStore(ctx, storeId)
	if err != nil || len(names) != 1 || names[mine.ID] != "Ikeja Warehouse" {
		t.Fatalf("names: %v %v", names, err)
	}
}
