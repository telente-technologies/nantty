package orders

import (
	"context"
	"encoding/json"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src"
	"zudomart/modules/orders/src/databases/schema"
	"zudomart/modules/orders/src/generated/ent/outboxevent"
	"zudomart/modules/orders/src/interfaces"
	"zudomart/modules/orders/src/services"
	"zudomart/platform/commerceports"
	platformevents "zudomart/platform/events"
	"zudomart/platform/httpserver"
)

type countingMoney struct {
	interfaces.CheckoutMoney
	fulfilments atomic.Int32
}

func (fake *countingMoney) RecordOrderFulfilment(context.Context, interfaces.FulfilmentRecord) (interfaces.EscrowSummary, error) {
	fake.fulfilments.Add(1)
	return interfaces.EscrowSummary{}, nil
}

func seedGroup(t *testing.T, module *src.Module, store uuid.UUID, status, payment string, stockReserved bool) uuid.UUID {
	t.Helper()
	group, err := module.Container.Client.OrderGroup.Create().
		SetCheckoutID(uuid.New()).SetReference("ZM-FE-" + uuid.NewString()[:6]).SetInvoiceNumber("INV-" + uuid.NewString()[:8]).SetStoreID(store).SetSellerAccountID(uuid.New()).
		SetBuyerAccountID(uuid.New()).SetCurrency("NGN").SetSubtotalMinor(300_000).SetShippingMinor(0).SetTotalMinor(300_000).SetStatus(status).SetPaymentStatus(payment).
		SetStockReserved(stockReserved).SetPaymentMode("escrow").SetAddress(schema.AddressSnapshot{RecipientName: "Ada", Phone: "+2348000000000", Line1: "1 Marina", CountryCode: "NG"}).Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return group.ID
}

func countOutbox(t *testing.T, module *src.Module, eventType, subject string) int {
	t.Helper()
	count, err := module.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType(eventType), outboxevent.Subject(subject)).Count(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return count
}

func TestDeliveredIsAnnouncedOnlyAfterTheOrderCommitsAndNeverCallsEscrowFirst(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	money := &countingMoney{}
	module.Container.Money = money
	store := uuid.New()
	seller := services.SellerContext{Store: commerceports.StoreAccess{StoreId: store}, ActorId: uuid.New(), Name: "Temi"}

	notShipped := seedGroup(t, module, store, "new", "paid", false)
	if err := services.UpdateOrderStatus(ctx, module.Container, seller, notShipped, "delivered"); err == nil {
		t.Fatal("a new order cannot jump to delivered")
	}
	if countOutbox(t, module, "orderGroup.delivered", notShipped.String()) != 0 {
		t.Fatal("a refused transition must not announce delivery")
	}

	shipped := seedGroup(t, module, store, "shipped", "paid", false)
	if err := services.UpdateOrderStatus(ctx, module.Container, seller, shipped, "delivered"); err != nil {
		t.Fatal(err)
	}
	if money.fulfilments.Load() != 0 {
		t.Fatal("escrow must never be told about delivery before the order commits")
	}
	if countOutbox(t, module, "orderGroup.delivered", shipped.String()) != 1 {
		t.Fatal("the committed delivery is announced once through the outbox")
	}
	if err := services.UpdateOrderStatus(ctx, module.Container, seller, shipped, "delivered"); err == nil || countOutbox(t, module, "orderGroup.delivered", shipped.String()) != 1 {
		t.Fatalf("a repeated delivered is refused and not announced again: %v", err)
	}

	systemPath := seedGroup(t, module, store, "shipped", "paid", false)
	if err := services.CompleteOrderGroup(ctx, module.Container, systemPath, services.SystemActor, "auto"); err != nil {
		t.Fatal(err)
	}
	if countOutbox(t, module, "orderGroup.delivered", systemPath.String()) != 1 {
		t.Fatal("the system delivered path is announced too")
	}
}

func TestEscrowReleaseScheduleIsShownOnTheOrder(t *testing.T) {
	module := startAgainstFreshSchema(t)
	orderId := seedGroup(t, module, uuid.New(), "delivered", "paid", false)
	releaseAt := time.Now().Add(72 * time.Hour).UTC().Truncate(time.Second)
	data, _ := json.Marshal(map[string]any{"orderId": orderId.String(), "autoReleaseAt": releaseAt})
	body, _ := json.Marshal(platformevents.EventEnvelope{Id: uuid.NewString(), Type: "escrow.releaseScheduled", Data: data})
	if err := (services.MoneyEventHandler{Container: module.Container}).Handle(context.Background(), body); err != nil {
		t.Fatal(err)
	}
	group := module.Container.Client.OrderGroup.GetX(context.Background(), orderId)
	if group.EscrowReleaseAt == nil || !group.EscrowReleaseAt.Equal(releaseAt) {
		t.Fatalf("release time not recorded: %v", group.EscrowReleaseAt)
	}
}

type soldOutStock struct {
	commerceports.InventoryStock
}

func (soldOutStock) Confirm(context.Context, string) error {
	return httpserver.NewApiError(http.StatusConflict, "RESERVATION_NOT_ACTIVE", "expired")
}

func (soldOutStock) Reserve(context.Context, commerceports.ReserveStockRequest) error {
	return commerceports.InsufficientStockError{VariantId: uuid.New(), Requested: 1, Available: 0}
}

func TestPaidOrderWithoutStockIsCancelledAndRefundedExactlyOnce(t *testing.T) {
	module := startAgainstFreshSchema(t)
	commerceports.Default.RegisterInventoryStock(soldOutStock{})
	t.Cleanup(func() { commerceports.Default.RegisterInventoryStock(nil) })
	ctx := context.Background()
	orderId := seedGroup(t, module, uuid.New(), "pending", "pending", true)
	for attempt := 0; attempt < 3; attempt++ {
		if err := services.RecordOrderPaid(ctx, module.Container, orderId); err != nil {
			t.Fatalf("delivery %d of the paid event must be acknowledged, not retried forever: %v", attempt, err)
		}
	}
	group := module.Container.Client.OrderGroup.GetX(ctx, orderId)
	if group.Status != "cancelled" || group.PaymentStatus != "paid" || group.RefundRequestedAt == nil {
		t.Fatalf("paid order without stock: %s/%s", group.Status, group.PaymentStatus)
	}
	if countOutbox(t, module, "orderGroup.refundRequested", orderId.String()) != 1 {
		t.Fatal("exactly one refund is requested through the outbox")
	}
	if countOutbox(t, module, "orderGroup.paid", orderId.String()) != 0 {
		t.Fatal("an order without stock is never announced as paid")
	}
}
