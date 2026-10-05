package escrow

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
)

func sellerRefundRequest(harness *escrowHarness, orderId, buyer string, amountMinor int64) paymentstesting.HarnessResponse {
	request := map[string]any{"orderGroupId": orderId, "storeId": "store-1", "buyerAccountId": buyer, "amountMinor": amountMinor, "currency": "NGN", "reason": "Seller refund: one item was damaged"}
	return harness.Call(http.MethodPost, "/api/v1/internal/order-groups/"+orderId+"/refunds", "", "", request, http.Header{"X-Internal-Token": {strings.Repeat("e", 32)}})
}

func TestSellerPartialRefundComesOutOfHeldEscrowOnce(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 300_000})
	reference := harness.payCheckoutThroughWebhook(buyer, orderId, 0)
	first := sellerRefundRequest(harness, orderId, buyer, 100_000)
	again := sellerRefundRequest(harness, orderId, buyer, 100_000)
	if first.Status != http.StatusOK || first.Body["status"] != "partiallyRefunded" || again.Headers.Get("Idempotent-Replayed") != "true" {
		t.Fatalf("partial seller refund: %d %s", first.Status, first.Raw)
	}
	if calls := harness.Paystack.Calls("POST /refund"); calls != 1 || harness.Paystack.Refunds[0]["amount"] != int64(100_000) {
		t.Fatalf("one provider refund of the requested amount: %d %v", calls, harness.Paystack.Refunds)
	}
	harness.deliverRefundProcessed(reference)
	if harness.balance(ledgermodels.RefundsPayableAccount("paystack", "NGN")) != 0 {
		t.Fatal("the refund is paid from the main balance")
	}
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
	sellerId := "seller-" + orderId[:4]
	if harness.balance(ledgermodels.SellerDebtAccount(sellerId, "NGN")) != 197_000 || harness.Paystack.Calls("POST /refund") != 1 {
		t.Fatal("the seller owes the refunded share and Paystack is called once")
	}
	harness.AssertLedgerHealthy()
}
