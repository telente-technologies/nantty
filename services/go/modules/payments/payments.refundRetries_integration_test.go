package payments

import (
	"context"
	"database/sql"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent/paymentintent"
	"nantty/modules/payments/src/generated/ent/paymentrefund"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
)

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
