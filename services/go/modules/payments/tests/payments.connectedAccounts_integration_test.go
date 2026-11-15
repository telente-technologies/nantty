package payments_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/modules/gateway/models"
)

func registerOrder(t *testing.T, harness *paymentstesting.MoneyHarness, buyer, seller string, amount int64, mode string, verified bool) string {
	t.Helper()
	orderId := uuid.NewString()
	if verified {
		if err := harness.Payments.Application.Gateway.RecordSellerVerification(context.Background(), seller, "test", time.Now()); err != nil {
			t.Fatal(err)
		}
	}
	err := harness.Payments.Application.Gateway.RegisterCheckoutPayables(context.Background(), []models.OrderPayable{{
		CheckoutId: uuid.NewString(), OrderId: orderId, OrderReference: "ZM-" + orderId[:5], BuyerUserId: buyer, StoreId: "store-1", SellerUserId: seller,
		AmountMinor: amount, Currency: "NGN", PaymentMode: mode, StoreVerified: verified,
	}})
	if err != nil {
		t.Fatal(err)
	}
	return orderId
}

func TestCheckoutNeedsAReadySellerAndAVerifiedBuyerEmail(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	buyer, seller := uuid.NewString(), uuid.NewString()
	harness.SetCountry(buyer, "NG")
	harness.SetCountry(seller, "NG")
	order := registerOrder(t, harness, buyer, seller, 250_000, "escrow", true)
	initialize := func(orderId, key string) paymentstesting.HarnessResponse {
		return harness.Call(http.MethodPost, "/api/v1/payments/initialize", harness.Tokens.UserAccessToken(buyer), key, map[string]any{"orderId": orderId})
	}
	harness.OnboardConnectedAccount(seller, true)
	harness.Directory.MarkUnverified(buyer)
	if unverified := initialize(order, "unverified-buyer"); unverified.Status != http.StatusForbidden || unverified.Body["code"] != "VERIFY_EMAIL_REQUIRED" {
		t.Fatalf("unverified buyer: %d %s", unverified.Status, unverified.Raw)
	}
	harness.Directory.Unverified[buyer] = false
	started := initialize(order, "verified-buyer")
	if started.Status != http.StatusCreated || started.Body["checkoutUrl"] == "" {
		t.Fatalf("checkout: %d %s", started.Status, started.Raw)
	}
	transaction := harness.Flutterwave.TransactionByReference(started.Body["reference"].(string))
	if transaction == nil || transaction.AmountMinor != 250_000 || transaction.Email != "user-"+buyer[:8]+"@nantty.test" {
		t.Fatalf("one hosted Flutterwave checkout for the order, in the buyer's name: %+v", transaction)
	}
}
