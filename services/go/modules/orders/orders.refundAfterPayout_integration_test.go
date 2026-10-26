package orders

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/generated/ent/orderevent"
	"nantty/modules/orders/src/services"
)

func escrowEnvelope(eventType string, orderId uuid.UUID, data map[string]any) []byte {
	data["orderId"] = orderId.String()
	encoded, _ := json.Marshal(data)
	envelope, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "type": eventType, "source": "zudomart.escrow", "subject": orderId.String(), "schemaVersion": 1, "occurredAt": "2026-10-17T10:00:00Z", "data": json.RawMessage(encoded)})
	return envelope
}

func TestARefundAfterPayoutThatKeepsZudomartsFeesCompletesTheOrderRefund(t *testing.T) {
	harness := startAdminHarness(t, "released")
	orderId := harness.seedOrder("ZM-ADM-0090", "completed")
	handler := services.MoneyEventHandler{Container: harness.module.Container}
	ctx := context.Background()
	envelope := escrowEnvelope("escrow.clawedBack", orderId, map[string]any{"escrowId": uuid.NewString(), "status": "clawedBack", "refunded": map[string]any{"amountMinor": 291_300, "currency": "NGN"}})
	if err := handler.Handle(ctx, envelope); err != nil {
		t.Fatal(err)
	}
	group := harness.module.Container.Client.OrderGroup.GetX(ctx, orderId)
	if group.RefundedMinor != 291_300 || group.PaymentStatus != "refunded" || group.Status != "refunded" {
		t.Fatalf("the refund is complete although Zudomart kept its fees: refunded %d, payment %s, status %s", group.RefundedMinor, group.PaymentStatus, group.Status)
	}
}

func TestAFailedEscrowReleaseIsRecordedOnTheOrderAndTheRetryTimeShown(t *testing.T) {
	harness := startAdminHarness(t, "released")
	orderId := harness.seedOrder("ZM-ADM-0091", "completed")
	handler := services.MoneyEventHandler{Container: harness.module.Container}
	ctx := context.Background()
	if err := handler.Handle(ctx, escrowEnvelope("escrow.releaseFailed", orderId, map[string]any{"escrowId": uuid.NewString(), "status": "held", "autoReleaseAt": "2026-10-17T11:00:00Z"})); err != nil {
		t.Fatal(err)
	}
	group := harness.module.Container.Client.OrderGroup.GetX(ctx, orderId)
	if group.EscrowReleaseAt == nil || group.EscrowReleaseAt.UTC().Format("15:04") != "11:00" {
		t.Fatalf("the order shows when the payout is retried: %v", group.EscrowReleaseAt)
	}
	if events := harness.module.Container.Client.OrderEvent.Query().Where(orderevent.OrderGroupID(orderId), orderevent.Kind("sellerPayoutRetrying")).CountX(ctx); events != 1 {
		t.Fatalf("the timeline records the failed payout once: %d", events)
	}
}
