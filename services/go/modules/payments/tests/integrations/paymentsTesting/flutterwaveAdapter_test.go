package paymentstesting_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
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
		{ProviderChargeId: "7001", AmountMinor: 10_000, Currency: "EUR"},
		{ProviderChargeId: "7001", AmountMinor: 12_345, Currency: "NGN"},
		{ProviderChargeId: "7001", AmountMinor: 9_999, Currency: "NGN"},
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

func TestFlutterwavePayoutSubaccountRefundsUseTheDocumentedEnvelopeAndReferences(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	wallet, err := adapter.CreateWallet(context.Background(), interfaces.WalletOwner{AccountName: "A B", AliasEmail: "u+a@wallets.nantty.com"})
	if err != nil {
		t.Fatal(err)
	}
	fake.FundWallet(wallet.AccountRef, "NGN", 12_550, "PSA_FUNDING-501")
	request, err := adapter.ReverseFunding(context.Background(), "PSA_FUNDING-501", "NGN")
	if err != nil || request.Outcome != interfaces.OutcomePending || !strings.HasPrefix(request.ProviderRefundId, "REV-") {
		t.Fatalf("initial NEW response must remain pending and return the provider reversal reference: %v %+v", err, request)
	}

	fake.Reversals = []map[string]any{
		{"id": 501, "reference": "RVSL-501", "narration": "Refund for: FUNDING-501", "status": "SUCCESSFUL", "amount": 125.50, "currency": "NGN", "account_number": "8000000001"},
		{"id": 503, "reference": "RVSL-503", "narration": "Refund for: FUNDING-503", "status": "SUCCESSFUL", "amount": 50, "currency": "NGN", "account_number": "8000000003"},
		{"id": 502, "reference": "RVSL-502", "narration": "Refund for: FUNDING-502", "status": "PENDING", "amount": 88, "currency": "NGN", "account_number": "8000000002"},
		{"id": 504, "reference": "RVSL-504", "narration": "Refund for: FUNDING-504", "status": "FAILED", "amount": 25, "currency": "NGN", "account_number": "8000000004"},
	}

	reversals, err := adapter.ListFundingReversals(context.Background(), time.Now().Add(-24*time.Hour), time.Now())
	if err != nil || len(reversals) != 4 {
		t.Fatalf("documented data.transfers response across pages: %v %+v", err, reversals)
	}
	if reversals[0].FundingReference != "FUNDING-501" || reversals[0].ProviderReversalReference != "RVSL-501" || reversals[0].AmountMinor != 12_550 || reversals[0].Outcome != interfaces.OutcomeSucceeded {
		t.Fatalf("first reversal must separate the original funding ref from the provider reversal ref: %+v", reversals[0])
	}
	if reversals[1].FundingReference != "FUNDING-503" || reversals[1].ProviderReversalReference != "RVSL-503" {
		t.Fatalf("second success-page reversal: %+v", reversals[1])
	}
	if reversals[2].FundingReference != "FUNDING-502" || reversals[2].ProviderReversalReference != "RVSL-502" || reversals[2].Outcome != interfaces.OutcomePending {
		t.Fatalf("pending reversal must remain pending and preserve both references: %+v", reversals[2])
	}
	if reversals[3].FundingReference != "FUNDING-504" || reversals[3].ProviderReversalReference != "RVSL-504" || reversals[3].Outcome != interfaces.OutcomeFailed {
		t.Fatalf("failed reversal must be returned for hold recovery: %+v", reversals[3])
	}
	listCalls := 0
	for _, request := range fake.RequestLog() {
		if request == "GET /v3/payout-subaccounts/refunds" {
			listCalls++
		}
	}
	if listCalls != 4 {
		t.Fatalf("all three documented statuses and the second success page require four list reads, got %d", listCalls)
	}
}

func TestFlutterwavePayoutSubaccountRefundListingFailsClosedOnInvalidPagination(t *testing.T) {
	for _, test := range []struct {
		name  string
		setup func(*paymentstesting.FakeFlutterwave)
	}{
		{name: "missing page metadata", setup: func(fake *paymentstesting.FakeFlutterwave) { fake.OmitReversalPageInfo = true }},
		{name: "provider ignores page query", setup: func(fake *paymentstesting.FakeFlutterwave) { fake.IgnoreReversalPage = true }},
	} {
		t.Run(test.name, func(t *testing.T) {
			fake, adapter := newFakeFlutterwaveAdapter(t)
			fake.Reversals = []map[string]any{
				{"id": 601, "reference": "RVSL-601", "narration": "Refund for: FUNDING-601", "status": "SUCCESSFUL", "amount": 1, "currency": "NGN"},
				{"id": 602, "reference": "RVSL-602", "narration": "Refund for: FUNDING-602", "status": "SUCCESSFUL", "amount": 2, "currency": "NGN"},
			}
			test.setup(fake)
			if reversals, err := adapter.ListFundingReversals(context.Background(), time.Now().Add(-24*time.Hour), time.Now()); err == nil || reversals != nil {
				t.Fatalf("invalid or ignored pagination must not look like complete history: %v %+v", err, reversals)
			}
		})
	}
}

