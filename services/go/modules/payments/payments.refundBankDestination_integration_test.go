package payments

import (
	"context"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/generated/ent/paymentrefund"
	"zudomart/modules/payments/src/integrations"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	"zudomart/modules/payments/src/interfaces"
)

type bankRefundCountingProvider struct {
	*integrations.FlutterwaveProvider
	retries *atomic.Int64
}

func (provider bankRefundCountingProvider) RetryRefundWithCustomerBankAccount(context.Context, string, interfaces.PayeeBankAccount) error {
	provider.retries.Add(1)
	return nil
}

func startRefundAwaitingBankDetails(t *testing.T) (*paymentstesting.MoneyHarness, string, uuid.UUID, *atomic.Int64, string) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	user := uuid.NewString()
	harness.OnboardConnectedAccount(user, false)
	wallet, err := harness.Payments.Application.Gateway.FindProviderWallet(context.Background(), harness.Database, user)
	if err != nil {
		t.Fatal(err)
	}
	retries := &atomic.Int64{}
	providers := harness.Payments.Application.Container.Providers
	providers["flutterwave"] = bankRefundCountingProvider{FlutterwaveProvider: providers["flutterwave"].(*integrations.FlutterwaveProvider), retries: retries}
	client := harness.Payments.Application.Container.Client(harness.Database)
	intent := client.PaymentIntent.Create().SetReference("zm_ord_" + uuid.NewString()[:18]).SetPurpose(paymentintent.PurposeOrderCheckout).SetOwnerUserID(user).
		SetSubjectID(uuid.NewString()).SetProvider("flutterwave").SetAmountMinor(80_000).SetCurrency("NGN").SetStatus(paymentintent.StatusSucceeded).
		SetMetadata([]byte(`{}`)).SaveX(context.Background())
	refund := client.PaymentRefund.Create().SetPaymentIntentID(intent.ID).SetReference("refund-" + uuid.NewString()[:12]).SetProvider("flutterwave").
		SetAmountMinor(80_000).SetCurrency("NGN").SetStatus(paymentrefund.StatusAwaitingBankDetails).SetProviderRefundID("flw-refund-1").SaveX(context.Background())
	harness.Flutterwave.BankAccountNames["058:0123456789"] = wallet.AccountName
	harness.Flutterwave.BankAccountNames["058:0987654321"] = "CHUKWUEMEKA STRANGER"
	return harness, user, refund.ID, retries, "/api/v1/payments/refunds/" + refund.ID.String() + "/bank-destination"
}

func TestARefundIsSentToABankAccountInTheBuyersOwnNameOnlyOnceUnderConcurrentSubmits(t *testing.T) {
	harness, user, refundId, retries, path := startRefundAwaitingBankDetails(t)
	token := harness.Tokens.UserAccessToken(user)
	submit := func(accountNumber string) paymentstesting.HarnessResponse {
		return harness.Call(http.MethodPost, path, token, "", map[string]any{"bankCode": "058", "accountNumber": accountNumber}, harness.StepUpFor(token))
	}
	if stranger := submit("0987654321"); stranger.Status != http.StatusUnprocessableEntity || stranger.Body["code"] != "REFUND_BANK_NAME_MISMATCH" || retries.Load() != 0 {
		t.Fatalf("a refund must not be redirected to someone else's account: %d %s (%d provider retries)", stranger.Status, stranger.Raw, retries.Load())
	}
	var accepted atomic.Int64
	var group sync.WaitGroup
	for range 5 {
		group.Add(1)
		go func() {
			defer group.Done()
			if response := submit("0123456789"); response.Status == http.StatusOK {
				accepted.Add(1)
			} else if response.Body["code"] != "REFUND_NOT_AWAITING_BANK_DETAILS" {
				t.Errorf("unexpected: %d %s", response.Status, response.Raw)
			}
		}()
	}
	group.Wait()
	if accepted.Load() != 1 || retries.Load() != 1 {
		t.Fatalf("one submit wins and the provider is asked once: accepted %d, provider retries %d", accepted.Load(), retries.Load())
	}
	if status := harness.Payments.Application.Container.Client(harness.Database).PaymentRefund.GetX(context.Background(), refundId).Status; status != paymentrefund.StatusProcessing {
		t.Fatalf("refund status: %s", status)
	}
}
