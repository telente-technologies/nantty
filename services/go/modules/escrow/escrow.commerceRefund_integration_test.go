package escrow

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
)

func TestCommerceRefundRequestRefundsTheOrderGroupOnceThroughPaystack(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 300_000})
	reference := harness.payCheckoutThroughWebhook(buyer, orderId, 0)
	request := map[string]any{"orderGroupId": orderId, "storeId": "store-1", "buyerAccountId": buyer, "amountMinor": 300_000, "currency": "NGN", "reason": "cancelled"}
	internal := http.Header{"X-Internal-Token": {strings.Repeat("e", 32)}}
	if forged := harness.Call(http.MethodPost, "/api/v1/internal/order-groups/"+orderId+"/refunds", "", "", request, http.Header{"X-Internal-Token": {"guess"}}); forged.Status != http.StatusUnauthorized {
		t.Fatalf("refund without the internal token: %d", forged.Status)
	}
	wrongBuyer := map[string]any{"orderGroupId": orderId, "storeId": "store-1", "buyerAccountId": uuid.NewString(), "amountMinor": 300_000, "currency": "NGN", "reason": "cancelled"}
	if mismatch := harness.Call(http.MethodPost, "/api/v1/internal/order-groups/"+orderId+"/refunds", "", "", wrongBuyer, internal); mismatch.Status != http.StatusUnprocessableEntity {
		t.Fatalf("refund for another buyer: %d %s", mismatch.Status, mismatch.Raw)
	}
	first := harness.Call(http.MethodPost, "/api/v1/internal/order-groups/"+orderId+"/refunds", "", "", request, internal)
	again := harness.Call(http.MethodPost, "/api/v1/internal/order-groups/"+orderId+"/refunds", "", "", request, internal)
	if calls := harness.Paystack.Calls("POST /refund"); calls != 0 {
		t.Fatalf("an escrow refund must not be sent before the outbox delivers it, sent %d", calls)
	}
	harness.relayQueuedRefunds()
	harness.relayQueuedRefunds()
	if first.Status != http.StatusOK || first.Body["status"] != "refunded" || again.Headers.Get("Idempotent-Replayed") != "true" || harness.Paystack.Calls("POST /refund") != 1 {
		t.Fatalf("refund: %d %s / %v refunds %d", first.Status, first.Raw, again.Headers, harness.Paystack.Calls("POST /refund"))
	}
	harness.deliverRefundProcessed(reference)
	if harness.balance(ledgermodels.RefundsPayableAccount("paystack", "NGN")) != 0 || harness.balance(ledgermodels.RefundedProcessingFeesExpenseAccount("NGN")) != 4_500 {
		t.Fatal("the refund must be paid from the main balance with the Paystack fee absorbed")
	}
	harness.AssertLedgerHealthy()
}
