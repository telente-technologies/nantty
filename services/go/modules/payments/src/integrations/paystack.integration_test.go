package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"

	"zudomart/modules/payments/src/interfaces"
)

type paystackExchange struct {
	method, path, query string
	body                map[string]any
}

type paystackFixtureResponse struct {
	status  int
	fixture string
}

type paystackFixtureServer struct {
	mutex     sync.Mutex
	exchanges []paystackExchange
	responses []paystackFixtureResponse
}

func startPaystackFixtureServer(t *testing.T, responses ...paystackFixtureResponse) (*PaystackProvider, *paystackFixtureServer) {
	t.Helper()
	recorder := &paystackFixtureServer{responses: responses}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		recorder.mutex.Lock()
		defer recorder.mutex.Unlock()
		if request.Header.Get("Authorization") != "Bearer sk_test_unit" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		raw, _ := io.ReadAll(request.Body)
		exchange := paystackExchange{method: request.Method, path: request.URL.Path, query: request.URL.RawQuery, body: map[string]any{}}
		_ = json.Unmarshal(raw, &exchange.body)
		recorder.exchanges = append(recorder.exchanges, exchange)
		next := recorder.responses[0]
		if len(recorder.responses) > 1 {
			recorder.responses = recorder.responses[1:]
		}
		content, err := os.ReadFile("testdata/paystack/" + next.fixture)
		if err != nil {
			t.Errorf("fixture %s: %v", next.fixture, err)
		}
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(next.status)
		_, _ = writer.Write(content)
	}))
	t.Cleanup(server.Close)
	return NewPaystackProvider(PaystackSettings{BaseUrl: server.URL, SecretKey: "sk_test_unit", MaximumAttempts: 3}), recorder
}

func TestInitializeSendsTheAccountEmailReferenceChannelsAndDirectSplit(t *testing.T) {
	provider, recorder := startPaystackFixtureServer(t, paystackFixtureResponse{http.StatusOK, "initializeTransaction.response.json"})
	session, err := provider.InitializeCharge(context.Background(), interfaces.ChargeRequest{
		Reference: "chk-7PVGX8MEk85tgeEpVDtD", AmountMinor: 600_000, Currency: "NGN", CustomerEmail: "ada@zudomart.test", SuccessUrl: "https://zudomart.com/pay/return?reference=x",
		SettlementAccount: "ACCT_8f4s1eq7ml6rlzj", SubaccountBearsFee: true, Metadata: map[string]string{"orderId": "o-1"},
	})
	if err != nil || session.CheckoutUrl == "" || session.ProviderCheckoutId != "0peioxfhpn" {
		t.Fatalf("session %+v err %v", session, err)
	}
	exchange := recorder.exchanges[0]
	if exchange.path != "/transaction/initialize" || exchange.body["email"] != "ada@zudomart.test" || exchange.body["amount"].(float64) != 600_000 ||
		exchange.body["subaccount"] != "ACCT_8f4s1eq7ml6rlzj" || exchange.body["bearer"] != "subaccount" || exchange.body["transaction_charge"].(float64) != 0 || len(exchange.body["channels"].([]any)) != 4 {
		t.Fatalf("initialize body %+v", exchange.body)
	}
	if _, err := provider.InitializeCharge(context.Background(), interfaces.ChargeRequest{Reference: "r", AmountMinor: 100, Currency: "NGN"}); err == nil {
		t.Fatal("a charge without the verified account email must be refused before calling Paystack")
	}
}

func TestVerifyMapsSuccessAuthorizationAndTreatsAbandonedAsPending(t *testing.T) {
	provider, _ := startPaystackFixtureServer(t, paystackFixtureResponse{http.StatusOK, "verifyTransaction.success.response.json"}, paystackFixtureResponse{http.StatusOK, "verifyTransaction.abandoned.response.json"})
	verified, err := provider.VerifyCharge(context.Background(), interfaces.ChargeLookup{Reference: "chk-7PVGX8MEk85tgeEpVDtD"})
	if err != nil || verified.Outcome != interfaces.OutcomeSucceeded || verified.AmountMinor != 600_000 || verified.ProviderFeeMinor != 10_000 ||
		verified.SettlementAccount != "ACCT_8f4s1eq7ml6rlzj" || verified.ProviderCustomerId != "CUS_1rkzaqsv4rrhqo6" || verified.Authorization == nil ||
		verified.Authorization.AuthorizationCode != "AUTH_8dfhjjdt" || !verified.Authorization.Reusable || verified.Authorization.ExpiryYear != 2030 {
		t.Fatalf("verified %+v err %v", verified, err)
	}
	pending, err := provider.VerifyCharge(context.Background(), interfaces.ChargeLookup{Reference: "chk-pending"})
	if err != nil || pending.Outcome != interfaces.OutcomePending || pending.Authorization != nil {
		t.Fatalf("abandoned must stay pending: %+v err %v", pending, err)
	}
}

