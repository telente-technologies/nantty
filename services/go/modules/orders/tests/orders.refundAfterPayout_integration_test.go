package orders_test

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/generated/ent/orderevent"
	"nantty/modules/orders/src/generated/ent/outboxevent"
	"nantty/modules/orders/src/generated/ent/processedevent"
	"nantty/modules/orders/src/generated/ent/refundrecord"
	"nantty/modules/orders/src/services"
	platformevents "nantty/platform/events"
)

func escrowEnvelope(eventType string, orderId uuid.UUID, data map[string]any) []byte {
	data["orderId"] = orderId.String()
	encoded, _ := json.Marshal(data)
	envelope, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "type": eventType, "source": "nantty.escrow", "subject": orderId.String(), "schemaVersion": 1, "occurredAt": "2026-10-17T10:00:00Z", "data": json.RawMessage(encoded)})
	return envelope
}

func TestARefundAfterPayoutThatKeepsNanttysFeesCompletesTheOrderRefund(t *testing.T) {
	for _, scenario := range []struct {
		eventType string
		status    string
		amount    int64
		order     string
	}{
		{eventType: "escrow.partiallyRefunded", status: "partiallyRefunded", amount: 120_000, order: "ZM-ADM-0090"},
		{eventType: "escrow.refunded", status: "refunded", amount: 300_000, order: "ZM-ADM-0095"},
		{eventType: "escrow.clawedBack", status: "clawedBack", amount: 291_300, order: "ZM-ADM-0096"},
	} {
		t.Run(scenario.eventType, func(t *testing.T) {
			harness := startAdminHarness(t, "released")
			orderId := harness.seedOrder(scenario.order, "completed")
			handler := services.MoneyEventHandler{Container: harness.module.Container}
			ctx := context.Background()
			envelope := escrowEnvelope(scenario.eventType, orderId, map[string]any{
				"escrowId": uuid.NewString(), "status": scenario.status,
				"refunded": map[string]any{"amountMinor": scenario.amount, "currency": "NGN"},
			})
			var wait sync.WaitGroup
			errors := make(chan error, 2)
			for range 2 {
				wait.Add(1)
				go func() {
					defer wait.Done()
					errors <- handler.Handle(ctx, envelope)
				}()
			}
			wait.Wait()
			close(errors)
			for err := range errors {
				if err != nil {
					t.Fatal(err)
				}
			}
			group := harness.module.Container.Client.OrderGroup.GetX(ctx, orderId)
			wantPaymentStatus := "partially_refunded"
			wantOrderStatus := "completed"
			if scenario.eventType != "escrow.partiallyRefunded" {
				wantPaymentStatus = "refunded"
				wantOrderStatus = "refunded"
			}
			if group.RefundedMinor != scenario.amount || group.PaymentStatus != wantPaymentStatus || group.Status != wantOrderStatus {
				t.Fatalf("unexpected refund state: refunded %d, payment %s, status %s", group.RefundedMinor, group.PaymentStatus, group.Status)
			}
			if events := harness.module.Container.Client.OrderEvent.Query().Where(orderevent.OrderGroupID(orderId), orderevent.Kind("refunded")).CountX(ctx); events != 1 {
				t.Fatalf("concurrent duplicate delivery must append one refund timeline event, got %d", events)
			}
			if records := harness.module.Container.Client.RefundRecord.Query().Where(refundrecord.OrderGroupID(orderId)).CountX(ctx); records != 1 {
				t.Fatalf("concurrent duplicate delivery must record one settlement, got %d refund records", records)
			}
			if receipts := harness.module.Container.Client.ProcessedEvent.Query().Where(processedevent.EventType(scenario.eventType)).CountX(ctx); receipts != 1 {
				t.Fatalf("concurrent duplicate delivery must commit one %s receipt, got %d", scenario.eventType, receipts)
			}
		})
	}
}

func TestSettledRefundRejectsMismatchedCurrencyAndAmountsAboveOrderTotal(t *testing.T) {
	for _, scenario := range []struct {
		name   string
		amount int64
		unit   string
	}{
		{name: "currency_mismatch", amount: 120_000, unit: "USD"},
		{name: "amount_above_total", amount: 300_001, unit: "NGN"},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			harness := startAdminHarness(t, "released")
			orderId := harness.seedOrder("ZM-ADM-0098", "completed")
			envelope := escrowEnvelope("escrow.partiallyRefunded", orderId, map[string]any{
				"status":   "partiallyRefunded",
				"refunded": map[string]any{"amountMinor": scenario.amount, "currency": scenario.unit},
			})
			err := (services.MoneyEventHandler{Container: harness.module.Container}).Handle(context.Background(), envelope)
			if !errors.Is(err, platformevents.ErrPoisonMessage) {
				t.Fatalf("invalid settlement must be rejected as poison, got %v", err)
			}
			group := harness.module.Container.Client.OrderGroup.GetX(context.Background(), orderId)
			if group.RefundedMinor != 0 || group.PaymentStatus != "paid" {
				t.Fatalf("invalid settlement changed order payment state: refunded=%d payment=%s", group.RefundedMinor, group.PaymentStatus)
			}
			if receipts := harness.module.Container.Client.ProcessedEvent.Query().Where(processedevent.EventType("escrow.partiallyRefunded")).CountX(context.Background()); receipts != 0 {
				t.Fatalf("invalid settlement must remain unprocessed, got %d receipts", receipts)
			}
		})
	}
}

