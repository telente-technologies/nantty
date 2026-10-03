package escrow

import (
	"context"
	"database/sql"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	escrowservices "zudomart/modules/escrow/src/modules/escrows/services"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
)

func TestUnverifiedStoresAreEscrowOnlyAndDirectPaymentsLockTheSellerCreditUntilRefunded(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	err := harness.Payments.Application.Gateway.RegisterCheckoutPayables(context.Background(), []paymentmodels.OrderPayable{{
		CheckoutId: uuid.NewString(), OrderId: orderId, OrderReference: "ZM-1", BuyerUserId: buyer, StoreId: "store", SellerUserId: "seller",
		AmountMinor: 100_000, Currency: "NGN", PaymentMode: "direct", StoreVerified: false,
	}})
	if err == nil {
		t.Fatal("direct payment accepted for an unverified store")
	}
	harness.registerCheckoutWithMode(buyer, map[string]int64{orderId: 200_000}, "direct", true)
	harness.payCheckoutThroughWebhook(buyer, orderId, 0)
	sellerId := "seller-" + orderId[:4]
	if harness.balance(ledgermodels.SellerPendingAccount(sellerId, "NGN")) != 190_000 || harness.balance(ledgermodels.SellerEscrowAccount(sellerId, "x", "NGN")) != 0 {
		t.Fatal("direct payment did not credit the seller's locked balance")
	}
	view := harness.Call(http.MethodGet, "/api/v1/orders/"+orderId+"/escrow", harness.Tokens.UserAccessToken(buyer), "", nil)
	if view.Body["stage"] != "released_to_seller" {
		t.Fatalf("direct order stage = %v", view.Body["stage"])
	}
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.disputes.resolve")
	refund := harness.Call(http.MethodPost, "/api/v1/admin/orders/"+orderId+"/escrow/refund", staff.AccessToken, "refund-direct-1", map[string]any{"reason": "Seller could not fulfil"}, http.Header{"X-Step-Up-Token": {staff.StepUpToken}})
	if refund.Status != http.StatusOK || refund.Body["status"] != "refunded" {
		t.Fatalf("refund of a direct order: %d %s", refund.Status, refund.Raw)
	}
	if harness.balance(ledgermodels.SellerPendingAccount(sellerId, "NGN")) != 0 || harness.balance(ledgermodels.RefundsPayableAccount("paystack", "NGN")) != 0 || harness.Paystack.RefundCalls != 1 {
		t.Fatal("direct refund did not drain the locked credit and pay the buyer back")
	}
	harness.AssertLedgerHealthy()
}

func TestOnlyOneLiveAttemptAndALateSuccessOnASupersededAttemptIsRefunded(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 300_000})
	token := harness.Tokens.UserAccessToken(buyer)
	first := harness.Call(http.MethodPost, "/api/v1/payments/initialize", token, "attempt-key-1", map[string]any{"orderId": orderId, "provider": "paystack"})
	second := harness.Call(http.MethodPost, "/api/v1/payments/initialize", token, "attempt-key-2", map[string]any{"orderId": orderId, "provider": "paystack"})
	if first.Status != http.StatusCreated || second.Status != http.StatusCreated || first.Body["reference"] == second.Body["reference"] {
		t.Fatalf("attempts: %d %d", first.Status, second.Status)
	}
	for _, attempt := range []HarnessReference{{first.Body["reference"].(string)}, {second.Body["reference"].(string)}} {
		harness.Paystack.MarkChargeAs(attempt.reference, "success", 0, 0)
		body, headers := paymentstesting.SignedPaystackWebhook("charge.success", map[string]any{"id": harness.Paystack.ChargeId(attempt.reference), "reference": attempt.reference})
		if response := harness.Call(http.MethodPost, "/api/v1/payments/webhooks/paystack", "", "", body, headers); response.Status != http.StatusOK {
			t.Fatalf("webhook: %d %s", response.Status, response.Raw)
		}
	}
	if harness.Paystack.RefundCalls != 1 || harness.balance(ledgermodels.RefundsPayableAccount("paystack", "NGN")) != 0 || harness.balance(ledgermodels.PaymentsAwaitingApplicationAccount("NGN")) != 0 {
		t.Fatalf("duplicate payment not refunded exactly once (refund calls %d)", harness.Paystack.RefundCalls)
	}
	if harness.balance(ledgermodels.SellerEscrowAccount("seller-"+orderId[:4], escrowIdForOrder(t, harness, orderId), "NGN")) != 300_000 {
		t.Fatal("the order was not held exactly once")
	}
	harness.AssertLedgerHealthy()
}

func TestADisputePausesTheAutoReleaseTimerAndClosingItResumesTheRemainingWindow(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 100_000})
	harness.payCheckoutThroughWebhook(buyer, orderId, 0)
	escrows := harness.escrow.Application.Escrows
	mustRunInTransaction(t, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := escrows.RecordOrderFulfilmentInTransaction(ctx, transaction, escrowservices.OrderFulfilment{OrderId: orderId, Stage: "delivered", OccurredAt: harness.clock.Add(-time.Hour)})
		return err
	})
	token := harness.Tokens.UserAccessToken(buyer)
	opened := harness.Call(http.MethodPost, "/api/v1/orders/"+orderId+"/disputes", token, "pause-dispute-1", map[string]any{"reason": "not_received", "description": "", "evidenceUrls": []string{}})
	harness.clock = harness.clock.Add(500 * time.Hour)
	if closed := harness.Call(http.MethodPost, "/api/v1/disputes/"+opened.Body["id"].(string)+"/close", token, "", nil); closed.Body["status"] != "closed" {
		t.Fatalf("close: %d %s", closed.Status, closed.Raw)
	}
	harness.clock = harness.clock.Add(70 * time.Hour)
	if released, _ := escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10); released != 0 {
		t.Fatal("released before the remaining 71 hours elapsed")
	}
	harness.clock = harness.clock.Add(2 * time.Hour)
	if released, _ := escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10); released != 1 {
		t.Fatal("not released after the remaining window")
	}
	harness.AssertLedgerHealthy()
}