func TestSavedCardChargeIsPassedThroughAndPausedChargesNeedTheBrowser(t *testing.T) {
	provider, recorder := startPaystackFixtureServer(t, paystackFixtureResponse{http.StatusOK, "chargeAuthorization.paused.response.json"})
	result, err := provider.ChargeAuthorization(context.Background(), interfaces.AuthorizationChargeRequest{
		CustomerEmail: "ada@zudomart.test", AuthorizationCode: "AUTH_8dfhjjdt", Reference: "chk-saved-2", AmountMinor: 250_000, Currency: "NGN",
	})
	if err != nil || !result.Paused || result.AuthorizationUrl == "" {
		t.Fatalf("result %+v err %v", result, err)
	}
	if body := recorder.exchanges[0].body; body["authorization_code"] != "AUTH_8dfhjjdt" || body["email"] != "ada@zudomart.test" || body["reference"] != "chk-saved-2" {
		t.Fatalf("charge body %+v", body)
	}
	if _, err := provider.ChargeAuthorization(context.Background(), interfaces.AuthorizationChargeRequest{CustomerEmail: "a@b.c", AuthorizationCode: "card_1", Reference: "r"}); !errors.Is(err, interfaces.ErrSavedCardNotForCustomer) {
		t.Fatalf("a non-authorization code must never reach Paystack: %v", err)
	}
}

func TestBankTransferRefundNeedsTheBuyerAccount(t *testing.T) {
	provider, recorder := startPaystackFixtureServer(t, paystackFixtureResponse{http.StatusOK, "refund.needsAttention.response.json"}, paystackFixtureResponse{http.StatusOK, "refund.needsAttention.response.json"})
	result, err := provider.RefundCharge(context.Background(), interfaces.RefundRequest{ChargeReference: "chk-7PVGX8MEk85tgeEpVDtD", AmountMinor: 600_000, Currency: "NGN", FullRefund: true})
	if err != nil || !result.NeedsCustomerDetail || result.ProviderRefundId != "3018284" || result.Outcome != interfaces.OutcomePending {
		t.Fatalf("refund %+v err %v", result, err)
	}
	if err := provider.RetryRefundWithCustomerBankAccount(context.Background(), "3018284", interfaces.PayeeBankAccount{BankCode: "9", AccountNumber: "0001234567", Currency: "NGN"}); err != nil {
		t.Fatal(err)
	}
	if retry := recorder.exchanges[1]; retry.path != "/refund/retry_with_customer_details/3018284" || retry.body["refund_account_details"].(map[string]any)["account_number"] != "0001234567" {
		t.Fatalf("retry %+v", retry)
	}
}

func TestPayeesAreLookedUpBeforeCreationAndSubaccountsSettleAutomatically(t *testing.T) {
	provider, recorder := startPaystackFixtureServer(t,
		paystackFixtureResponse{http.StatusOK, "listRecipients.response.json"},
		paystackFixtureResponse{http.StatusOK, "emptyList.response.json"},
		paystackFixtureResponse{http.StatusOK, "createSubaccount.response.json"},
		paystackFixtureResponse{http.StatusOK, "updateSubaccount.response.json"},
		paystackFixtureResponse{http.StatusOK, "resolveAccount.response.json"},
		paystackFixtureResponse{http.StatusUnprocessableEntity, "resolveAccount.notFound.error.json"},
	)
	code, found, err := provider.FindTransferRecipient(context.Background(), interfaces.PayeeBankAccount{UserId: "user-1", BankCode: "058", AccountNumber: "0001234567"})
	if err != nil || !found || code != "RCP_m7ljkv8leesep7p" {
		t.Fatalf("existing recipient %s %v %v", code, found, err)
	}
	request := interfaces.SettlementSubaccountRequest{PayeeBankAccount: interfaces.PayeeBankAccount{UserId: "user-2", AccountName: "Temitope Adeyemi", BankCode: "058", AccountNumber: "0123456789"}}
	if _, found, err := provider.FindSettlementSubaccount(context.Background(), request); err != nil || found {
		t.Fatalf("subaccount lookup %v %v", found, err)
	}
	subaccount, err := provider.CreateSettlementSubaccount(context.Background(), request)
	if err != nil || subaccount != "ACCT_4hl4xenwpjy5wb" || recorder.exchanges[3].body["settlement_schedule"] != "auto" {
		t.Fatalf("subaccount %s err %v %+v", subaccount, err, recorder.exchanges[3])
	}
	if name, err := provider.ResolveBankAccountName(context.Background(), "058", "0001234567"); err != nil || name != "TEMITOPE ADEYEMI" {
		t.Fatalf("resolve %s %v", name, err)
	}
	if _, err := provider.ResolveBankAccountName(context.Background(), "999", "0000000000"); !errors.Is(err, interfaces.ErrBankAccountNotFound) {
		t.Fatalf("unresolvable account: %v", err)
	}
}

