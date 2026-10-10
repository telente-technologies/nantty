package payments

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	"zudomart/modules/payments/src/modules/gateway/models"
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

func TestDirectCheckoutSplitsToTheSellerSubaccountAndEscrowStaysOnTheMainBalance(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	buyer, seller := uuid.NewString(), uuid.NewString()
	directOrder := registerOrder(t, harness, buyer, seller, 250_000, "direct", true)
	initialize := func(orderId, key string) paymentstesting.HarnessResponse {
		return harness.Call(http.MethodPost, "/api/v1/payments/initialize", harness.Tokens.UserAccessToken(buyer), key, map[string]any{"orderId": orderId})
	}
	if blocked := initialize(directOrder, "no-subaccount"); blocked.Status != http.StatusConflict || blocked.Body["code"] != "SELLER_NOT_READY_FOR_PAYMENTS" {
		t.Fatalf("direct checkout before the seller has a subaccount: %d %s", blocked.Status, blocked.Raw)
	}
	subaccount := harness.OnboardConnectedAccount(seller, true)
	harness.Directory.MarkUnverified(buyer)
	if unverified := initialize(directOrder, "unverified-buyer"); unverified.Status != http.StatusForbidden || unverified.Body["code"] != "VERIFY_EMAIL_REQUIRED" {
		t.Fatalf("unverified buyer: %d %s", unverified.Status, unverified.Raw)
	}
	harness.Directory.Unverified[buyer] = false
	started := initialize(directOrder, "verified-buyer")
	if started.Status != http.StatusCreated || started.Body["checkoutUrl"] == "" {
		t.Fatalf("checkout: %d %s", started.Status, started.Raw)
	}
	transaction := harness.Paystack.Transactions[started.Body["reference"].(string)]
	if transaction.SplitShares[subaccount] != 250_000-13_750 || len(transaction.SplitShares) != 1 || transaction.Email != "user-"+buyer[:8]+"@zudomart.test" {
		t.Fatalf("direct charge must split the seller share, net of the allocated Paystack fee, to the seller subaccount: %+v", transaction)
	}
	escrowOrder := registerOrder(t, harness, buyer, seller, 100_000, "escrow", false)
	escrowStarted := initialize(escrowOrder, "escrow-order")
	if escrowTransaction := harness.Paystack.Transactions[escrowStarted.Body["reference"].(string)]; escrowTransaction.Subaccount != "" || len(escrowTransaction.SplitShares) != 0 {
		t.Fatalf("an escrow order must stay on the main balance: %+v", escrowTransaction)
	}
}

func TestWebSubscriptionIsWebOnlyAndDowngradesWhenPaystackDisablesIt(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	owner := uuid.NewString()
	token := harness.Tokens.UserAccessToken(owner)
	if mobile := harness.Call(http.MethodPost, "/api/v1/payments/subscriptions/checkout", token, "", map[string]any{"planCode": "premium_web"}, http.Header{"X-Client-Platform": {"ios"}}); mobile.Status != http.StatusUnprocessableEntity {
		t.Fatalf("subscription started in the app: %d", mobile.Status)
	}
	started := harness.Call(http.MethodPost, "/api/v1/payments/subscriptions/checkout", token, "", map[string]any{"planCode": "premium_web"}, http.Header{"X-Client-Platform": {"web"}})
	if started.Status != http.StatusCreated || started.Body["checkoutUrl"] == "" {
		t.Fatalf("checkout: %d %s", started.Status, started.Raw)
	}
	reference := started.Body["reference"].(string)
	transaction := harness.Paystack.CompleteCheckout(reference, 0, 3_750, "card")
	if transaction.PlanCode != "PLN_premium_web" {
		t.Fatalf("plan not sent: %+v", transaction)
	}
	harness.DeliverPaystackEvent("charge.success", map[string]any{"id": transaction.Id, "reference": reference, "status": "success", "amount": transaction.AmountMinor, "currency": "NGN"})
	customer := map[string]any{"customer_code": transaction.CustomerCode}
	plan := map[string]any{"plan_code": "PLN_premium_web"}
	harness.DeliverPaystackEvent("subscription.create", map[string]any{"id": 1, "subscription_code": "SUB_web_1", "email_token": "tok_1", "status": "active", "customer": customer, "plan": plan, "next_payment_date": "2030-01-14T00:00:00.000Z"})
	harness.DeliverPaystackEvent("invoice.payment_failed", map[string]any{"id": 2, "status": "failed", "subscription": map[string]any{"subscription_code": "SUB_web_1", "status": "attention"}, "customer": customer})
	harness.DeliverPaystackEvent("subscription.disable", map[string]any{"id": 1, "subscription_code": "SUB_web_1", "status": "complete", "customer": customer, "plan": plan})
	var status string
	var downgraded bool
	schema := harness.Payments.Application.Container.Settings.Money.DatabaseSchema
	if err := harness.Database.QueryRow(`SELECT status, downgraded_at IS NOT NULL FROM "`+schema+`".billing_subscriptions WHERE reference = $1`, reference).Scan(&status, &downgraded); err != nil {
		t.Fatal(err)
	}
	if status != "canceled" || !downgraded {
		t.Fatalf("status %s downgraded %v", status, downgraded)
	}
}
