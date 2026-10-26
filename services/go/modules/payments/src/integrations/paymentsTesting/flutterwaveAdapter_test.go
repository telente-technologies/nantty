package paymentstesting

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"nantty/modules/payments/src/integrations"
	"nantty/modules/payments/src/integrations/providerHttp"
	"nantty/modules/payments/src/interfaces"
)

func newFakeFlutterwaveAdapter(t *testing.T) (*FakeFlutterwave, *integrations.FlutterwaveProvider) {
	t.Helper()
	fake := StartFakeFlutterwave(t)
	settings := fake.Settings()
	settings.RetryBaseDelay = time.Millisecond
	return fake, integrations.NewFlutterwaveProvider(settings)
}

func TestFlutterwaveCheckoutIsHashedAndVerifiedByIdWithTheExactReference(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	session, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "chk-abc", AmountMinor: 250_050, Currency: "NGN", CustomerEmail: "Buyer@Zudomart.test", SuccessUrl: "https://zudomart.test/pay/return"})
	if err != nil || !strings.Contains(session.CheckoutUrl, "/hosted/pay/chk-abc") {
		t.Fatalf("checkout: %v %+v", err, session)
	}
	paid := fake.CompleteCheckout("chk-abc", 0, 3_500, "card")
	if _, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "chk-other", AmountMinor: 100, Currency: "NGN", CustomerEmail: "x@zudomart.test"}); err != nil {
		t.Fatal(err)
	}
	other := fake.TransactionByReference("chk-other")
	verified, err := adapter.VerifyCharge(ctx, interfaces.ChargeLookup{Reference: "chk-abc", ProviderChargeId: itoa(other.Id)})
	if err != nil || verified.Reference != "chk-abc" || verified.AmountMinor != 250_050 || verified.ProviderFeeMinor != 3_500 || verified.Outcome != interfaces.OutcomeSucceeded {
		t.Fatalf("a charge id from another reference must fall back to the reference lookup: %v %+v", err, verified)
	}
	if verified.ProviderChargeId != itoa(paid.Id) || verified.CustomerEmail != "buyer@zudomart.test" || verified.Authorization == nil || !strings.HasPrefix(verified.Authorization.AuthorizationCode, "flw-t") {
		t.Fatalf("verification details: %+v", verified)
	}
	fake.RejectPayloadHash = true
	if _, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "chk-tampered", AmountMinor: 100, Currency: "NGN", CustomerEmail: "x@zudomart.test"}); err == nil {
		t.Fatal("a rejected payload hash must fail the checkout")
	}
}

func TestFlutterwaveCardTokenOnlyChargesTheEmailItWasIssuedTo(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	if _, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "csub-1", AmountMinor: 500_000, Currency: "NGN", CustomerEmail: "owner@zudomart.test"}); err != nil {
		t.Fatal(err)
	}
	token := fake.CompleteCheckout("csub-1", 0, 0, "card").CardToken
	_, err := adapter.ChargeAuthorization(ctx, interfaces.AuthorizationChargeRequest{AuthorizationCode: token, CustomerEmail: "thief@zudomart.test", Reference: "ren-1", AmountMinor: 500_000, Currency: "NGN"})
	if !errors.Is(err, interfaces.ErrSavedCardNotForCustomer) {
		t.Fatalf("a token must not charge another email: %v", err)
	}
	result, err := adapter.ChargeAuthorization(ctx, interfaces.AuthorizationChargeRequest{AuthorizationCode: token, CustomerEmail: "owner@zudomart.test", Reference: "ren-2", AmountMinor: 500_000, Currency: "NGN"})
	if err != nil || result.ProviderChargeId == "" || result.Outcome != interfaces.OutcomePending {
		t.Fatalf("token charge must succeed and still be verified: %v %+v", err, result)
	}
	fake.LoseNextWriteReply(FakeWriteCharge)
	lost, err := adapter.ChargeAuthorization(ctx, interfaces.AuthorizationChargeRequest{AuthorizationCode: token, CustomerEmail: "owner@zudomart.test", Reference: "ren-3", AmountMinor: 500_000, Currency: "NGN"})
	if err != nil || lost.Outcome != interfaces.OutcomePending {
		t.Fatalf("a lost reply must stay pending: %v %+v", err, lost)
	}
	if calls := fake.Calls("POST /tokenized-charges"); calls != 3 {
		t.Fatalf("a tokenized charge must never be retried, got %d posts", calls)
	}
}

