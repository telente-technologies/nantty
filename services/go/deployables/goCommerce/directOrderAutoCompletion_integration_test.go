package main

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"zudomart/modules/orders/src/generated/ent/outboxevent"
	confirmorderreceipt "zudomart/modules/orders/src/modules/orders/commands/confirmOrderReceipt"
	"zudomart/modules/orders/src/services"
)

type directOrderClock struct {
	mutex sync.Mutex
	now   time.Time
}

func (clock *directOrderClock) read() time.Time {
	clock.mutex.Lock()
	defer clock.mutex.Unlock()
	return clock.now
}

func (clock *directOrderClock) set(moment time.Time) {
	clock.mutex.Lock()
	defer clock.mutex.Unlock()
	clock.now = moment
}

func (harness *commerceHarness) deliveredDirectOrder(t *testing.T, deliveredAt time.Time) uuid.UUID {
	t.Helper()
	harness.fillCart(t, 1)
	return harness.deliveredDirectOrderFromCurrentCart(t, deliveredAt)
}

func (harness *commerceHarness) deliveredDirectOrderFromCurrentCart(t *testing.T, deliveredAt time.Time) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	result, err := (services.CheckoutService{Container: harness.orders.Container}).Checkout(ctx, services.CheckoutRequest{BuyerId: harness.buyer, AddressId: harness.addressId, IdempotencyKey: "direct-" + uuid.NewString()})
	if err != nil {
		t.Fatal(err)
	}
	orderId := uuid.MustParse(result.OrderGroups[0].Id)
	if err := services.RecordOrderPaid(ctx, harness.orders.Container, orderId); err != nil {
		t.Fatal(err)
	}
	table := pgx.Identifier{harness.orders.Container.Settings.DatabaseSchema, "order_groups"}.Sanitize()
	if _, err := harness.orders.Container.Database.ExecContext(ctx, "UPDATE "+table+" SET payment_mode = 'direct', status = 'delivered', delivered_at = $2 WHERE id = $1", orderId, deliveredAt); err != nil {
		t.Fatal(err)
	}
	completeAt := deliveredAt.Add(72 * time.Hour)
	if err := services.RecordEscrowReleaseTime(ctx, harness.orders.Container, orderId, &completeAt); err != nil {
		t.Fatal(err)
	}
	return orderId
}

func (harness *commerceHarness) sweepDirectOrders(t *testing.T) int {
	t.Helper()
	completed, err := services.CompleteDirectOrdersPastTheirCompletionTime(context.Background(), harness.orders.Container, 50)
	if err != nil {
		t.Fatal(err)
	}
	return completed
}

func (harness *commerceHarness) completedEvents(orderId uuid.UUID) int {
	return harness.orders.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType("orderGroup.completed"), outboxevent.Subject(orderId.String())).CountX(context.Background())
}

func (harness *commerceHarness) statusOf(orderId uuid.UUID) string {
	return harness.orders.Container.Client.OrderGroup.GetX(context.Background(), orderId).Status
}

func startDirectOrderHarness(t *testing.T) (*commerceHarness, *directOrderClock, time.Time) {
	harness := startCommerce(t)
	deliveredAt := time.Now().UTC().Truncate(time.Second)
	clock := &directOrderClock{now: deliveredAt}
	harness.orders.Container.Now = clock.read
	return harness, clock, deliveredAt
}

func TestDirectOrdersCompleteExactlyThreeDaysAfterDeliveryAndOnlyOnce(t *testing.T) {
	harness, clock, deliveredAt := startDirectOrderHarness(t)
	orderId := harness.deliveredDirectOrder(t, deliveredAt)
	clock.set(deliveredAt.Add(72*time.Hour - time.Second))
	if completed := harness.sweepDirectOrders(t); completed != 0 || harness.statusOf(orderId) != "delivered" {
		t.Fatalf("a second before the window ends nothing completes: %d %s", completed, harness.statusOf(orderId))
	}
	clock.set(deliveredAt.Add(72 * time.Hour))
	var wait sync.WaitGroup
	totals := make(chan int, 4)
	for range 4 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			completed, err := services.CompleteDirectOrdersPastTheirCompletionTime(context.Background(), harness.orders.Container, 50)
			if err != nil {
				t.Error(err)
			}
			totals <- completed
		}()
	}
	wait.Wait()
	close(totals)
	sum := 0
	for completed := range totals {
		sum += completed
	}
	if sum != 1 || harness.statusOf(orderId) != "completed" || harness.completedEvents(orderId) != 1 {
		t.Fatalf("concurrent sweeps complete once with one completed event: %d %s %d", sum, harness.statusOf(orderId), harness.completedEvents(orderId))
	}
	if completed := harness.sweepDirectOrders(t); completed != 0 || harness.completedEvents(orderId) != 1 {
		t.Fatalf("a later sweep does nothing: %d", completed)
	}
}

