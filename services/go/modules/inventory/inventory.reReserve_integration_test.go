package inventory

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/inventory/src/generated/ent/stocklevel"
	"zudomart/modules/inventory/src/services"
	"zudomart/platform/commerceports"
)

func TestReReserveAfterExpiryHoldsStockAgainAndShipsOnce(t *testing.T) {
	module := startInventoryAgainstFreshSchema(t)
	ctx := context.Background()
	storeId := uuid.New()
	variantId, locations := provisionStock(t, module, storeId, 5)
	reservations := services.ReservationService{Container: module.Container}
	lines := []commerceports.StockLine{{VariantId: variantId, StoreId: storeId, Quantity: 4}}
	if err := reservations.Reserve(ctx, commerceports.ReserveStockRequest{Reference: "order-paid-late", ExpiresAt: time.Now().Add(-time.Minute), Lines: lines}); err != nil {
		t.Fatal(err)
	}
	if expired, err := reservations.ExpireDueReservations(ctx, 10); err != nil || expired != 1 {
		t.Fatalf("expired=%d err=%v, want 1", expired, err)
	}
	if err := reservations.Confirm(ctx, "order-paid-late"); err == nil {
		t.Fatal("confirming an expired reservation must report it lost")
	}
	if err := reservations.Reserve(ctx, commerceports.ReserveStockRequest{Reference: "order-paid-late", Lines: lines}); err != nil {
		t.Fatalf("re-reserve after expiry: %v", err)
	}
	level := module.Container.Client.StockLevel.Query().Where(stocklevel.VariantID(variantId), stocklevel.LocationID(locations[0])).OnlyX(ctx)
	if level.Reserved != 4 {
		t.Fatalf("reserved after re-reserve = %d, want 4", level.Reserved)
	}
	if err := reservations.Confirm(ctx, "order-paid-late"); err != nil {
		t.Fatalf("confirm after re-reserve: %v", err)
	}
	for repeat := 0; repeat < 2; repeat++ {
		if err := reservations.Fulfil(ctx, commerceports.FulfilStockRequest{Reference: "order-paid-late", StoreId: storeId, ActorName: "seller"}); err != nil {
			t.Fatalf("fulfil %d: %v", repeat, err)
		}
	}
	level = module.Container.Client.StockLevel.Query().Where(stocklevel.VariantID(variantId), stocklevel.LocationID(locations[0])).OnlyX(ctx)
	if level.OnHand != 1 || level.Reserved != 0 {
		t.Fatalf("after shipping onHand=%d reserved=%d, want 1 and 0", level.OnHand, level.Reserved)
	}
	if err := reservations.Reserve(ctx, commerceports.ReserveStockRequest{Reference: "order-paid-late", Lines: lines}); err == nil {
		t.Fatal("re-reserving a shipped order must be refused")
	}
}

func TestReReserveAfterExpiryReportsShortageWhenUnitsWereSold(t *testing.T) {
	module := startInventoryAgainstFreshSchema(t)
	ctx := context.Background()
	storeId := uuid.New()
	variantId, _ := provisionStock(t, module, storeId, 5)
	reservations := services.ReservationService{Container: module.Container}
	lines := []commerceports.StockLine{{VariantId: variantId, StoreId: storeId, Quantity: 4}}
	if err := reservations.Reserve(ctx, commerceports.ReserveStockRequest{Reference: "slow-payer", ExpiresAt: time.Now().Add(-time.Minute), Lines: lines}); err != nil {
		t.Fatal(err)
	}
	if _, err := reservations.ExpireDueReservations(ctx, 10); err != nil {
		t.Fatal(err)
	}
	if err := reservations.Reserve(ctx, commerceports.ReserveStockRequest{Reference: "fast-payer", Lines: []commerceports.StockLine{{VariantId: variantId, StoreId: storeId, Quantity: 3}}}); err != nil {
		t.Fatal(err)
	}
	err := reservations.Reserve(ctx, commerceports.ReserveStockRequest{Reference: "slow-payer", Lines: lines})
	var shortage commerceports.InsufficientStockError
	if !asInsufficient(err, &shortage) {
		t.Fatalf("re-reserve without stock returned %v, want InsufficientStockError", err)
	}
	level := module.Container.Client.StockLevel.Query().Where(stocklevel.VariantID(variantId)).OnlyX(ctx)
	if level.Reserved != 3 {
		t.Fatalf("reserved = %d, want 3", level.Reserved)
	}
}
