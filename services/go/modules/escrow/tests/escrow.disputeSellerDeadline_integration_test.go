package escrow_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
)

func openTestDispute(t *testing.T, harness *escrowHarness, key string) (string, string) {
	t.Helper()
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 300_000})
	harness.payCheckoutThroughWebhook(buyer, orderId, 0)
	opened := harness.Call(http.MethodPost, "/api/v1/orders/"+orderId+"/disputes", harness.Tokens.UserAccessToken(buyer), key, map[string]any{"reason": "not_received", "description": "Nothing came", "evidenceUrls": []string{}})
	if opened.Status != http.StatusCreated {
		t.Fatalf("open: %d %s", opened.Status, opened.Raw)
	}
	return opened.Body["id"].(string), orderId
}

func TestSellerSilentFor48HoursEscalatesTheDisputeOnceAndNotifiesBothSides(t *testing.T) {
	skipIntegrationWhenShortForEscrow(t)
	harness := startEscrowHarness(t)
	silent, _ := openTestDispute(t, harness, "silent-dispute-1")
	answered, answeredOrder := openTestDispute(t, harness, "answered-dispute-1")
	seller := harness.Tokens.UserAccessToken(sellerForOrder(answeredOrder))
	if reply := harness.Call(http.MethodPost, "/api/v1/disputes/"+answered+"/messages", seller, "seller-answer-1", map[string]any{"text": "Tracking attached", "attachmentUrls": []string{}}); reply.Status != http.StatusCreated {
		t.Fatalf("seller reply: %d %s", reply.Status, reply.Raw)
	}
	disputes := harness.escrow.Application.Disputes
	harness.clock = harness.clock.Add(47 * time.Hour)
	if escalated := disputes.EscalateDisputesPastSellerDeadline(context.Background(), 10); escalated != 0 {
		t.Fatalf("nothing is overdue before 48 hours, escalated %d", escalated)
	}
	harness.clock = harness.clock.Add(2 * time.Hour)
	if escalated := disputes.EscalateDisputesPastSellerDeadline(context.Background(), 10); escalated != 1 {
		t.Fatalf("exactly the silent dispute is escalated, got %d", escalated)
	}
	if again := disputes.EscalateDisputesPastSellerDeadline(context.Background(), 10); again != 0 {
		t.Fatalf("escalation must be idempotent, escalated %d more", again)
	}
	found, err := harness.escrow.Application.Container.Client(harness.Database).Dispute.Get(context.Background(), uuid.MustParse(silent))
	if err != nil || found.Status != "under_review" {
		t.Fatalf("the silent dispute goes to staff review: %+v %v", found, err)
	}
	var events int
	schema := harness.escrow.Application.Container.Settings.Money.DatabaseSchema
	_ = harness.Database.QueryRow(`SELECT count(*) FROM "` + schema + `".outbox_events WHERE event_type = 'dispute.sellerResponseOverdue'`).Scan(&events)
	if events != 1 {
		t.Fatalf("one outbox event notifies buyer and seller, got %d", events)
	}
}

func skipIntegrationWhenShortForEscrow(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test")
	}
}