func TestFlutterwavePayoutSubaccountOperationsRejectUnsupportedCurrencies(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	if _, err := adapter.ListFundingAccounts(ctx, "PSA-1", "GHS"); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		t.Fatalf("non-NGN payout subaccount virtual account should be rejected: %v", err)
	}
	if _, err := adapter.ReadWalletBalance(ctx, "PSA-1", "GHS"); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		t.Fatalf("non-NGN payout subaccount balance should be rejected: %v", err)
	}
	if _, err := adapter.ReverseFunding(ctx, "PSA_FUNDING-1", "GHS"); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		t.Fatalf("non-NGN payout subaccount reversal should be rejected: %v", err)
	}
	if calls := len(fake.RequestLog()); calls != 0 {
		t.Fatalf("unsupported currency requests must fail before provider I/O, got %d requests", calls)
	}
}

func TestFlutterwaveReadsRetry429AndParseGroupedAmounts(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	wallet, _ := adapter.CreateWallet(ctx, interfaces.WalletOwner{AccountName: "A B", AliasEmail: "u+a@wallets.nantty.com"})
	fake.FundWallet(wallet.AccountRef, "NGN", 123_456_789, "PSA_GROUPED")
	fake.SetRateLimitedRequests(2)
	lines, err := adapter.ListWalletTransactions(ctx, wallet.AccountRef, time.Now().Add(-time.Hour), time.Now())
	if err != nil || len(lines) != 2 || lines[0].AmountMinor != 123_456_789 || lines[1].Direction != "debit" {
		t.Fatalf("grouped amounts after 429s: %v %+v", err, lines)
	}
	balance, err := adapter.ReadWalletBalance(ctx, wallet.AccountRef, "NGN")
	if err != nil || balance.AvailableMinor != 123_456_789-5_000 {
		t.Fatalf("balance: %v %+v", err, balance)
	}
}

