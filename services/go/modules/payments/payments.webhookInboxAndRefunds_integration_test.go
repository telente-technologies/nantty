package payments

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/paymentintent"
	"nantty/modules/payments/src/generated/ent/paymentrefund"
	"nantty/modules/payments/src/generated/ent/webhookevent"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
)

func startPaidCardVerification(t *testing.T, harness *paymentstesting.MoneyHarness) (string, *paymentstesting.FakeFlwTransaction) {
	t.Helper()
	token := harness.Tokens.UserAccessToken(uuid.NewString())
	started := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups", token, "", map[string]any{"returnTo": "https://nantty.test/pay/return"})
	if started.Status != http.StatusCreated {
		t.Fatalf("setup: %d %s", started.Status, started.Raw)
	}
	reference := started.Body["reference"].(string)
	return reference, harness.Flutterwave.CompleteCheckout(reference, 0, 0, "card")
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
	body, headers := harness.Flutterwave.ChargeWebhook(transaction)
	var group sync.WaitGroup
	for range 6 {
		group.Add(1)
		go func() {
			defer group.Done()
			if response := harness.Call(http.MethodPost, "/webhooks/flutterwave", "", "", body, headers); response.Status != http.StatusOK {
				t.Errorf("delivery: %d %s", response.Status, response.Raw)
			}
		}()
	}
	group.Wait()
	row := webhookRow(t, harness, reference)
	if row.ProcessedAt == nil || row.AttemptCount != 1 || row.LeaseToken != "" {
		t.Fatalf("one claim must process the event exactly once: processed=%v attempts=%d lease=%q", row.ProcessedAt, row.AttemptCount, row.LeaseToken)
	}
	if refunds := len(harness.Flutterwave.Refunds); refunds != 1 {
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
	body, headers := harness.Flutterwave.ChargeWebhook(transaction)
	if response := harness.Call(http.MethodPost, "/webhooks/flutterwave", "", "", body, headers); response.Status != http.StatusOK || response.Body["duplicate"] == true {
		t.Fatalf("first delivery: %d %s", response.Status, response.Raw)
	}
	verifiesBefore := harness.Flutterwave.CallCount("GET /transactions")
	var group sync.WaitGroup
	for index := range 8 {
		group.Add(1)
		go func() {
			defer group.Done()
			if index%2 == 0 {
				gateway.ProcessDueWebhooks(context.Background(), 10)
				return
			}
			if response := harness.Call(http.MethodPost, "/webhooks/flutterwave", "", "", body, headers); response.Body["duplicate"] != true {
				t.Errorf("a redelivery must be recorded as a duplicate: %s", response.Raw)
			}
		}()
	}
	group.Wait()
	row := webhookRow(t, harness, reference)
	if row.ProcessedAt == nil || row.AttemptCount != 1 {
		t.Fatalf("sweepers and redeliveries must not double-process: processed=%v attempts=%d", row.ProcessedAt, row.AttemptCount)
	}
	if verifies := harness.Flutterwave.CallCount("GET /transactions") - verifiesBefore; verifies != 1 {
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
	body, headers := harness.Flutterwave.ChargeWebhook(transaction)
	harness.Call(http.MethodPost, "/webhooks/flutterwave", "", "", body, headers)
	client := container.Client(harness.Database)
	for attempt := 1; attempt <= paymentservices.MaximumWebhookAttempts; attempt++ {
		harness.Flutterwave.FailNextRequests = 3
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
	harness.Flutterwave.RefundStatus = "pending"
	reference, transaction := startPaidCardVerification(t, harness)
	harness.DeliverWebhook(harness.Flutterwave.ChargeWebhook(transaction))
	intent, err := client.PaymentIntent.Query().Where(paymentintent.Reference(reference)).Only(ctx)
	if err != nil || intent.Status != paymentintent.StatusSucceeded {
		t.Fatalf("intent: %+v %v", intent, err)
	}
	first, err := client.PaymentRefund.Query().Where(paymentrefund.PaymentIntentID(intent.ID)).Only(ctx)
	if err != nil || first.ProviderRefundID == "" {
		t.Fatalf("the automatic refund must have been sent: %+v %v", first, err)
	}
	harness.Flutterwave.MarkRefundFailed(first.ProviderRefundID)
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

func TestRetryRecoversRefundClaimInterruptedBeforeProviderCall(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	ctx := context.Background()
	container := harness.Payments.Application.Container
	client := container.Client(harness.Database)
	charge := harness.Flutterwave.SeedSuccessfulCharge("charge-"+uuid.NewString(), 5_000, "NGN")
	intent := client.PaymentIntent.Create().SetReference("zm_ord_" + uuid.NewString()[:18]).SetPurpose(paymentintent.PurposeOrderCheckout).
		SetOwnerUserID(uuid.NewString()).SetSubjectID(uuid.NewString()).SetProvider("flutterwave").SetProviderTransactionID(strconv.FormatInt(charge.Id, 10)).
		SetAmountMinor(5_000).SetRefundInFlightMinor(5_000).SetCurrency("NGN").SetStatus(paymentintent.StatusSucceeded).
		SetMetadata([]byte(`{}`)).SaveX(ctx)
	refund := client.PaymentRefund.Create().SetPaymentIntentID(intent.ID).SetReference("refund-" + uuid.NewString()[:12]).
		SetProvider("flutterwave").SetAmountMinor(5_000).SetCurrency("NGN").SetFullRefund(true).
		SetStatus(paymentrefund.StatusProcessing).SetAttemptCount(1).SetCreatedAt(container.Now().Add(-time.Hour)).
		SetUpdatedAt(container.Now().Add(-11 * time.Minute)).SaveX(ctx)

	if retried := harness.Payments.Application.Gateway.RetryPendingRefunds(ctx, 10); retried != 1 {
		t.Fatalf("the interrupted claim should be recovered once, got %d retries", retried)
	}
	refund = client.PaymentRefund.GetX(ctx, refund.ID)
	intent = client.PaymentIntent.GetX(ctx, intent.ID)
	if refund.Status != paymentrefund.StatusSucceeded || refund.AttemptCount != 2 || refund.ProviderRefundID == "" {
		t.Fatalf("recovered refund should reconcile and complete: status=%s attempts=%d providerRefundId=%q", refund.Status, refund.AttemptCount, refund.ProviderRefundID)
	}
	if intent.RefundedMinor != 5_000 || intent.RefundInFlightMinor != 0 {
		t.Fatalf("refund accounting mismatch after recovery: refunded=%d inFlight=%d", intent.RefundedMinor, intent.RefundInFlightMinor)
	}
	if refunds := harness.Flutterwave.RefundAmountsMinor(); len(refunds) != 1 || refunds[0] != 5_000 {
		t.Fatalf("recovery should issue exactly one provider refund, got %v", refunds)
	}
	if lookups := harness.Flutterwave.CallCount("GET /refunds"); lookups != 1 {
		t.Fatalf("recovery must reconcile against the provider before submission, got %d lookups", lookups)
	}
}

func TestRetryReconcilesProviderRefundAcceptedBeforeProcessCrash(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	ctx := context.Background()
	container := harness.Payments.Application.Container
	client := container.Client(harness.Database)
	charge := harness.Flutterwave.SeedSuccessfulCharge("charge-"+uuid.NewString(), 5_000, "NGN")
	intentReference := "zm_ord_" + uuid.NewString()[:18]
	intent := client.PaymentIntent.Create().SetReference(intentReference).SetPurpose(paymentintent.PurposeOrderCheckout).
		SetOwnerUserID(uuid.NewString()).SetSubjectID(uuid.NewString()).SetProvider("flutterwave").SetProviderTransactionID(strconv.FormatInt(charge.Id, 10)).
		SetAmountMinor(5_000).SetRefundInFlightMinor(5_000).SetCurrency("NGN").SetStatus(paymentintent.StatusSucceeded).
		SetMetadata([]byte(`{}`)).SaveX(ctx)
	refundReference := "refund-" + uuid.NewString()[:12]
	provider, err := container.Provider("flutterwave")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := provider.RefundCharge(ctx, interfaces.RefundRequest{
		ProviderChargeId: strconv.FormatInt(charge.Id, 10), ChargeReference: intentReference,
		RefundReference: refundReference, AmountMinor: 5_000, Currency: "NGN", FullRefund: true,
	}); err != nil {
		t.Fatalf("simulate provider accepting the refund before the process crashes: %v", err)
	}
	refund := client.PaymentRefund.Create().SetPaymentIntentID(intent.ID).SetReference(refundReference).
		SetProvider("flutterwave").SetAmountMinor(5_000).SetCurrency("NGN").SetFullRefund(true).
		SetStatus(paymentrefund.StatusProcessing).SetAttemptCount(1).SetCreatedAt(container.Now().Add(-time.Hour)).
		SetUpdatedAt(container.Now().Add(-11 * time.Minute)).SaveX(ctx)

	if retried := harness.Payments.Application.Gateway.RetryPendingRefunds(ctx, 10); retried != 1 {
		t.Fatalf("the interrupted claim should be recovered once, got %d retries", retried)
	}
	refund = client.PaymentRefund.GetX(ctx, refund.ID)
	intent = client.PaymentIntent.GetX(ctx, intent.ID)
	if refund.Status != paymentrefund.StatusSucceeded || refund.AttemptCount != 2 || refund.ProviderRefundID == "" {
		t.Fatalf("recovered refund should reconcile and complete: status=%s attempts=%d providerRefundId=%q", refund.Status, refund.AttemptCount, refund.ProviderRefundID)
	}
	if intent.RefundedMinor != 5_000 || intent.RefundInFlightMinor != 0 {
		t.Fatalf("refund accounting mismatch after recovery: refunded=%d inFlight=%d", intent.RefundedMinor, intent.RefundInFlightMinor)
	}
	if refunds := harness.Flutterwave.RefundAmountsMinor(); len(refunds) != 1 || refunds[0] != 5_000 {
		t.Fatalf("recovery must not submit a duplicate provider refund, got %v", refunds)
	}
	if lookups := harness.Flutterwave.CallCount("GET /refunds"); lookups != 1 {
		t.Fatalf("recovery must reconcile against the provider before resubmission, got %d lookups", lookups)
	}
	if submissions := harness.Flutterwave.CallCount("POST /transactions"); submissions != 1 {
		t.Fatalf("provider refund should have been submitted only once, got %d submissions", submissions)
	}
}

func TestConcurrentRefundReferenceReplaysAfterPaymentLock(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	ctx := context.Background()
	intent, err := harness.Payments.Application.Container.Client(harness.Database).PaymentIntent.Create().
		SetReference("zm_ord_" + uuid.NewString()[:18]).SetPurpose(paymentintent.PurposeOrderCheckout).
		SetOwnerUserID(uuid.NewString()).SetSubjectID(uuid.NewString()).SetProvider("flutterwave").
		SetAmountMinor(5_000).SetCurrency("NGN").SetStatus(paymentintent.StatusSucceeded).
		SetMetadata([]byte(`{}`)).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	refundReference := "refund-concurrent-" + uuid.NewString()
	start := make(chan struct{})
	type result struct {
		requested paymentservices.RequestedRefund
		err       error
	}
	results := make(chan result, 2)
	for range 2 {
		go func() {
			<-start
			var requested paymentservices.RequestedRefund
			err := databases.RunInMoneyTransaction(ctx, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
				var err error
				requested, err = harness.Payments.Application.Gateway.RequestRefundInTransaction(ctx, transaction, models.RefundRequest{
					PaymentIntentId: intent.ID, AmountMinor: intent.AmountMinor, Currency: intent.Currency,
					Reference: refundReference, Reason: "same request",
				})
				return err
			})
			results <- result{requested: requested, err: err}
		}()
	}
	close(start)
	first, second := <-results, <-results
	if first.err != nil || second.err != nil {
		t.Fatalf("both equivalent refund requests should succeed: first=%v second=%v", first.err, second.err)
	}
	if first.requested.RefundId != second.requested.RefundId {
		t.Fatalf("concurrent retries must return the same refund: %s != %s", first.requested.RefundId, second.requested.RefundId)
	}
	if first.requested.Replayed == second.requested.Replayed {
		t.Fatalf("exactly one request should create the refund and the other replay it: first=%+v second=%+v", first.requested, second.requested)
	}
	refunds, err := harness.Payments.Application.Container.Client(harness.Database).PaymentRefund.Query().
		Where(paymentrefund.Reference(refundReference)).All(ctx)
	if err != nil || len(refunds) != 1 {
		t.Fatalf("expected exactly one refund row, got %d: %v", len(refunds), err)
	}
}