func TestTransfersUseTheReferenceAndSurfaceOtpAndLowBalance(t *testing.T) {
	provider, recorder := startPaystackFixtureServer(t,
		paystackFixtureResponse{http.StatusOK, "createTransfer.response.json"},
		paystackFixtureResponse{http.StatusOK, "createTransfer.otp.response.json"},
		paystackFixtureResponse{http.StatusBadRequest, "insufficientBalance.error.json"},
		paystackFixtureResponse{http.StatusOK, "balance.response.json"},
	)
	result, err := provider.CreateTransfer(context.Background(), interfaces.TransferRequest{RecipientCode: "RCP_1", AmountMinor: 99_000, Currency: "NGN", Reference: "ZMWD_1a2b3c4d5e6f7a8b9c0d"})
	if err != nil || result.Outcome != interfaces.OutcomePending || result.ProviderTransferId != "TRF_1ptvuv321ahaa7q" || result.FeeMinor != 1_000 {
		t.Fatalf("transfer %+v err %v", result, err)
	}
	if body := recorder.exchanges[0].body; body["reference"] != "zmwd_1a2b3c4d5e6f7a8b9c0d" || body["source"] != "balance" {
		t.Fatalf("the transfer reference must be lowercased and drawn from the balance: %+v", body)
	}
	if _, err := provider.CreateTransfer(context.Background(), interfaces.TransferRequest{RecipientCode: "RCP_1", AmountMinor: 1, Currency: "NGN", Reference: "zmwd_otpotpotpotpotpotp"}); !errors.Is(err, interfaces.ErrTransferNeedsOtp) {
		t.Fatalf("otp: %v", err)
	}
	if _, err := provider.CreateTransfer(context.Background(), interfaces.TransferRequest{RecipientCode: "RCP_1", AmountMinor: 1, Currency: "NGN", Reference: "zmwd_poorpoorpoorpoor"}); !errors.Is(err, interfaces.ErrInsufficientProviderBalance) {
		t.Fatalf("low balance: %v", err)
	}
	balances, err := provider.ReadPlatformBalances(context.Background())
	if err != nil || len(balances) != 1 || balances[0].AvailableMinor != 1_234_500 {
		t.Fatalf("balances %+v err %v", balances, err)
	}
	if _, err := provider.CreateTransfer(context.Background(), interfaces.TransferRequest{RecipientCode: "RCP_1", Reference: "short"}); err == nil {
		t.Fatal("a short reference must be refused")
	}
}

func TestCreateTransferDoesNotRetryUncertainProviderFailures(t *testing.T) {
	var requestCount int
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestCount++
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusBadGateway)
		_, _ = writer.Write([]byte(`{"status":false,"message":"temporary provider failure","data":null}`))
	}))
	defer server.Close()

	provider := NewPaystackProvider(PaystackSettings{BaseUrl: server.URL, SecretKey: "sk_test_unit", MaximumAttempts: 3})
	_, err := provider.CreateTransfer(context.Background(), interfaces.TransferRequest{
		RecipientCode: "RCP_1", AmountMinor: 99_000, Currency: "NGN", Reference: "ZMWD_1a2b3c4d5e6f7a8b9c0d",
	})
	if err == nil {
		t.Fatal("expected provider failure")
	}
	if requestCount != 1 {
		t.Fatalf("transfer requests = %d, want exactly 1 to avoid duplicate disbursement", requestCount)
	}
}

func TestTransferFeeBandsFollowThePublishedSchedule(t *testing.T) {
	bands := ParseTransferFeeBands("500000:1000;5000000:2500;*:5000")
	cases := map[int64]int64{100_000: 1_000, 500_000: 1_000, 500_001: 2_500, 5_000_000: 2_500, 5_000_001: 5_000}
	for amount, want := range cases {
		if got := QuoteTransferFee(bands, amount); got != want {
			t.Fatalf("amount %d: fee %d want %d", amount, got, want)
		}
	}
	if len(ParseTransferFeeBands("garbage")) != 3 {
		t.Fatal("a malformed schedule falls back to the published bands")
	}
}