func TestFlutterwaveListsEveryWalletStatementPage(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	wallet, err := adapter.CreateWallet(context.Background(), interfaces.WalletOwner{AccountName: "A B", AliasEmail: "u+pages@wallets.nantty.com"})
	if err != nil {
		t.Fatal(err)
	}
	fake.FundingFeeMinor = 0
	for index := 0; index < 21; index++ {
		fake.FundWallet(wallet.AccountRef, "NGN", 1_000, fmt.Sprintf("PSA_PAGE_%02d", index))
	}

	lines, err := adapter.ListWalletTransactions(context.Background(), wallet.AccountRef, time.Now().Add(-time.Hour), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 21 {
		t.Fatalf("all statement rows must be read across three provider pages: got %d", len(lines))
	}
	for index, line := range lines {
		if line.Reference != fmt.Sprintf("PSA_PAGE_%02d", index) {
			t.Fatalf("statement row %d was missing or reordered: %+v", index, line)
		}
	}
}

func TestFlutterwaveListsEverySettlementAndChargebackPage(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	for index := 0; index < 21; index++ {
		fake.Settlements = append(fake.Settlements, map[string]any{
			"id": index + 1, "status": "completed", "currency": "NGN", "net_amount": 100,
			"settlement_date": "2026-11-19T12:00:00Z",
		})
	}
	settlements, err := adapter.ListSettlements(context.Background(), "", time.Now().Add(-time.Hour), time.Now())
	if err != nil || len(settlements) != 21 {
		t.Fatalf("settlements across provider pages: %v count=%d", err, len(settlements))
	}

	for index := 0; index < 41; index++ {
		fake.Chargebacks = append(fake.Chargebacks, map[string]any{
			"id": index + 1, "amount": 100, "currency": "NGN", "tx_ref": fmt.Sprintf("TX-%d", index),
			"transaction_id": index + 1, "status": "initiated",
		})
	}
	disputes, err := adapter.ListOpenDisputes(context.Background())
	if err != nil || len(disputes) != 41 {
		t.Fatalf("chargebacks across provider pages: %v count=%d", err, len(disputes))
	}
}

func TestFlutterwaveWebhookHashIsOnlyATrigger(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	body, headers := paymentstesting.SignedFlutterwaveWebhook("charge.completed", map[string]any{"id": 9, "tx_ref": "chk-1", "amount": 10, "currency": "NGN", "status": "successful"})
	notification, err := adapter.VerifyWebhookSignatureAndParse(body, headers)
	if err != nil || notification.Kind != interfaces.WebhookKindCharge || notification.Reference != "chk-1" || notification.ProviderChargeId != "9" {
		t.Fatalf("charge webhook: %v %+v", err, notification)
	}
	forged := http.Header{integrations.FlutterwaveSignatureHeader: {paymentstesting.FakeFlutterwaveWebhookHash + "x"}}
	if _, err := adapter.VerifyWebhookSignatureAndParse(body, forged); !errors.Is(err, interfaces.ErrInvalidWebhookSignature) {
		t.Fatalf("a wrong hash must be rejected: %v", err)
	}
	wallet, _ := adapter.CreateWallet(context.Background(), interfaces.WalletOwner{AccountName: "A B", AliasEmail: "u+w@wallets.nantty.com"})
	fundingBody, fundingHeaders := fake.FundWalletAndSignWebhook(wallet.AccountRef, 50_000, "PSA_X1", 0)
	funding, err := adapter.VerifyWebhookSignatureAndParse(fundingBody, fundingHeaders)
	if err != nil || funding.Kind != interfaces.WebhookKindWalletFunding || funding.Reference != "PSA_X1" || funding.AccountNumber == "" {
		t.Fatalf("funding webhook: %v %+v", err, funding)
	}
	refund, err := adapter.VerifyWebhookSignatureAndParse([]byte(`{"id":77,"AmountRefunded":10,"status":"completed","FlwRef":"F","TransactionId":9}`), headers)
	if err != nil || refund.Kind != interfaces.WebhookKindRefund || refund.ProviderObjectId != "77" || refund.Status != "pending" || refund.EventType != "refund.pending" {
		t.Fatalf("refund webhook: %v %+v", err, refund)
	}
	for _, testCase := range []struct {
		status string
		want   string
	}{
		{"completed", "pending"},
		{"completed-bank-transfer", "processed"},
		{"completed-momo", "processed"},
		{"completed-mpgs", "processed"},
		{"completed-offline", "processed"},
		{"completed-preauth", "processed"},
		{"pending-momo", "pending"},
		{"pending-bank-transfer", "pending"},
		{"pending-mpgs", "pending"},
		{"processing", "pending"},
		{"failed", "failed"},
	} {
		body := []byte(`{"id":77,"AmountRefunded":10,"status":"` + testCase.status + `","FlwRef":"F","TransactionId":9}`)
		notification, err := adapter.VerifyWebhookSignatureAndParse(body, headers)
		if err != nil || notification.Status != testCase.want {
			t.Errorf("refund status %q mapped to %q (%v), want %q", testCase.status, notification.Status, err, testCase.want)
		}
	}
}

func TestFlutterwaveChargebackWebhookRequiresValidAmount(t *testing.T) {
	_, adapter := newFakeFlutterwaveAdapter(t)
	for _, payload := range []string{
		`{"event":"chargeback.opened","data":{"id":9,"tx_ref":"chk-1","amount":"not-money","currency":"NGN"}}`,
		`{"event":"chargeback.opened","data":{"id":9,"tx_ref":"chk-1","amount":0,"currency":"NGN"}}`,
		`{"event":"chargeback.opened","data":{"id":9,"tx_ref":"chk-1","currency":"NGN"}}`,
		`{"event":"chargeback.opened","data":{"id":9,"tx_ref":"chk-1","amount":10}}`,
	} {
		if _, err := adapter.ParseVerifiedWebhookPayload([]byte(payload)); !errors.Is(err, interfaces.ErrMalformedWebhookPayload) {
			t.Errorf("invalid chargeback amount must be rejected: %s (err=%v)", payload, err)
		}
	}
	valid := `{"event":"chargeback.opened","data":{"id":9,"tx_ref":"chk-1","transaction_id":8,"amount":10,"currency":"NGN"}}`
	notification, err := adapter.ParseVerifiedWebhookPayload([]byte(valid))
	if err != nil || notification.Dispute == nil || notification.Dispute.AmountMinor != 1000 {
		t.Fatalf("valid chargeback amount must be parsed exactly: notification=%+v err=%v", notification, err)
	}
}

func TestFlutterwaveRefundLookupUsesDocumentedSingularCommentField(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	const refundReference = "verification-refund:case-lost"
	fake.Refunds = []map[string]any{{"id": 701, "transaction_id": 7001, "flw_ref": "FLW-REFUND-701", "comment": interfaces.RefundReferenceNote("checkmark refund", refundReference), "status": "completed-mpgs"}}
	fake.Refunds = append(fake.Refunds, map[string]any{"id": 702, "transaction_id": 7002, "comment": interfaces.RefundReferenceNote("unrelated refund", refundReference), "status": "completed-mpgs"})
	result, found, err := adapter.FindRefundByReference(context.Background(), interfaces.RefundLookup{ProviderChargeId: "7001", RefundReference: refundReference, SubmittedAfter: time.Now().Add(-time.Hour)})
	if err != nil || !found || result.ProviderRefundId != "701" || result.Outcome != interfaces.OutcomeSucceeded {
		t.Fatalf("a refund listed with the documented singular comment must be matched: found=%v result=%+v err=%v", found, result, err)
	}
	requests := fake.RequestLog()
	queries := fake.QueryLog()
	if len(requests) != 1 || requests[0] != "GET /v3/refunds" || len(queries) != 1 || queries[0] != "id=7001" {
		t.Fatalf("refund recovery must use the documented charge-id filter, not scan account-wide history: %v", requests)
	}
}

func TestFlutterwaveRefundLookupResolvesChargeReferenceToDocumentedTransactionFilter(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	if _, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "refund-lookup-charge", AmountMinor: 25_000, Currency: "NGN", CustomerEmail: "buyer@nantty.test", SuccessUrl: "https://nantty.test/return"}); err != nil {
		t.Fatal(err)
	}
	transaction := fake.TransactionByReference("refund-lookup-charge")
	transaction.Status = "successful"
	fake.Refunds = []map[string]any{{"id": 711, "transaction_id": transaction.Id, "comment": interfaces.RefundReferenceNote("recovered", "refund-from-reference"), "status": "completed-mpgs"}}
	result, found, err := adapter.FindRefundByReference(ctx, interfaces.RefundLookup{ChargeReference: "refund-lookup-charge", RefundReference: "refund-from-reference"})
	if err != nil || !found || result.ProviderRefundId != "711" {
		t.Fatalf("refund lookup by charge reference should verify and constrain to transaction id: found=%v result=%+v err=%v", found, result, err)
	}
	requests := fake.RequestLog()
	queries := fake.QueryLog()
	if len(requests) != 3 || requests[1] != "GET /v3/transactions/verify_by_reference" || requests[2] != "GET /v3/refunds" || len(queries) != 3 || queries[1] != "tx_ref=refund-lookup-charge" || queries[2] != fmt.Sprintf("id=%d", transaction.Id) {
		t.Fatalf("charge-reference lookup must verify the exact charge then query its refunds: %v", requests)
	}
}

