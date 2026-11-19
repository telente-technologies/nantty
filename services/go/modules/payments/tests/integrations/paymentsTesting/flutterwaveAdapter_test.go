package paymentstesting_test

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"testing"
	"time"

	"nantty/modules/payments/src/integrations"
	"nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/integrations/providerHttp"
	"nantty/modules/payments/src/interfaces"
)

func newFakeFlutterwaveAdapter(t *testing.T) (*paymentstesting.FakeFlutterwave, *integrations.FlutterwaveProvider) {
	t.Helper()
	fake := paymentstesting.StartFakeFlutterwave(t)
	settings := fake.Settings()
	settings.RetryBaseDelay = time.Millisecond
	return fake, integrations.NewFlutterwaveProvider(settings)
}

func TestFlutterwaveCheckoutIsHashedAndVerifiedByIdWithTheExactReference(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	session, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "chk-abc", AmountMinor: 250_050, Currency: "NGN", CustomerEmail: "Buyer@Nantty.test", SuccessUrl: "https://nantty.test/pay/return"})
	if err != nil || !strings.Contains(session.CheckoutUrl, "/hosted/pay/chk-abc") {
		t.Fatalf("checkout: %v %+v", err, session)
	}
	paid := fake.CompleteCheckout("chk-abc", 0, 3_500, "card")
	if _, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "chk-other", AmountMinor: 100, Currency: "NGN", CustomerEmail: "x@nantty.test"}); err != nil {
		t.Fatal(err)
	}
	other := fake.TransactionByReference("chk-other")
	verified, err := adapter.VerifyCharge(ctx, interfaces.ChargeLookup{Reference: "chk-abc", ProviderChargeId: itoa(other.Id)})
	if err != nil || verified.Reference != "chk-abc" || verified.AmountMinor != 250_050 || verified.ProviderFeeMinor != 3_500 || verified.Outcome != interfaces.OutcomeSucceeded {
		t.Fatalf("a charge id from another reference must fall back to the reference lookup: %v %+v", err, verified)
	}
	if verified.ProviderChargeId != itoa(paid.Id) || verified.CustomerEmail != "buyer@nantty.test" || verified.Authorization == nil || !strings.HasPrefix(verified.Authorization.AuthorizationCode, "flw-t") {
		t.Fatalf("verification details: %+v", verified)
	}
	fake.RejectPayloadHash = true
	if _, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "chk-tampered", AmountMinor: 100, Currency: "NGN", CustomerEmail: "x@nantty.test"}); err == nil {
		t.Fatal("a rejected payload hash must fail the checkout")
	}
}

func TestFlutterwaveCheckoutValidatesAndNormalizesCurrencyBeforeProviderIO(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	for _, currency := range []string{"EUR", "N?N"} {
		if _, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "invalid-currency-" + currency, AmountMinor: 10_000, Currency: currency, CustomerEmail: "buyer@nantty.test"}); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
			t.Errorf("currency %q should be rejected as unsupported: %v", currency, err)
		}
	}
	if calls := len(fake.RequestLog()); calls != 0 {
		t.Fatalf("invalid checkout currencies must fail before provider I/O, got %d requests", calls)
	}

	request := interfaces.ChargeRequest{Reference: "normalized-currency-checkout", AmountMinor: 10_000, Currency: " ngn ", CustomerEmail: "buyer@nantty.test"}
	if _, err := adapter.InitializeCharge(ctx, request); err != nil {
		t.Fatalf("a configured lowercase currency should be normalized: %v", err)
	}
	fake.CompleteCheckout(request.Reference, 0, 0, "card")
	transaction := fake.TransactionByReference(request.Reference)
	if transaction == nil || transaction.Currency != "NGN" || transaction.AmountMinor != request.AmountMinor {
		t.Fatalf("the provider must receive the normalized code and exact amount: %+v", transaction)
	}
}

