package payments

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"sync"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/generated/ent/paymentrefund"
	"zudomart/modules/payments/src/generated/ent/webhookevent"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
)

func startPaidCardVerification(t *testing.T, harness *paymentstesting.MoneyHarness) (string, *paymentstesting.FakeTransaction) {
	t.Helper()
	token := harness.Tokens.UserAccessToken(uuid.NewString())
	started := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups", token, "", map[string]any{"returnTo": "https://zudomart.test/pay/return"})
	if started.Status != http.StatusCreated {
		t.Fatalf("setup: %d %s", started.Status, started.Raw)
	}
	reference := started.Body["reference"].(string)
	return reference, harness.Paystack.CompleteCheckout(reference, 0, 0, "card")
}

func webhookRow(t *testing.T, harness *paymentstesting.MoneyHarness, reference string) *ent.WebhookEvent {
	t.Helper()
	row, err := harness.Payments.Application.Container.Client(harness.Database).WebhookEvent.Query().Where(webhookevent.Reference(reference)).Only(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func TestWebhookDeliveredTwiceAndConcurrentlyIsProcessedOnce(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	reference, transaction := startPaidCardVerification(t, harness)
	body, headers := harness.Paystack.SignWebhook("charge.success", map[string]any{"id": transaction.Id, "reference": reference, "status": "success", "amount": transaction.AmountMinor, "currency": "NGN"})
	var group sync.WaitGroup
	for range 6 {
		group.Add(1)
		go func() {
			defer group.Done()
			if response := harness.Call(http.MethodPost, "/webhooks/paystack", "", "", body, headers); response.Status != http.StatusOK {
				t.Errorf("delivery: %d %s", response.Status, response.Raw)
			}
		}()
	}
	group.Wait()
	row := webhookRow(t, harness, reference)
	if row.ProcessedAt == nil || row.AttemptCount != 1 || row.LeaseToken != "" {
		t.Fatalf("one claim must process the event exactly once: processed=%v attempts=%d lease=%q", row.ProcessedAt, row.AttemptCount, row.LeaseToken)
	}
	if refunds := len(harness.Paystack.Refunds); refunds != 1 {
		t.Fatalf("the verification charge must be refunded once, got %d refunds", refunds)
	}
}

func TestSweeperRacingARedeliveryNeverDoubleProcesses(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	container := harness.Payments.Application.Container
	gateway := harness.Payments.Application.Gateway
	container.Settings.ProcessWebhooksInBackground = true
	reference, transaction := startPaidCardVerification(t, harness)
	body, headers := harness.Paystack.SignWebhook("charge.success", map[string]any{"id": transaction.Id, "reference": reference, "status": "success", "amount": transaction.AmountMinor, "currency": "NGN"})
	if response := harness.Call(http.MethodPost, "/webhooks/paystack", "", "", body, headers); response.Status != http.StatusOK || response.Body["duplicate"] == true {
		t.Fatalf("first delivery: %d %s", response.Status, response.Raw)
	}
	verifiesBefore := harness.Paystack.CallCount("GET /transaction")
	var group sync.WaitGroup
	for index := range 8 {
		group.Add(1)
		go func() {
			defer group.Done()
			if index%2 == 0 {
				gateway.ProcessDueWebhooks(context.Background(), 10)
				return
			}
			if response := harness.Call(http.MethodPost, "/webhooks/paystack", "", "", body, headers); response.Body["duplicate"] != true {
				t.Errorf("a redelivery must be recorded as a duplicate: %s", response.Raw)
			}
		}()
	}
	group.Wait()
	row := webhookRow(t, harness, reference)
	if row.ProcessedAt == nil || row.AttemptCount != 1 {
		t.Fatalf("sweepers and redeliveries must not double-process: processed=%v attempts=%d", row.ProcessedAt, row.AttemptCount)
	}
	if verifies := harness.Paystack.CallCount("GET /transaction") - verifiesBefore; verifies != 1 {
		t.Fatalf("the charge must be verified once, got %d verifications", verifies)
	}
	if processed := gateway.ProcessDueWebhooks(context.Background(), 10); processed != 0 {
		t.Fatalf("a processed event must never be claimed again, claimed %d", processed)
	}
}

func TestFailingWebhookIsRetriedWithBackoffThenDeadLettered(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	container := harness.Payments.Application.Container
	gateway := harness.Payments.Application.Gateway
	container.Settings.ProcessWebhooksInBackground = true
	reference, transaction := startPaidCardVerification(t, harness)
	body, headers := harness.Paystack.SignWebhook("charge.success", map[string]any{"id": transaction.Id, "reference": reference, "status": "success", "amount": transaction.AmountMinor, "currency": "NGN"})
	harness.Call(http.MethodPost, "/webhooks/paystack", "", "", body, headers)
	client := container.Client(harness.Database)
	for attempt := 1; attempt <= paymentservices.MaximumWebhookAttempts; attempt++ {
		harness.Paystack.FailNextRequests = 3
		if claimed := gateway.ProcessDueWebhooks(context.Background(), 10); claimed != 1 {
			t.Fatalf("attempt %d: claimed %d", attempt, claimed)
		}
		row := webhookRow(t, harness, reference)
		if row.ProcessedAt != nil || row.AttemptCount != attempt || row.LastError == "" {
			t.Fatalf("attempt %d: %+v", attempt, row)
		}
		if attempt < paymentservices.MaximumWebhookAttempts {
			if row.NextAttemptAt == nil || !row.NextAttemptAt.After(container.Now()) {
				t.Fatalf("attempt %d must back off: %v", attempt, row.NextAttemptAt)
			}
			if again := gateway.ProcessDueWebhooks(context.Background(), 10); again != 0 {
				t.Fatalf("attempt %d: an event in backoff was claimed early", attempt)
			}
			if err := client.WebhookEvent.UpdateOneID(row.ID).SetNextAttemptAt(container.Now().Add(-1)).Exec(context.Background()); err != nil {
				t.Fatal(err)
			}
		}
	}
	row := webhookRow(t, harness, reference)
	if row.DeadLetteredAt == nil {
		t.Fatalf("after %d failures the event is dead-lettered: %+v", paymentservices.MaximumWebhookAttempts, row)
	}
	if claimed := gateway.ProcessDueWebhooks(context.Background(), 10); claimed != 0 {
		t.Fatal("a dead letter must not be retried automatically")
	}
}

func TestRefundFailingThenRetriedReleasesCapacityAndPaysOnce(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	gateway := harness.Payments.Application.Gateway
	client := harness.Payments.Application.Container.Client(harness.Database)
	ctx := context.Background()
	reference, transaction := startPaidCardVerification(t, harness)
	harness.DeliverPaystackEvent("charge.success", map[string]any{"id": transaction.Id, "reference": reference, "status": "success", "amount": transaction.AmountMinor, "currency": "NGN"})
	intent, err := client.PaymentIntent.Query().Where(paymentintent.Reference(reference)).Only(ctx)
	if err != nil || intent.Status != paymentintent.StatusSucceeded {
		t.Fatalf("intent: %+v %v", intent, err)
	}
	first, err := client.PaymentRefund.Query().Where(paymentrefund.PaymentIntentID(intent.ID)).Only(ctx)
	if err != nil || first.ProviderRefundID == "" {
		t.Fatalf("the automatic refund must have been sent: %+v %v", first, err)
	}
	if err := gateway.HandleRefundNotification(ctx, interfaces.WebhookNotification{EventType: "refund.failed", Status: "failed", ProviderObjectId: first.ProviderRefundID}); err != nil {
		t.Fatal(err)
	}
	intent = client.PaymentIntent.GetX(ctx, intent.ID)
	if intent.RefundedMinor != 0 || intent.RefundInFlightMinor != 0 {
		t.Fatalf("a failed refund must release its capacity: refunded=%d inFlight=%d", intent.RefundedMinor, intent.RefundInFlightMinor)
	}
	request := func(refundReference string) (paymentservices.RequestedRefund, error) {
		var requested paymentservices.RequestedRefund
		err := databases.RunInMoneyTransaction(ctx, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
			var err error
			requested, err = gateway.RequestRefundInTransaction(ctx, transaction, models.RefundRequest{PaymentIntentId: intent.ID, AmountMinor: intent.AmountMinor, Currency: intent.Currency, Reference: refundReference, Reason: "retry"})
			return err
		})
		return requested, err
	}
	retried, err := request("refund-retry-" + uuid.NewString())
	if err != nil {
		t.Fatalf("the retry must fit the released capacity: %v", err)
	}
	if _, err := request("refund-extra-" + uuid.NewString()); !errors.Is(err, paymentservices.ErrRefundExceedsPayment) {
		t.Fatalf("an in-flight refund must hold its capacity: %v", err)
	}
	if err := gateway.SendPendingRefundToProvider(ctx, retried.RefundId); err != nil {
		t.Fatal(err)
	}
	sent := client.PaymentRefund.GetX(ctx, retried.RefundId)
	if err := gateway.HandleRefundNotification(ctx, interfaces.WebhookNotification{EventType: "refund.processed", Status: "processed", ProviderObjectId: sent.ProviderRefundID}); err != nil {
		t.Fatal(err)
	}
	intent = client.PaymentIntent.GetX(ctx, intent.ID)
	if intent.RefundedMinor != intent.AmountMinor || intent.RefundInFlightMinor != 0 {
		t.Fatalf("refunded=%d inFlight=%d amount=%d", intent.RefundedMinor, intent.RefundInFlightMinor, intent.AmountMinor)
	}
	if _, err := request("refund-after-" + uuid.NewString()); !errors.Is(err, paymentservices.ErrRefundExceedsPayment) {
		t.Fatalf("a fully refunded payment has no capacity left: %v", err)
	}
	assertLedgerHealthy(t, harness)
}