func TestAFailedEscrowReleaseIsRecordedOnTheOrderAndTheRetryTimeShown(t *testing.T) {
	harness := startAdminHarness(t, "released")
	orderId := harness.seedOrder("ZM-ADM-0091", "completed")
	handler := services.MoneyEventHandler{Container: harness.module.Container}
	ctx := context.Background()
	envelope := escrowEnvelope("escrow.releaseFailed", orderId, map[string]any{"escrowId": uuid.NewString(), "status": "held", "autoReleaseAt": "2026-10-17T11:00:00Z"})
	for range 2 {
		if err := handler.Handle(ctx, envelope); err != nil {
			t.Fatal(err)
		}
	}
	group := harness.module.Container.Client.OrderGroup.GetX(ctx, orderId)
	if group.EscrowReleaseAt == nil || group.EscrowReleaseAt.UTC().Format("15:04") != "11:00" {
		t.Fatalf("the order shows when the payout is retried: %v", group.EscrowReleaseAt)
	}
	for range 2 {
		if err := services.RecordEscrowReleaseRetry(ctx, harness.module.Container, orderId, group.EscrowReleaseAt); err != nil {
			t.Fatal(err)
		}
	}
	if events := harness.module.Container.Client.OrderEvent.Query().Where(orderevent.OrderGroupID(orderId), orderevent.Kind("sellerPayoutRetrying")).CountX(ctx); events != 1 {
		t.Fatalf("redelivering the same retry time must not duplicate the timeline event: %d", events)
	}
	if receipts := harness.module.Container.Client.ProcessedEvent.Query().Where(processedevent.EventType("escrow.releaseFailed")).CountX(ctx); receipts != 1 {
		t.Fatalf("duplicate delivery must commit only one processed-event receipt: %d", receipts)
	}
}

func TestEscrowReleaseScheduleReceiptCommitsWithTheOrderUpdate(t *testing.T) {
	harness := startAdminHarness(t, "held")
	orderId := harness.seedOrder("ZM-ADM-0092", "delivered")
	handler := services.MoneyEventHandler{Container: harness.module.Container}
	ctx := context.Background()
	envelope := escrowEnvelope("escrow.releaseScheduled", orderId, map[string]any{"escrowId": uuid.NewString(), "autoReleaseAt": "2026-10-20T11:00:00Z"})
	var wait sync.WaitGroup
	errors := make(chan error, 2)
	for range 2 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			errors <- handler.Handle(ctx, envelope)
		}()
	}
	wait.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatal(err)
		}
	}
	group := harness.module.Container.Client.OrderGroup.GetX(ctx, orderId)
	if group.EscrowReleaseAt == nil || group.EscrowReleaseAt.UTC().Format("15:04") != "11:00" {
		t.Fatalf("the order shows the scheduled escrow release time: %v", group.EscrowReleaseAt)
	}
	if receipts := harness.module.Container.Client.ProcessedEvent.Query().Where(processedevent.EventType("escrow.releaseScheduled")).CountX(ctx); receipts != 1 {
		t.Fatalf("duplicate delivery must commit only one processed-event receipt: %d", receipts)
	}
}

func TestEscrowReleaseReceiptCommitsWithOrderCompletion(t *testing.T) {
	harness := startAdminHarness(t, "released")
	orderId := harness.seedOrder("ZM-ADM-0093", "delivered")
	handler := services.MoneyEventHandler{Container: harness.module.Container}
	ctx := context.Background()
	envelope := escrowEnvelope("escrow.released", orderId, map[string]any{"escrowId": uuid.NewString(), "status": "released"})
	var wait sync.WaitGroup
	errors := make(chan error, 2)
	for range 2 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			errors <- handler.Handle(ctx, envelope)
		}()
	}
	wait.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatal(err)
		}
	}
	group := harness.module.Container.Client.OrderGroup.GetX(ctx, orderId)
	if group.Status != "completed" {
		t.Fatalf("escrow release must complete the order once, got %q", group.Status)
	}
	if events := harness.module.Container.Client.OrderEvent.Query().Where(orderevent.OrderGroupID(orderId), orderevent.Kind("completed")).CountX(ctx); events != 1 {
		t.Fatalf("concurrent duplicate delivery must append one completion timeline event, got %d", events)
	}
	if events := harness.module.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType("orderGroup.completed"), outboxevent.Subject(orderId.String())).CountX(ctx); events != 1 {
		t.Fatalf("concurrent duplicate delivery must publish one completion event, got %d", events)
	}
	if receipts := harness.module.Container.Client.ProcessedEvent.Query().Where(processedevent.EventType("escrow.released")).CountX(ctx); receipts != 1 {
		t.Fatalf("concurrent duplicate delivery must commit one receipt, got %d", receipts)
	}
}