func TestFlutterwavePartialRefundValidatesAmountAndCurrencyBeforeProviderIO(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	if _, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "partial-refund-charge", AmountMinor: 20_000, Currency: "NGN", CustomerEmail: "buyer@nantty.test"}); err != nil {
		t.Fatal(err)
	}
	transaction := fake.CompleteCheckout("partial-refund-charge", 0, 0, "card")
	requestsBeforeInvalid := len(fake.RequestLog())
	for _, request := range []interfaces.RefundRequest{
		{ProviderChargeId: "7001", AmountMinor: 0, Currency: "NGN"},
		{ProviderChargeId: "7001", AmountMinor: -1, Currency: "NGN", FullRefund: true},
		{ProviderChargeId: "7001", AmountMinor: 10_000, Currency: "EUR"},
		{ProviderChargeId: "7001", AmountMinor: 5_000, Currency: "EUR", FullRefund: true},
		{ChargeReference: "charge-ref", AmountMinor: 12_345, Currency: "NGN"},
		{ProviderChargeId: "7001", AmountMinor: 9_999, Currency: "NGN"},
		{ProviderChargeId: "7001", AmountMinor: 999, Currency: "KES"},
		{ChargeReference: "charge-ref", AmountMinor: 100, Currency: "N?N"},
	} {
		if _, err := adapter.RefundCharge(ctx, request); err == nil {
			t.Errorf("invalid refund must fail before provider I/O: %+v", request)
		}
	}
	if calls := len(fake.RequestLog()); calls != requestsBeforeInvalid {
		t.Fatalf("invalid refunds must not verify or refund through provider I/O, got %d new requests", calls-requestsBeforeInvalid)
	}

	request := interfaces.RefundRequest{ProviderChargeId: strconv.FormatInt(transaction.Id, 10), AmountMinor: 12_300, Currency: " ngn ", RefundReference: "partial-refund", Reason: "test"}
	if _, err := adapter.RefundCharge(ctx, request); err != nil {
		t.Fatalf("valid normalized partial refund should be accepted: %v", err)
	}
	if len(fake.Refunds) != 1 || fmt.Sprint(fake.Refunds[0]["amount_refunded"]) != "123.00" {
		t.Fatalf("refund amount should preserve minor-unit value after currency normalization: %+v", fake.Refunds)
	}
	small := fake.SeedSuccessfulCharge("full-refund-50-ngn", 5_000, "NGN")
	if _, err := adapter.RefundCharge(ctx, interfaces.RefundRequest{ProviderChargeId: strconv.FormatInt(small.Id, 10), AmountMinor: 5_000, Currency: "NGN", FullRefund: true, RefundReference: "full-50", Reason: "card check"}); err != nil {
		t.Fatalf("full refund of a small verification charge must not require partial minimum: %v", err)
	}
	byReference := fake.SeedSuccessfulCharge("full-refund-by-ref", 15_000, "NGN")
	if _, err := adapter.RefundCharge(ctx, interfaces.RefundRequest{ChargeReference: byReference.TxRef, FullRefund: true, RefundReference: "full-ref", Reason: "billing"}); err != nil {
		t.Fatalf("full refund by charge reference without explicit amount must succeed: %v", err)
	}
}

func TestFlutterwaveCardTokenOnlyChargesTheEmailItWasIssuedTo(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	if _, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "csub-1", AmountMinor: 500_000, Currency: "NGN", CustomerEmail: "owner@nantty.test"}); err != nil {
		t.Fatal(err)
	}
	token := fake.CompleteCheckout("csub-1", 0, 0, "card").CardToken
	_, err := adapter.ChargeAuthorization(ctx, interfaces.AuthorizationChargeRequest{AuthorizationCode: token, CustomerEmail: "thief@nantty.test", Reference: "ren-1", AmountMinor: 500_000, Currency: "NGN"})
	if !errors.Is(err, interfaces.ErrSavedCardNotForCustomer) {
		t.Fatalf("a token must not charge another email: %v", err)
	}
	result, err := adapter.ChargeAuthorization(ctx, interfaces.AuthorizationChargeRequest{AuthorizationCode: token, CustomerEmail: "owner@nantty.test", Reference: "ren-2", AmountMinor: 500_000, Currency: "NGN"})
	if err != nil || result.ProviderChargeId == "" || result.Outcome != interfaces.OutcomePending {
		t.Fatalf("token charge must succeed and still be verified: %v %+v", err, result)
	}
	fake.LoseNextWriteReply(paymentstesting.FakeWriteCharge)
	lost, err := adapter.ChargeAuthorization(ctx, interfaces.AuthorizationChargeRequest{AuthorizationCode: token, CustomerEmail: "owner@nantty.test", Reference: "ren-3", AmountMinor: 500_000, Currency: "NGN"})
	if err != nil || lost.Outcome != interfaces.OutcomePending {
		t.Fatalf("a lost reply must stay pending: %v %+v", err, lost)
	}
	if calls := fake.Calls("POST /tokenized-charges"); calls != 3 {
		t.Fatalf("a tokenized charge must never be retried, got %d posts", calls)
	}
}

