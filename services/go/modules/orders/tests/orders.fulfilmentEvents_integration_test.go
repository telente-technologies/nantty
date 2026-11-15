package orders_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src"
	"nantty/modules/orders/src/databases/schema"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/outboxevent"
	"nantty/modules/orders/src/generated/ent/processedevent"
	"nantty/modules/orders/src/interfaces"
	"nantty/modules/orders/src/services"
	"nantty/platform/commerceports"
	platformevents "nantty/platform/events"
	"nantty/platform/httpserver"
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

func TestFailedDeliveryAttemptWritesStateTimelineAndSafeOutboxEventTogether(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	store := uuid.New()
	orderId := seedGroup(t, module, store, "shipped", "paid", false)
	seller := services.SellerContext{Store: commerceports.StoreAccess{StoreId: store}, ActorId: uuid.New(), Name: "Temi"}
	note := "Recipient unavailable at pickup point"

	if err := services.RecordFailedDeliveryAttempt(ctx, module.Container, seller, orderId, note); err != nil {
		t.Fatal(err)
	}
	group := module.Container.Client.OrderGroup.GetX(ctx, orderId)
	if group.DeliveryStatus != "failed" || group.DeliveryAttempts != 1 || group.LastAttemptNote == nil || *group.LastAttemptNote != note {
		t.Fatalf("failed attempt state not committed: status=%q attempts=%d note=%v", group.DeliveryStatus, group.DeliveryAttempts, group.LastAttemptNote)
	}
	if countOutbox(t, module, "orderGroup.deliveryAttemptFailed", orderId.String()) != 1 {
		t.Fatal("failed delivery attempt must create one durable notification event")
	}
	event := module.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType("orderGroup.deliveryAttemptFailed"), outboxevent.Subject(orderId.String())).OnlyX(ctx)
	if len(event.Payload) == 0 || strings.Contains(string(event.Payload), note) {
		t.Fatalf("outbox payload must be present and exclude free-form attempt notes: %s", event.Payload)
	}

	notShipped := seedGroup(t, module, store, "new", "paid", false)
	if err := services.RecordFailedDeliveryAttempt(ctx, module.Container, seller, notShipped, note); err == nil {
		t.Fatal("an order that has not shipped cannot create a failed-delivery notification")
	}
	if countOutbox(t, module, "orderGroup.deliveryAttemptFailed", notShipped.String()) != 0 {
		t.Fatal("refused delivery attempt must not create an outbox event")
	}
}

func TestEscrowReleaseScheduleIsShownOnTheOrder(t *testing.T) {
	module := startAgainstFreshSchema(t)
	orderId := seedGroup(t, module, uuid.New(), "delivered", "paid", false)
	releaseAt := time.Now().Add(72 * time.Hour).UTC().Truncate(time.Second)
	data, _ := json.Marshal(map[string]any{"orderId": orderId.String(), "autoReleaseAt": releaseAt})
	body, _ := json.Marshal(platformevents.EventEnvelope{
		Id: uuid.NewString(), Type: "escrow.releaseScheduled", Source: "nantty.escrow", Subject: orderId.String(),
		SchemaVersion: 1, OccurredAt: time.Now().UTC(), Data: data,
	})
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

func TestPaymentEventReceiptCommitsWithOrderPayment(t *testing.T) {
	for _, eventType := range []string{"escrow.held", "directPayment.received"} {
		t.Run(eventType, func(t *testing.T) {
			module := startAgainstFreshSchema(t)
			orderId := seedGroup(t, module, uuid.New(), "pending", "pending", false)
			handler := services.MoneyEventHandler{Container: module.Container}
			body := escrowEnvelope(eventType, orderId, map[string]any{})
			var wait sync.WaitGroup
			errors := make(chan error, 2)
			for range 2 {
				wait.Add(1)
				go func() {
					defer wait.Done()
					errors <- handler.Handle(context.Background(), body)
				}()
			}
			wait.Wait()
			close(errors)
			for err := range errors {
				if err != nil {
					t.Fatal(err)
				}
			}
			group := module.Container.Client.OrderGroup.GetX(context.Background(), orderId)
			if group.Status != "new" || group.PaymentStatus != "paid" {
				t.Fatalf("payment event must commit paid order state, got %s/%s", group.Status, group.PaymentStatus)
			}
			if countOutbox(t, module, "orderGroup.paid", orderId.String()) != 1 {
				t.Fatal("duplicate payment event must emit one paid-order outbox event")
			}
			if receipts := module.Container.Client.ProcessedEvent.Query().Where(processedevent.EventType(eventType)).CountX(context.Background()); receipts != 1 {
				t.Fatalf("duplicate delivery must commit one %s receipt, got %d", eventType, receipts)
			}
		})
	}
}

func TestOrderGroupEventDataCarriesEmailRenderableSnapshot(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	group, err := module.Container.Client.OrderGroup.Create().
		SetCheckoutID(uuid.New()).SetReference("ZM-EM-" + uuid.NewString()[:6]).SetInvoiceNumber("INV-" + uuid.NewString()[:8]).SetStoreID(uuid.New()).
		SetSellerAccountID(uuid.New()).SetSellerName("Glow by Zainab").SetBuyerAccountID(uuid.New()).SetBuyerName("Amaka O.").
		SetCurrency("NGN").SetSubtotalMinor(170_000).SetShippingMinor(15_000).SetTotalMinor(185_000).SetStatus("new").SetPaymentStatus("paid").
		SetPaymentMode("escrow").SetAddress(schema.AddressSnapshot{RecipientName: "Amaka", Phone: "+2348000000000", Line1: "1 Marina", CountryCode: "NG"}).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := module.Container.Client.OrderItem.Create().SetOrderGroupID(group.ID).SetStoreID(group.StoreID).SetProductID(uuid.New()).SetVariantID(uuid.New()).
		SetProductName("Vitamin C Glow Serum").SetVariantTitle("30ml").SetImageURL("https://cdn.nantty.com/p/serum.jpg").SetUnitPriceMinor(85_000).SetQuantity(2).SetLineTotalMinor(170_000).
		Save(ctx); err != nil {
		t.Fatal(err)
	}
	err = module.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		payload, err := services.OrderGroupEventData(ctx, tx, group, map[string]any{"payBy": time.Now().UTC().Format(time.RFC3339Nano)})
		if err != nil {
			return err
		}
		if payload["sellerName"] != "Glow by Zainab" || payload["buyerName"] != "Amaka O." || payload["orderNumber"] != group.Reference {
			t.Fatalf("unexpected group snapshot: %#v", payload)
		}
		items, ok := payload["items"].([]map[string]any)
		if !ok || len(items) != 1 || items[0]["name"] != "Vitamin C Glow Serum" || items[0]["variant"] != "30ml" {
			t.Fatalf("unexpected item snapshot: %#v", payload["items"])
		}
		if payload["payBy"] == "" {
			t.Fatal("the payment deadline must be in the payload")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
