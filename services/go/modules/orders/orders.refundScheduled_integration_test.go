package orders

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/generated/ent/orderevent"
	"zudomart/modules/orders/src/generated/ent/refundrecord"
	"zudomart/modules/orders/src/services"
	"zudomart/platform/staffauth"
)

func TestARefundScheduledByEscrowIsShownAsScheduledAndCompletesOnTheRefundEvent(t *testing.T) {
	harness := startAdminHarness(t, "held")
	orderId := harness.seedOrder("ZM-ADM-0040", "processing")
	access, stepUp, _ := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"refunds:issue"})
	body := map[string]any{"orderId": orderId.String(), "amount": map[string]any{"amountMinor": 120_000, "currency": "NGN"}, "reason": "Wrong size sent"}
	if status, created, _ := harness.call("POST", "/api/v1/admin/refunds", body, bearer(access, map[string]string{"Idempotency-Key": "refund-key-0400", staffauth.StepUpHeader: stepUp})); status != http.StatusCreated {
		t.Fatalf("issue: %d %v", status, created)
	}
	data, _ := json.Marshal(map[string]any{"escrowId": uuid.NewString(), "orderId": orderId.String(), "status": "held", "pendingRefund": map[string]any{"id": uuid.NewString(), "amountMinor": 120_000, "currency": "NGN", "full": false}})
	envelope, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "type": "escrow.refundScheduled", "source": "zudomart.escrow", "subject": orderId.String(), "schemaVersion": 1, "occurredAt": "2026-10-12T10:00:00Z", "data": json.RawMessage(data)})
	handler := services.MoneyEventHandler{Container: harness.module.Container}
	ctx := context.Background()
	for range 2 {
		if err := handler.Handle(ctx, envelope); err != nil {
			t.Fatal(err)
		}
	}
	record := harness.module.Container.Client.RefundRecord.Query().Where(refundrecord.OrderGroupID(orderId)).OnlyX(ctx)
	if record.Status != "scheduled" {
		t.Fatalf("the refund record must read scheduled: %+v", record)
	}
	timeline := harness.module.Container.Client.OrderEvent.Query().Where(orderevent.OrderGroupID(orderId), orderevent.Kind("refundScheduled")).CountX(ctx)
	if timeline != 1 {
		t.Fatalf("buyer and seller timeline must show the scheduled refund once, got %d", timeline)
	}
	status, page, _ := harness.call("GET", "/api/v1/admin/refunds?status=scheduled", nil, bearer(access, nil))
	if status != http.StatusOK || len(page["data"].([]any)) != 1 {
		t.Fatalf("admin can filter scheduled refunds: %d %v", status, page)
	}
	other := map[string]any{"orderId": orderId.String(), "amount": map[string]any{"amountMinor": 10_000, "currency": "NGN"}, "reason": "Another refund"}
	if status, response, _ := harness.call("POST", "/api/v1/admin/refunds", other, bearer(access, map[string]string{"Idempotency-Key": "refund-key-0401", staffauth.StepUpHeader: stepUp})); status != http.StatusConflict || response["code"] != "REFUND_IN_PROGRESS" {
		t.Fatalf("a second refund while one is scheduled must wait: %d %v", status, response)
	}
	if err := services.RecordOrderRefund(ctx, harness.module.Container, orderId, 120_000, ""); err != nil {
		t.Fatal(err)
	}
	records := harness.module.Container.Client.RefundRecord.Query().Where(refundrecord.OrderGroupID(orderId)).AllX(ctx)
	if len(records) != 1 || records[0].Status != "completed" {
		t.Fatalf("the scheduled record completes without a duplicate system record: %+v", records)
	}
}