func TestFlutterwaveTokenizedChargeValidatesAndNormalizesCurrencyBeforeProviderIO(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	if _, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "token-currency-seed", AmountMinor: 100_000, Currency: "NGN", CustomerEmail: "owner@nantty.test"}); err != nil {
		t.Fatal(err)
	}
	token := fake.CompleteCheckout("token-currency-seed", 0, 0, "card").CardToken
	unsupported := interfaces.AuthorizationChargeRequest{AuthorizationCode: token, CustomerEmail: "owner@nantty.test", Reference: "token-currency-disabled", AmountMinor: 100_000, Currency: "EUR"}
	if _, err := adapter.ChargeAuthorization(ctx, unsupported); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		t.Fatalf("a disabled tokenized-charge currency must be rejected: %v", err)
	}
	if calls := fake.Calls("POST /tokenized-charges"); calls != 0 {
		t.Fatalf("a disabled tokenized-charge currency must fail before provider I/O, got %d posts", calls)
	}

	request := interfaces.AuthorizationChargeRequest{AuthorizationCode: token, CustomerEmail: "owner@nantty.test", Reference: "token-currency-normalized", AmountMinor: 100_000, Currency: " ngn "}
	if _, err := adapter.ChargeAuthorization(ctx, request); err != nil {
		t.Fatalf("a configured tokenized-charge currency should be normalized: %v", err)
	}
	transaction := fake.TransactionByReference(request.Reference)
	if transaction == nil || transaction.Currency != "NGN" || transaction.AmountMinor != request.AmountMinor {
		t.Fatalf("the provider must receive normalized currency and exact minor-unit amount: %+v", transaction)
	}
}

func TestFlutterwaveTransfersSkipBeneficiariesNeverRetryAndRespectPsaBalances(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	wallet, err := adapter.CreateWallet(ctx, interfaces.WalletOwner{UserId: "u1", AccountName: "Temitope Adeyemi", AliasEmail: "u+u1@wallets.nantty.com", Country: "NG"})
	if err != nil || !strings.HasPrefix(wallet.AccountRef, "PSA") {
		t.Fatalf("wallet: %v %+v", err, wallet)
	}
	again, err := adapter.CreateWallet(ctx, interfaces.WalletOwner{UserId: "u1", AccountName: "Temitope Adeyemi", AliasEmail: "u+u1@wallets.nantty.com", Country: "NG"})
	if err != nil || again.AccountRef != wallet.AccountRef {
		t.Fatalf("creating twice must return the same wallet: %v %+v", err, again)
	}
	fake.FundWallet(wallet.AccountRef, "NGN", 1_000_000, "PSA_FUND1")
	_, err = adapter.CreateTransfer(ctx, interfaces.TransferRequest{Reference: "wd-big", AmountMinor: 5_000_000, Currency: "NGN", BankCode: "058", AccountNumber: "0123456789", SourceWalletRef: wallet.AccountRef})
	if !isRejection(err) {
		t.Fatalf("an insufficient PSA balance must be a definitive rejection: %v", err)
	}
	fake.LoseNextWriteReply(paymentstesting.FakeWriteTransfer)
	_, err = adapter.CreateTransfer(ctx, interfaces.TransferRequest{Reference: "wd-ok", AmountMinor: 100_000, Currency: "NGN", BankCode: "058", AccountNumber: "0123456789", SourceWalletRef: wallet.AccountRef})
	if !errors.Is(err, providerhttp.ErrOutcomeUnknown) {
		t.Fatalf("a timeout after success must be an unknown outcome: %v", err)
	}
	found, err := adapter.VerifyTransfer(ctx, "wd-ok")
	if err != nil || found.Outcome != interfaces.OutcomePending {
		t.Fatalf("the transfer must be found by reference: %v %+v", err, found)
	}
	if !fake.SetPayoutOutcome("wd-ok", interfaces.OutcomeSucceeded) {
		t.Fatal("fake transfer should transition to the documented successful state")
	}
	found, err = adapter.VerifyTransfer(ctx, "wd-ok")
	if err != nil || found.Outcome != interfaces.OutcomeSucceeded {
		t.Fatalf("a SUCCESSFUL transfer lookup should be terminal success: %v %+v", err, found)
	}
	if !fake.SetPayoutOutcome("wd-ok", interfaces.OutcomeFailed) {
		t.Fatal("fake transfer should transition to the documented failed state")
	}
	found, err = adapter.VerifyTransfer(ctx, "wd-ok")
	if err != nil || found.Outcome != interfaces.OutcomeFailed {
		t.Fatalf("a FAILED transfer lookup should be terminal failure: %v %+v", err, found)
	}
	transfer := fake.TransferByReference("wd-ok")
	if !transfer.SkipBeneficiary || transfer.DebitSubaccount != wallet.AccountRef || fake.Calls("POST /transfers") != 2 {
		t.Fatalf("transfer must skip beneficiaries, debit the PSA and be sent once: %+v calls=%d", transfer, fake.Calls("POST /transfers"))
	}
	for _, request := range fake.RequestLog() {
		if strings.Contains(request, "/retries") {
			t.Fatalf("the retry endpoint must never be called: %s", request)
		}
	}
	if _, err := adapter.VerifyTransfer(ctx, "wd-missing"); !isRejection(err) {
		t.Fatalf("a missing transfer must be a definitive not-found: %v", err)
	}
	fake.DeleteWalletAtProvider(wallet.AccountRef)
	if _, err := adapter.ReadWalletBalance(ctx, wallet.AccountRef, "NGN"); !isRejection(err) {
		t.Fatalf("a deleted PSA must be rejected: %v", err)
	}
}

