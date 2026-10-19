package payments

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/payments/src/generated/ent/paymentintent"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	"zudomart/modules/payments/src/modules/gateway/models"
)

type verifyOrderPaymentCase struct {
	harness    *paymentstesting.MoneyHarness
	buyer      string
	checkoutId string
	orderIds   []string
	createdAt  time.Time
}

func startVerifyOrderPaymentCase(t *testing.T, orders int) *verifyOrderPaymentCase {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	check := &verifyOrderPaymentCase{harness: harness, buyer: uuid.NewString(), checkoutId: uuid.NewString(), createdAt: time.Now().Add(-time.Hour)}
	var payables []models.OrderPayable
	for range orders {
		orderId := uuid.NewString()
		check.orderIds = append(check.orderIds, orderId)
		payables = append(payables, models.OrderPayable{CheckoutId: check.checkoutId, OrderId: orderId, OrderReference: "ZM-" + orderId[:5], BuyerUserId: check.buyer,
			StoreId: "store-" + orderId[:4], SellerUserId: uuid.NewString(), AmountMinor: 100_000, Currency: "NGN", ProductSummary: "Ankara dress", PaymentMode: "escrow"})
	}
	if err := harness.Payments.Application.Gateway.RegisterCheckoutPayables(context.Background(), payables); err != nil {
		t.Fatal(err)
	}
	return check
}

func (check *verifyOrderPaymentCase) addIntent(subjectId string, status paymentintent.Status) {
	check.harness.T.Helper()
	check.createdAt = check.createdAt.Add(time.Second)
	reference := "zm_ord_" + uuid.NewString()[:18]
	_, err := check.harness.Payments.Application.Container.Client(check.harness.Database).PaymentIntent.Create().SetReference(reference).
		SetPurpose(paymentintent.PurposeOrderCheckout).SetOwnerUserID(check.buyer).SetSubjectID(subjectId).SetProvider("flutterwave").
		SetAmountMinor(200_000).SetCurrency("NGN").SetStatus(status).SetMetadata([]byte(`{}`)).SetCreatedAt(check.createdAt).Save(context.Background())
	if err != nil {
		check.harness.T.Fatal(err)
	}
}

func (check *verifyOrderPaymentCase) verify(orderId, buyer string) (paymentstesting.HarnessResponse, int) {
	before := check.harness.Flutterwave.Calls("GET /transactions")
	response := check.harness.Call(http.MethodPost, "/api/v1/payments/orders/"+orderId+"/verify", check.harness.Tokens.UserAccessToken(buyer), "", nil)
	return response, check.harness.Flutterwave.Calls("GET /transactions") - before
}

func TestVerifyingAnOrderPaymentReportsPaidFromAnySucceededIntentWithoutAskingTheProvider(t *testing.T) {
	check := startVerifyOrderPaymentCase(t, 1)
	check.addIntent(check.checkoutId, paymentintent.StatusSucceeded)
	for range 49 {
		check.addIntent(check.checkoutId, paymentintent.StatusPending)
	}
	response, providerCalls := check.verify(check.orderIds[0], check.buyer)
	if response.Status != http.StatusOK || response.Body["status"] != "paid" || providerCalls != 0 {
		t.Fatalf("the oldest of 50 intents succeeded: %d %s after %d provider calls", response.Status, response.Raw, providerCalls)
	}
}

func TestVerifyingAnOrderPaymentAsksTheProviderAboutOnlyTheNewestPendingIntents(t *testing.T) {
	check := startVerifyOrderPaymentCase(t, 1)
	for range 20 {
		check.addIntent(check.checkoutId, paymentintent.StatusPending)
	}
	response, providerCalls := check.verify(check.orderIds[0], check.buyer)
	if response.Status != http.StatusOK || response.Body["status"] != "pending" || providerCalls > 3 || providerCalls == 0 {
		t.Fatalf("a retry storm must not fan out to the provider: %d %s after %d provider calls", response.Status, response.Raw, providerCalls)
	}
}

func TestVerifyingAnOrderPaymentReportsFailedWhenTheNewestIntentFailed(t *testing.T) {
	check := startVerifyOrderPaymentCase(t, 1)
	check.addIntent(check.checkoutId, paymentintent.StatusPending)
	check.addIntent(check.orderIds[0], paymentintent.StatusFailed)
	if response, _ := check.verify(check.orderIds[0], check.buyer); response.Status != http.StatusOK || response.Body["status"] != "failed" {
		t.Fatalf("the newest attempt failed: %d %s", response.Status, response.Raw)
	}
}

func TestVerifyingSomeoneElsesOrderPaymentIsNotFound(t *testing.T) {
	check := startVerifyOrderPaymentCase(t, 1)
	check.addIntent(check.checkoutId, paymentintent.StatusSucceeded)
	if response, providerCalls := check.verify(check.orderIds[0], uuid.NewString()); response.Status != http.StatusNotFound || providerCalls != 0 {
		t.Fatalf("another buyer must not learn the payment state: %d %s", response.Status, response.Raw)
	}
}

func TestVerifyingTheSecondOrderOfACheckoutUsesItsOwnPayable(t *testing.T) {
	check := startVerifyOrderPaymentCase(t, 2)
	check.addIntent(check.orderIds[0], paymentintent.StatusSucceeded)
	for _, orderId := range check.orderIds {
		if response, _ := check.verify(orderId, check.buyer); response.Status != http.StatusOK {
			t.Fatalf("order %s: %d %s", orderId, response.Status, response.Raw)
		}
	}
	if response, _ := check.verify(check.orderIds[1], check.buyer); response.Body["status"] != "pending" {
		t.Fatalf("a payment made for a sibling order alone does not pay this one: %s", response.Raw)
	}
	check.addIntent(check.checkoutId, paymentintent.StatusSucceeded)
	if response, _ := check.verify(check.orderIds[1], check.buyer); response.Body["status"] != "paid" {
		t.Fatalf("a checkout payment pays every order in it: %s", response.Raw)
	}
}