func TestFlutterwaveRefundLookupFailsClosedWhenACompleteNegativeResultCannotBeProven(t *testing.T) {
	for _, test := range []struct {
		name  string
		setup func(*paymentstesting.FakeFlutterwave)
	}{
		{name: "missing metadata", setup: func(fake *paymentstesting.FakeFlutterwave) { fake.OmitRefundListMeta = true }},
		{name: "more than one page with undocumented page query", setup: func(fake *paymentstesting.FakeFlutterwave) { fake.RefundListTotalPages = 2 }},
	} {
		t.Run(test.name, func(t *testing.T) {
			fake, adapter := newFakeFlutterwaveAdapter(t)
			test.setup(fake)
			result, found, err := adapter.FindRefundByReference(context.Background(), interfaces.RefundLookup{ProviderChargeId: "7001", RefundReference: "refund-not-on-first-page", SubmittedAfter: time.Now().Add(-time.Hour)})
			if err == nil || found || result.ProviderRefundId != "" {
				t.Fatalf("incomplete refund history must not authorize a resend: found=%v result=%+v err=%v", found, result, err)
			}
		})
	}
	_, adapter := newFakeFlutterwaveAdapter(t)
	if _, found, err := adapter.FindRefundByReference(context.Background(), interfaces.RefundLookup{ProviderChargeId: "7001", RefundReference: "absent", SubmittedAfter: time.Now().Add(-time.Hour)}); err != nil || found {
		t.Fatalf("an empty, explicitly complete one-page history can prove absence: found=%v err=%v", found, err)
	}
}

func isRejection(err error) bool {
	var requestError *integrations.ProviderRequestError
	return errors.As(err, &requestError) && requestError.IsDefinitiveRejection()
}

func itoa(value int64) string { return strconv.FormatInt(value, 10) }