func TestFlutterwaveTransferCurrencyIsValidatedAndNormalizedBeforeProviderIO(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	unsupported := interfaces.TransferRequest{Reference: "wd-unsupported", AmountMinor: 100_000, Currency: "EUR", BankCode: "058", AccountNumber: "0123456789"}
	if _, err := adapter.CreateTransfer(ctx, unsupported); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		t.Fatalf("a disabled payout currency must be rejected: %v", err)
	}
	if _, err := adapter.QuotePayoutFee(" eur ", 100_000); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		t.Fatalf("a disabled fee currency must be rejected: %v", err)
	}
	if len(fake.RequestLog()) != 0 {
		t.Fatalf("invalid payout currencies must fail before provider I/O: %v", fake.RequestLog())
	}

	fake.FundMainBalance("NGN", 500_000)
	request := interfaces.TransferRequest{Reference: "wd-normalized", AmountMinor: 100_000, Currency: " ngn ", BankCode: "058", AccountNumber: "0123456789"}
	if _, err := adapter.CreateTransfer(ctx, request); err != nil {
		t.Fatalf("a configured currency should be normalized before sending: %v", err)
	}
	if transfer := fake.TransferByReference(request.Reference); transfer == nil || transfer.Currency != "NGN" || transfer.AmountMinor != request.AmountMinor {
		t.Fatalf("the provider must receive normalized currency and exact minor-unit amount: %+v", transfer)
	}
}

func TestFlutterwavePayoutFeeQuoteNormalizesCurrencyAndRejectsNonPositiveAmount(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	fake.BankTransferFeeMinor = 1_250
	fee, err := adapter.QuotePayoutFee(" ngn ", 100_000)
	if err != nil || fee != 1_250 {
		t.Fatalf("configured lower-case currency should quote using its normalized code: fee=%d err=%v", fee, err)
	}
	if _, err := adapter.QuotePayoutFee("NGN", 0); err == nil {
		t.Fatal("a fee quote must reject a non-positive payout amount")
	}
	fake.PayoutFeeValue = "not-money"
	if fee, err := adapter.QuotePayoutFee("NGN", 100_000); err == nil || fee != 0 {
		t.Fatalf("a malformed provider fee must fail closed instead of returning a zero-fee quote: fee=%d err=%v", fee, err)
	}
}

func isRejection(err error) bool {
	var requestError *integrations.ProviderRequestError
	return errors.As(err, &requestError) && requestError.IsDefinitiveRejection()
}

func itoa(value int64) string { return strconv.FormatInt(value, 10) }
