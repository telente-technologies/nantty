package payments

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/payments/src/generated/ent/paymentintent"
	"nantty/modules/payments/src/generated/ent/webhookevent"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/modules/gateway/models"
)

func startMoneySafetyCardSetup(t *testing.T, harness *paymentstesting.MoneyHarness) string {
	t.Helper()
	response := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups", harness.Tokens.UserAccessToken(uuid.NewString()), "", map[string]any{
		"returnTo": "https://nantty.test/pay/return",
	})
	if response.Status != http.StatusCreated {
		t.Fatalf("start card setup: %d %s", response.Status, response.Raw)
	}
	return response.Body["reference"].(string)
}

func TestProviderFeeAboveChargeIsHeldForFinanceWithoutSettlement(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	harness.Payments.Application.Container.Settings.ProcessWebhooksInBackground = true
	reference := startMoneySafetyCardSetup(t, harness)
	charge := harness.Flutterwave.SeedSuccessfulCharge(reference, 5_000, "NGN")
	charge.AppFeeMinor = 5_001
	body, headers := harness.Flutterwave.ChargeWebhook(charge)
	if response := harness.DeliverWebhook(body, headers); response.Status != http.StatusOK {
		t.Fatalf("provider webhook acknowledgement: %d %s", response.Status, response.Raw)
	}
	if processed := harness.Payments.Application.Gateway.ProcessDueWebhooks(context.Background(), 10); processed == 0 {
		t.Fatal("expected the queued charge webhook to be processed")
	}
	client := harness.Payments.Application.Container.Client(harness.Database)
	intent := client.PaymentIntent.Query().Where(paymentintent.Reference(reference)).OnlyX(context.Background())
	if intent.Status != paymentintent.StatusPending || intent.ProviderFeeMinor != 0 {
		t.Fatalf("invalid provider rebate changed intent: status=%s fee=%d", intent.Status, intent.ProviderFeeMinor)
	}
	event := client.WebhookEvent.Query().Where(webhookevent.Reference(reference)).OnlyX(context.Background())
	if event.DeadLetteredAt == nil || event.ProcessedAt != nil {
		t.Fatalf("invalid provider fee must be held for finance: dead=%v processed=%v error=%q", event.DeadLetteredAt, event.ProcessedAt, event.LastError)
	}
}

func TestCheckoutPayableRegistrationRejectsInvalidAmountsAndCurrencies(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	base := models.OrderPayable{CheckoutId: uuid.NewString(), OrderId: uuid.NewString(), BuyerUserId: uuid.NewString(), StoreId: "store", SellerUserId: uuid.NewString(), AmountMinor: 10_000, Currency: "NGN"}
	cases := []struct {
		name string
		rows []models.OrderPayable
	}{
		{name: "zero amount", rows: []models.OrderPayable{{CheckoutId: base.CheckoutId, OrderId: base.OrderId, BuyerUserId: base.BuyerUserId, StoreId: base.StoreId, SellerUserId: base.SellerUserId, AmountMinor: 0, Currency: "NGN"}}},
		{name: "negative amount", rows: []models.OrderPayable{{CheckoutId: base.CheckoutId, OrderId: base.OrderId, BuyerUserId: base.BuyerUserId, StoreId: base.StoreId, SellerUserId: base.SellerUserId, AmountMinor: -1, Currency: "NGN"}}},
		{name: "malformed currency", rows: []models.OrderPayable{{CheckoutId: base.CheckoutId, OrderId: base.OrderId, BuyerUserId: base.BuyerUserId, StoreId: base.StoreId, SellerUserId: base.SellerUserId, AmountMinor: 10_000, Currency: "N1N"}}},
		{name: "mixed currencies", rows: []models.OrderPayable{base, {CheckoutId: base.CheckoutId, OrderId: uuid.NewString(), BuyerUserId: base.BuyerUserId, StoreId: base.StoreId, SellerUserId: base.SellerUserId, AmountMinor: 10_000, Currency: "USD"}}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			if err := harness.Payments.Application.Gateway.RegisterCheckoutPayables(context.Background(), test.rows); err == nil {
				t.Fatal("invalid checkout money must be rejected before persistence")
			}
		})
	}
}

func TestLateChargeWithDifferentAmountIsNotRecordedOrRefunded(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	harness.Payments.Application.Container.Settings.ProcessWebhooksInBackground = true
	reference := startMoneySafetyCardSetup(t, harness)
	client := harness.Payments.Application.Container.Client(harness.Database)
	intent := client.PaymentIntent.Query().Where(paymentintent.Reference(reference)).OnlyX(context.Background())
	if _, err := intent.Update().SetStatus(paymentintent.StatusCancelled).Save(context.Background()); err != nil {
		t.Fatal(err)
	}
	charge := harness.Flutterwave.SeedSuccessfulCharge(reference, 4_999, "NGN")
	body, headers := harness.Flutterwave.ChargeWebhook(charge)
	if response := harness.DeliverWebhook(body, headers); response.Status != http.StatusOK {
		t.Fatalf("provider webhook acknowledgement: %d %s", response.Status, response.Raw)
	}
	if processed := harness.Payments.Application.Gateway.ProcessDueWebhooks(context.Background(), 10); processed == 0 {
		t.Fatal("expected the queued late-charge webhook to be processed")
	}
	client = harness.Payments.Application.Container.Client(harness.Database)
	current := client.PaymentIntent.Query().Where(paymentintent.Reference(reference)).OnlyX(context.Background())
	if current.Status != paymentintent.StatusCancelled {
		t.Fatalf("mismatched late charge changed intent status: %s", current.Status)
	}
	if count := client.PaymentIntent.Query().Where(paymentintent.SubjectID(intent.SubjectID)).CountX(context.Background()); count != 1 {
		t.Fatalf("mismatched late charge created another payment intent: count=%d", count)
	}
	event := client.WebhookEvent.Query().Where(webhookevent.Reference(reference)).OnlyX(context.Background())
	if event.DeadLetteredAt == nil || event.ProcessedAt != nil {
		t.Fatalf("mismatched late charge must be held for finance: dead=%v processed=%v error=%q", event.DeadLetteredAt, event.ProcessedAt, event.LastError)
	}
	if refunds := harness.Flutterwave.RefundAmountsMinor(); len(refunds) != 0 {
		t.Fatalf("unverified late charge was refunded: %v", refunds)
	}
}