func TestDirectOrderAutoCompletionWaitsForDisputesReturnsAndRefundRequests(t *testing.T) {
	harness, clock, deliveredAt := startDirectOrderHarness(t)
	ctx := context.Background()
	disputed, returned := harness.deliveredDirectOrder(t, deliveredAt), harness.deliveredDirectOrder(t, deliveredAt)
	if err := services.MarkOrderDisputed(ctx, harness.orders.Container, disputed, true); err != nil {
		t.Fatal(err)
	}
	group := harness.orders.Container.Client.OrderGroup.GetX(ctx, returned)
	request := harness.orders.Container.Client.ReturnRequest.Create().SetOrderGroupID(returned).SetStoreID(group.StoreID).SetBuyerAccountID(group.BuyerAccountID).SetReason("Wrong size").
		SetRefundAmountMinor(100).SetCurrency(group.Currency).SetLines(nil).SaveX(ctx)
	clock.set(deliveredAt.Add(96 * time.Hour))
	if completed := harness.sweepDirectOrders(t); completed != 0 {
		t.Fatalf("an open dispute or return blocks auto-completion: %d", completed)
	}
	if err := services.MarkOrderDisputed(ctx, harness.orders.Container, disputed, false); err != nil {
		t.Fatal(err)
	}
	request.Update().SetStatus("declined").ExecX(ctx)
	if completed := harness.sweepDirectOrders(t); completed != 2 || harness.completedEvents(disputed) != 1 || harness.completedEvents(returned) != 1 {
		t.Fatalf("once the dispute closes and the return is declined both complete on the next run: %d", completed)
	}
	refundRequested := harness.deliveredDirectOrder(t, deliveredAt)
	harness.orders.Container.Client.OrderGroup.UpdateOneID(refundRequested).SetRefundRequestedAt(deliveredAt).ExecX(ctx)
	if completed := harness.sweepDirectOrders(t); completed != 0 || harness.statusOf(refundRequested) != "delivered" {
		t.Fatalf("a refund request blocks auto-completion: %d", completed)
	}
}

func TestBuyerConfirmationCompletesADirectOrderBeforeTheDeadlineAndTheSweepSkipsIt(t *testing.T) {
	harness, clock, deliveredAt := startDirectOrderHarness(t)
	orderId := harness.deliveredDirectOrder(t, deliveredAt)
	clock.set(deliveredAt.Add(time.Hour))
	if _, err := (confirmorderreceipt.Handler{Container: harness.orders.Container}).Execute(context.Background(), confirmorderreceipt.Command{BuyerId: harness.buyer, OrderId: orderId}); err != nil {
		t.Fatal(err)
	}
	if harness.statusOf(orderId) != "completed" || harness.completedEvents(orderId) != 1 {
		t.Fatalf("buyer confirmation completes immediately: %s", harness.statusOf(orderId))
	}
	clock.set(deliveredAt.Add(80 * time.Hour))
	if completed := harness.sweepDirectOrders(t); completed != 0 || harness.completedEvents(orderId) != 1 {
		t.Fatalf("the sweep never completes an order twice: %d", completed)
	}
}

func TestEscrowOrdersAreLeftToTheEscrowRelease(t *testing.T) {
	harness, clock, deliveredAt := startDirectOrderHarness(t)
	orderId := harness.deliveredDirectOrder(t, deliveredAt)
	table := pgx.Identifier{harness.orders.Container.Settings.DatabaseSchema, "order_groups"}.Sanitize()
	if _, err := harness.orders.Container.Database.ExecContext(context.Background(), "UPDATE "+table+" SET payment_mode = 'escrow' WHERE id = $1", orderId); err != nil {
		t.Fatal(err)
	}
	clock.set(deliveredAt.Add(96 * time.Hour))
	if completed := harness.sweepDirectOrders(t); completed != 0 || harness.statusOf(orderId) != "delivered" {
		t.Fatalf("escrow orders complete through escrow.released, not this sweep: %d", completed)
	}
}
