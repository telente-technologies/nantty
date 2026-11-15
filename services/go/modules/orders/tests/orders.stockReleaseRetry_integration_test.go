package orders_test

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/services"
	"nantty/platform/commerceports"
)

type releaseRecordingStock struct {
	commerceports.InventoryStock
	mutex    sync.Mutex
	failing  bool
	released []string
}

func (stock *releaseRecordingStock) Release(_ context.Context, reference string) error {
	stock.mutex.Lock()
	defer stock.mutex.Unlock()
	if stock.failing {
		return errors.New("inventory unavailable")
	}
	stock.released = append(stock.released, reference)
	return nil
}

func TestCancelledOrderStockIsReleasedByTheSweepWhenTheFirstReleaseFails(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	stock := &releaseRecordingStock{failing: true}
	commerceports.Default.RegisterInventoryStock(stock)
	t.Cleanup(func() { commerceports.Default.RegisterInventoryStock(nil) })
	groupId := seedGroup(t, module, uuid.New(), "pending", "pending", true)
	if _, err := services.CancelOrderGroup(ctx, module.Container, services.CancelRequest{OrderId: groupId, Reason: "buyer changed mind", Actor: services.SystemActor}); err != nil {
		t.Fatalf("a committed cancel must not fail because inventory is down: %v", err)
	}
	if group := module.Container.Client.OrderGroup.GetX(ctx, groupId); group.Status != "cancelled" || !group.StockReserved {
		t.Fatalf("the reservation stays flagged until it is really released: %+v", group)
	}
	if _, err := services.ReleaseStockOfClosedOrders(ctx, module.Container, 10); err == nil {
		t.Fatal("the sweep reports the failure while inventory is still down")
	}
	stock.failing = false
	if released, err := services.ReleaseStockOfClosedOrders(ctx, module.Container, 10); err != nil || released != 1 {
		t.Fatalf("the sweep releases the stuck reservation: %d %v", released, err)
	}
	if again, err := services.ReleaseStockOfClosedOrders(ctx, module.Container, 10); err != nil || again != 0 || len(stock.released) != 1 || stock.released[0] != groupId.String() {
		t.Fatalf("released exactly once: again=%d err=%v released=%v", again, err, stock.released)
	}
}
