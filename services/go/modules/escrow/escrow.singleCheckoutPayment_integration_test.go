package escrow

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
)

func TestOneCheckoutPaymentSplitsDirectGroupsAndHoldsEscrowGroupsWithPerGroupRefunds(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, checkoutId, escrowOrder, directOrder := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	escrowSeller, directSeller := "seller-"+escrowOrder[:4], "seller-"+directOrder[:4]
	if err := harness.Payments.Application.Gateway.RecordSellerVerification(context.Background(), directSeller, "test", time.Now()); err != nil {
		t.Fatal(err)
	}
	err := harness.Payments.Application.Gateway.RegisterCheckoutPayables(context.Background(), []paymentmodels.OrderPayable{
		{CheckoutId: checkoutId, OrderId: escrowOrder, OrderReference: "ZM-E1", BuyerUserId: buyer, StoreId: "store-e", SellerUserId: escrowSeller, AmountMinor: 100_000, Currency: "NGN", PaymentMode: "escrow"},
		{CheckoutId: checkoutId, OrderId: directOrder, OrderReference: "ZM-D1", BuyerUserId: buyer, StoreId: "store-d", SellerUserId: directSeller, AmountMinor: 140_000, Currency: "NGN", PaymentMode: "direct", StoreVerified: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	harness.ensureSellerOnboarded(escrowOrder)
	initialized := harness.Call(http.MethodPost, "/api/v1/payments/initialize", harness.Tokens.UserAccessToken(buyer), "single-checkout-1", map[string]any{"checkoutId": checkoutId})
	if initialized.Status != http.StatusCreated || initialized.Body["payment"].(map[string]any)["amount"].(map[string]any)["amountMinor"].(float64) != 240_000 {
		t.Fatalf("initialize: %d %s", initialized.Status, initialized.Raw)
	}
	if harness.Paystack.Calls("POST /transaction") != 1 {
		t.Fatalf("one Paystack transaction expected, got %d", harness.Paystack.Calls("POST /transaction"))
	}
	reference := initialized.Body["reference"].(string)
	transaction := harness.Paystack.Transactions[reference]
	directShare := int64(140_000 - 2_100)
	if len(transaction.SplitShares) != 1 || transaction.SplitShares[harness.onboarded[directSeller]] != directShare {
		t.Fatalf("split %+v", transaction.SplitShares)
	}
	harness.CompleteCheckoutThroughWebhook(reference, 0, 3_600)
	escrowId := escrowIdForOrder(t, harness, escrowOrder)
	if harness.balance(ledgermodels.SellerEscrowAccount(escrowSeller, escrowId, "NGN")) != 100_000-1_500-1_500 || harness.balance(ledgermodels.PlatformFeesUnearnedAccount("NGN")) != 1_500 {
		t.Fatal("the escrow group must hold its amount less its 1.5% escrow fee and its share of the Paystack fee")
	}
	if harness.balance(ledgermodels.SellerSettlingByPaystackAccount(directSeller, "NGN")) != directShare || harness.balance(ledgermodels.PaymentsAwaitingApplicationAccount("NGN")) != 0 ||
		harness.balance(ledgermodels.PaymentProcessingFeeExpenseAccount("NGN")) != 0 {
		t.Fatal("the direct group must settle its split share and every kobo of the payment must be applied")
	}
	if harness.balance(ledgermodels.PlatformProviderBalanceAccount("paystack", "NGN")) != harness.Paystack.PlatformBalanceOf("NGN")-10_000_000 {
		t.Fatal("the ledger must mirror only the part of the payment that stayed in Zudomart's balance")
	}
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.disputes.resolve")
	refund := harness.Call(http.MethodPost, "/api/v1/admin/orders/"+escrowOrder+"/escrow/refund", staff.AccessToken, "single-refund-1", map[string]any{"reason": "Out of stock"}, http.Header{"X-Step-Up-Token": {staff.StepUpToken}})
	if refund.Status != http.StatusOK {
		t.Fatalf("refund of one group: %d %s", refund.Status, refund.Raw)
	}
	if len(harness.Paystack.Refunds) != 1 || harness.Paystack.Refunds[0]["amount"] != int64(100_000) {
		t.Fatalf("a partial Paystack refund for one group expected: %+v", harness.Paystack.Refunds)
	}
	harness.deliverRefundProcessed(reference)
	if harness.balance(ledgermodels.RefundsPayableAccount("paystack", "NGN")) != 0 || harness.balance(ledgermodels.SellerSettlingByPaystackAccount(directSeller, "NGN")) != directShare {
		t.Fatal("refunding the escrow group must not touch the direct group")
	}
	harness.AssertLedgerHealthy()
}