func TestDisputeEventReceiptsCommitWithOrderTransitions(t *testing.T) {
	harness := startAdminHarness(t, "held")
	orderId := harness.seedOrder("ZM-ADM-0094", "delivered")
	handler := services.MoneyEventHandler{Container: harness.module.Container}
	ctx := context.Background()
	for _, eventType := range []string{"dispute.opened", "dispute.closed"} {
		envelope := escrowEnvelope(eventType, orderId, map[string]any{})
		var wait sync.WaitGroup
		errors := make(chan error, 2)
		for range 2 {
			wait.Add(1)
			go func() {
				defer wait.Done()
				errors <- handler.Handle(ctx, envelope)
			}()
		}
		wait.Wait()
		close(errors)
		for err := range errors {
			if err != nil {
				t.Fatalf("%s: %v", eventType, err)
			}
		}
	}
	group := harness.module.Container.Client.OrderGroup.GetX(ctx, orderId)
	if group.Status != "delivered" {
		t.Fatalf("closing the dispute restores the pre-dispute status, got %q", group.Status)
	}
	if events := harness.module.Container.Client.OrderEvent.Query().Where(orderevent.OrderGroupID(orderId), orderevent.Kind("disputed")).CountX(ctx); events != 1 {
		t.Fatalf("concurrent duplicate opening must append one dispute timeline event, got %d", events)
	}
	if events := harness.module.Container.Client.OrderEvent.Query().Where(orderevent.OrderGroupID(orderId), orderevent.Kind("note")).CountX(ctx); events != 1 {
		t.Fatalf("concurrent duplicate closing must append one restoration note, got %d", events)
	}
	if events := harness.module.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType("orderGroup.statusChanged"), outboxevent.Subject(orderId.String())).CountX(ctx); events != 2 {
		t.Fatalf("opening and closing the dispute must each emit one committed status event, got %d", events)
	}
	for _, eventType := range []string{"dispute.opened", "dispute.closed"} {
		if receipts := harness.module.Container.Client.ProcessedEvent.Query().Where(processedevent.EventType(eventType)).CountX(ctx); receipts != 1 {
			t.Fatalf("concurrent duplicate %s delivery must commit one receipt, got %d", eventType, receipts)
		}
	}
}

func TestPartialRefundDisputeResolutionRestoresOrderStatusOnce(t *testing.T) {
	harness := startAdminHarness(t, "held")
	orderId := harness.seedOrder("ZM-ADM-0097", "delivered")
	handler := services.MoneyEventHandler{Container: harness.module.Container}
	ctx := context.Background()
	if err := handler.Handle(ctx, escrowEnvelope("dispute.opened", orderId, map[string]any{})); err != nil {
		t.Fatal(err)
	}
	if err := handler.Handle(ctx, escrowEnvelope("escrow.partiallyRefunded", orderId, map[string]any{
		"status":   "partiallyRefunded",
		"refunded": map[string]any{"amountMinor": 120_000, "currency": "NGN"},
	})); err != nil {
		t.Fatal(err)
	}

	resolution := escrowEnvelope("dispute.resolved", orderId, map[string]any{})
	var wait sync.WaitGroup
	errors := make(chan error, 2)
	for range 2 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			errors <- handler.Handle(ctx, resolution)
		}()
	}
	wait.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatal(err)
		}
	}

	group := harness.module.Container.Client.OrderGroup.GetX(ctx, orderId)
	if group.Status != "delivered" || group.PaymentStatus != "partially_refunded" || group.RefundedMinor != 120_000 {
		t.Fatalf("partial-refund resolution must restore fulfillment status and retain settlement: status=%s payment=%s refunded=%d", group.Status, group.PaymentStatus, group.RefundedMinor)
	}
	if events := harness.module.Container.Client.OrderEvent.Query().Where(orderevent.OrderGroupID(orderId), orderevent.Kind("note")).CountX(ctx); events != 1 {
		t.Fatalf("duplicate resolution delivery must append one restoration note, got %d", events)
	}
	if receipts := harness.module.Container.Client.ProcessedEvent.Query().Where(processedevent.EventType("dispute.resolved")).CountX(ctx); receipts != 1 {
		t.Fatalf("duplicate resolution delivery must commit one receipt, got %d", receipts)
	}
}
