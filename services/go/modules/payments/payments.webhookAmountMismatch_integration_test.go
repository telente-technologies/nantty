package payments

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/payments/src/generated/ent/paymentintent"
	"nantty/modules/payments/src/generated/ent/webhookevent"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/modules/gateway/services"
)

func TestAnUnderpaidChargeWebhookIsDeadLetteredForFinanceInsteadOfMarkedProcessed(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	token := harness.Tokens.UserAccessToken(uuid.NewString())
	reference := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups", token, "", map[string]any{"returnTo": "https://zudomart.test/pay/return"}).Body["reference"].(string)
	alertsBefore := services.PaymentAlertCount("webhookDeadLettered")
	underpaid := harness.Flutterwave.SeedSuccessfulCharge(reference, 4_000, "NGN")
	body, headers := harness.Flutterwave.ChargeWebhook(underpaid)
	if response := harness.DeliverWebhook(body, headers); response.Status != http.StatusOK {
		t.Fatalf("the provider still gets an acknowledgement: %d %s", response.Status, response.Raw)
	}
	client := harness.Payments.Application.Container.Client(harness.Database)
	event := client.WebhookEvent.Query().Where(webhookevent.Reference(reference)).OnlyX(context.Background())
	if event.DeadLetteredAt == nil || event.ProcessedAt != nil || !strings.Contains(event.LastError, "amount") {
		t.Fatalf("an amount mismatch must land in the dead-letter queue: processed %v dead %v error %q", event.ProcessedAt, event.DeadLetteredAt, event.LastError)
	}
	if services.PaymentAlertCount("webhookDeadLettered")-alertsBefore != 1 {
		t.Fatal("finance is alerted once")
	}
	if status := client.PaymentIntent.Query().Where(paymentintent.Reference(reference)).OnlyX(context.Background()).Status; status != paymentintent.StatusFailed {
		t.Fatalf("the underpaid intent is still recorded as failed: %s", status)
	}
}