func TestFlutterwaveTransfersSkipBeneficiariesNeverRetryAndRespectPsaBalances(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	wallet, err := adapter.CreateWallet(ctx, interfaces.WalletOwner{UserId: "u1", AccountName: "Temitope Adeyemi", AliasEmail: "u+u1@wallets.zudomart.com", Country: "NG"})
	if err != nil || !strings.HasPrefix(wallet.AccountRef, "PSA") {
		t.Fatalf("wallet: %v %+v", err, wallet)
	}
	again, err := adapter.CreateWallet(ctx, interfaces.WalletOwner{UserId: "u1", AccountName: "Temitope Adeyemi", AliasEmail: "u+u1@wallets.zudomart.com", Country: "NG"})
	if err != nil || again.AccountRef != wallet.AccountRef {
		t.Fatalf("creating twice must return the same wallet: %v %+v", err, again)
	}
	fake.FundWallet(wallet.AccountRef, "NGN", 1_000_000, "PSA_FUND1")
	_, err = adapter.CreateTransfer(ctx, interfaces.TransferRequest{Reference: "wd-big", AmountMinor: 5_000_000, Currency: "NGN", BankCode: "058", AccountNumber: "0123456789", SourceWalletRef: wallet.AccountRef})
	if !isRejection(err) {
		t.Fatalf("an insufficient PSA balance must be a definitive rejection: %v", err)
	}
	fake.LoseNextWriteReply(FakeWriteTransfer)
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

func TestFlutterwaveReadsRetry429AndParseGroupedAmounts(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	wallet, _ := adapter.CreateWallet(ctx, interfaces.WalletOwner{AccountName: "A B", AliasEmail: "u+a@wallets.zudomart.com"})
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

func TestFlutterwaveWebhookHashIsOnlyATrigger(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	body, headers := SignedFlutterwaveWebhook("charge.completed", map[string]any{"id": 9, "tx_ref": "chk-1", "amount": 10, "currency": "NGN", "status": "successful"})
	notification, err := adapter.VerifyWebhookSignatureAndParse(body, headers)
	if err != nil || notification.Kind != interfaces.WebhookKindCharge || notification.Reference != "chk-1" || notification.ProviderChargeId != "9" {
		t.Fatalf("charge webhook: %v %+v", err, notification)
	}
	forged := http.Header{integrations.FlutterwaveSignatureHeader: {FakeFlutterwaveWebhookHash + "x"}}
	if _, err := adapter.VerifyWebhookSignatureAndParse(body, forged); !errors.Is(err, interfaces.ErrInvalidWebhookSignature) {
		t.Fatalf("a wrong hash must be rejected: %v", err)
	}
	wallet, _ := adapter.CreateWallet(context.Background(), interfaces.WalletOwner{AccountName: "A B", AliasEmail: "u+w@wallets.zudomart.com"})
	fundingBody, fundingHeaders := fake.FundWalletAndSignWebhook(wallet.AccountRef, 50_000, "PSA_X1", 0)
	funding, err := adapter.VerifyWebhookSignatureAndParse(fundingBody, fundingHeaders)
	if err != nil || funding.Kind != interfaces.WebhookKindWalletFunding || funding.Reference != "PSA_X1" || funding.AccountNumber == "" {
		t.Fatalf("funding webhook: %v %+v", err, funding)
	}
	refund, err := adapter.VerifyWebhookSignatureAndParse([]byte(`{"id":77,"AmountRefunded":10,"status":"completed","FlwRef":"F","TransactionId":9}`), headers)
	if err != nil || refund.Kind != interfaces.WebhookKindRefund || refund.ProviderObjectId != "77" {
		t.Fatalf("refund webhook: %v %+v", err, refund)
	}
}

func isRejection(err error) bool {
	var requestError *integrations.ProviderRequestError
	return errors.As(err, &requestError) && requestError.IsDefinitiveRejection()
}

func itoa(value int64) string { return strconv.FormatInt(value, 10) }
