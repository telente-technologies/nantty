package escrow_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
)

func sellerRefundRequest(harness *escrowHarness, orderId, buyer string, amountMinor int64) paymentstesting.HarnessResponse {
	request := map[string]any{"orderGroupId": orderId, "storeId": "store-1", "buyerAccountId": buyer, "amountMinor": amountMinor, "currency": "NGN", "reason": "Seller refund: one item was damaged"}
	return harness.Call(http.MethodPost, "/api/v1/internal/order-groups/"+orderId+"/refunds", "", "", request, http.Header{"X-Internal-Token": {strings.Repeat("e", 32)}})
}

func TestSellerPartialRefundComesOutOfHeldEscrowOnce(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 300_000})
	reference := harness.payAndSettle(buyer, orderId)
	first := sellerRefundRequest(harness, orderId, buyer, 100_000)
	again := sellerRefundRequest(harness, orderId, buyer, 100_000)
	if first.Status != http.StatusOK || first.Body["status"] != "partiallyRefunded" || again.Headers.Get("Idempotent-Replayed") != "true" {
		t.Fatalf("partial seller refund: %d %s", first.Status, first.Raw)
	}
	harness.RunMoneyWorkers()
	if calls := harness.Flutterwave.Calls("POST /transactions"); calls != 0 || harness.balance(ledgermodels.WalletAvailableAccount(buyer, "NGN")) != 100_000 {
		t.Fatalf("a settled escrow refunds the requested amount inside the buyer's wallet: %d card refunds, balances %v", calls, harness.NonZeroBalances())
	}
	_ = reference
	harness.AssertLedgerHealthy()
}

func TestSellerRefundOfADirectOrderIsInFullAndBookedAsSellerDebt(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckoutWithMode(buyer, map[string]int64{orderId: 200_000}, "direct", true)
	reference := harness.payCheckoutThroughWebhook(buyer, orderId, 0)
	if partial := sellerRefundRequest(harness, orderId, buyer, 50_000); partial.Status != http.StatusConflict {
		t.Fatalf("a direct order is refunded only in full: %d %s", partial.Status, partial.Raw)
	}
	if full := sellerRefundRequest(harness, orderId, buyer, 200_000); full.Status != http.StatusOK || full.Body["status"] != "refunded" {
		t.Fatalf("full seller refund: %d %s", full.Status, full.Raw)
	}
	harness.deliverRefundProcessed(reference)
	sellerId := sellerForOrder(orderId)
	if harness.balance(ledgermodels.SellerDebtAccount(sellerId, "NGN")) != 197_200 || harness.Flutterwave.Calls("POST /transactions") != 1 {
		t.Fatalf("the seller owes the refunded share and provider is called once: %d %v", harness.Flutterwave.Calls("POST /transactions"), harness.NonZeroBalances())
	}
	harness.AssertLedgerHealthy()
}
