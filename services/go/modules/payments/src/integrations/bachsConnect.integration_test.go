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

type recordedExchange struct {
	method, path, accountId, idempotencyKey string
	body                                    map[string]any
}

type fixtureServer struct {
	mutex     sync.Mutex
	exchanges []recordedExchange
	responses []fixtureResponse
}

type fixtureResponse struct {
	status  int
	fixture string
}

func startFixtureServer(t *testing.T, responses ...fixtureResponse) (*BachsConnectProvider, *fixtureServer) {
	t.Helper()
	recorder := &fixtureServer{responses: responses}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		recorder.mutex.Lock()
		defer recorder.mutex.Unlock()
		raw, _ := io.ReadAll(request.Body)
		exchange := recordedExchange{method: request.Method, path: request.URL.Path, accountId: request.Header.Get("X-Account-Id"), idempotencyKey: request.Header.Get("Idempotency-Key"), body: map[string]any{}}
		_ = json.Unmarshal(raw, &exchange.body)
		recorder.exchanges = append(recorder.exchanges, exchange)
		next := recorder.responses[0]
		if len(recorder.responses) > 1 {
			recorder.responses = recorder.responses[1:]
		}
		content := []byte("{}")
		if next.fixture != "" {
			var err error
			if content, err = os.ReadFile("testdata/bachs/" + next.fixture); err != nil {
				t.Errorf("fixture %s: %v", next.fixture, err)
			}
		}
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(next.status)
		_, _ = writer.Write(content)
	}))
	t.Cleanup(server.Close)
	provider := NewBachsConnectProvider(BachsConnectSettings{BaseUrl: server.URL, SecretKey: "sk_sandbox_unit", WebhookSigningSecrets: []string{"whsec_unit"}, MaximumAttempts: 3})
	return provider, recorder
}

func (recorder *fixtureServer) only(t *testing.T) recordedExchange {
	t.Helper()
	if len(recorder.exchanges) != 1 {
		t.Fatalf("expected one request, got %d", len(recorder.exchanges))
	}
	return recorder.exchanges[0]
}

func TestDirectChargeCheckoutSendsTheSellerAccountPlatformFeeAndIdempotencyKey(t *testing.T) {
	provider, recorder := startFixtureServer(t, fixtureResponse{http.StatusCreated, "createCheckoutSession.response.json"})
	session, err := provider.InitializeCharge(context.Background(), interfaces.ChargeRequest{
		Reference: "zmpay_abc", IdempotencyKey: "chk:zmpay_abc", AmountMinor: 600_000, Currency: "NGN", ConnectedAccountId: "acct_3Wq8ZfT1yHnJ5sVe",
		PlatformFeeMinor: 30_000, CustomerEmail: "buyer@zudomart.test", CustomerName: "Buyer", SuccessUrl: "https://zudomart.com/pay/return?reference=zmpay_abc",
		CancelUrl: "https://zudomart.com/pay/return?reference=zmpay_abc&status=cancelled", ExpiresInMinutes: 15,
	})
	if err != nil || session.ProviderCheckoutId != "chk_9f3a71c4e05b" || session.CheckoutUrl == "" || session.ExpiresAt == nil {
		t.Fatalf("session %+v err %v", session, err)
	}
	exchange := recorder.only(t)
	pricing := exchange.body["pricing"].(map[string]any)
	if exchange.method != http.MethodPost || exchange.path != "/v1/checkout-sessions" || exchange.accountId != "acct_3Wq8ZfT1yHnJ5sVe" || exchange.idempotencyKey != "chk:zmpay_abc" ||
		pricing["amount"] != "6000.00" || exchange.body["platform_fee"] != "300.00" || exchange.body["expires_in_minutes"].(float64) != 15 || exchange.body["transfer_data"] != nil {
		t.Fatalf("request %+v", exchange)
	}
	if exchange.body["customer"].(map[string]any)["email"] != "buyer@zudomart.test" {
		t.Fatal("the verified account email must be sent as the customer email")
	}
	if _, err := provider.InitializeCharge(context.Background(), interfaces.ChargeRequest{IdempotencyKey: "k", AmountMinor: 100, Currency: "NGN", ConnectedAccountId: "acct", PlatformFeeMinor: 100}); err == nil {
		t.Fatal("a platform fee equal to the gross amount must be refused before calling Bachs")
	}
}

func TestCompletedCheckoutIsReadBackWithChargeFeesAndUnknownFieldsIgnored(t *testing.T) {
	provider, recorder := startFixtureServer(t, fixtureResponse{http.StatusOK, "getCheckoutSession.completed.response.json"})
	verification, err := provider.VerifyCharge(context.Background(), interfaces.ChargeLookup{Reference: "zmpay_abc", ProviderCheckoutId: "chk_9f3a71c4e05b", ConnectedAccountId: "acct_seller"})
	if err != nil || verification.Outcome != interfaces.OutcomeSucceeded || verification.AmountMinor != 600_000 || verification.ProviderFeeMinor != 9_000 ||
		verification.PlatformFeeMinor != 30_000 || verification.ProviderChargeId != "pay_1a2b3c4d5e" {
		t.Fatalf("verification %+v err %v", verification, err)
	}
	if exchange := recorder.only(t); exchange.method != http.MethodGet || exchange.accountId != "acct_seller" || exchange.idempotencyKey != "" {
		t.Fatalf("request %+v", exchange)
	}
}

func TestPartialRefundTransfersPayoutsAndBalancesUseDecimalStrings(t *testing.T) {
	provider, recorder := startFixtureServer(t,
		fixtureResponse{http.StatusOK, "createRefund.response.json"}, fixtureResponse{http.StatusOK, "createTransfer.response.json"},
		fixtureResponse{http.StatusOK, "createTransfer.response.json"}, fixtureResponse{http.StatusOK, "createPayout.response.json"},
		fixtureResponse{http.StatusOK, "getBalances.response.json"})
	ctx := context.Background()
	refund, err := provider.RefundCharge(ctx, interfaces.RefundRequest{ProviderChargeId: "ch_1a2b3c4d5e6f", ConnectedAccountId: "acct_seller", RefundReference: "escrow-refund:1", IdempotencyKey: "refund:1", AmountMinor: 250_000, Currency: "NGN"})
	if err != nil || refund.Outcome != interfaces.OutcomePending || refund.ProviderRefundId == "" {
		t.Fatalf("refund %+v %v", refund, err)
	}
	topUp, err := provider.CreateTransfer(ctx, interfaces.TransferRequest{ToConnectedAccountId: "acct_seller", AmountMinor: 39_000, Currency: "NGN", TransferGroup: "zmpay_abc", IdempotencyKey: "fee-topup:1"})
	if err != nil || topUp.Outcome != interfaces.OutcomeSucceeded {
		t.Fatalf("transfer %+v %v", topUp, err)
	}
	if _, err := provider.CreateTransfer(ctx, interfaces.TransferRequest{FromConnectedAccountId: "acct_seller", AmountMinor: 100, Currency: "NGN", IdempotencyKey: "back:1"}); err != nil {
		t.Fatal(err)
	}
	payout, err := provider.CreatePayout(ctx, interfaces.PayoutRequest{ConnectedAccountId: "acct_seller", ProviderDestinationId: "pd_7Kq2mNv4XbR9dLc0", AmountMinor: 95_000, Currency: "NGN", Reference: "zmwd_1", IdempotencyKey: "payout:zmwd_1"})
	if err != nil || payout.Outcome != interfaces.OutcomePending || payout.FeeMinor != 5_000 || payout.TotalDebitedMinor != 100_000 {
		t.Fatalf("payout %+v %v", payout, err)
	}
	balances, err := provider.ReadBalances(ctx, "acct_seller")
	if err != nil || len(balances) != 2 || balances[0].AvailableMinor != -26_000 || balances[0].PendingMinor != 125_000 {
		t.Fatalf("balances %+v %v", balances, err)
	}
	exchanges := recorder.exchanges
	if exchanges[0].body["amount"] != "2500.00" || exchanges[0].body["idempotency_key"] != "refund:1" || exchanges[0].accountId != "acct_seller" {
		t.Fatalf("refund request %+v", exchanges[0])
	}
	if exchanges[1].body["destination"] != "acct_seller" || exchanges[1].accountId != "" || exchanges[1].body["amount"] != "390.00" {
		t.Fatalf("platform to seller transfer %+v", exchanges[1])
	}
	if exchanges[2].body["destination"] != "self" || exchanges[2].accountId != "acct_seller" {
		t.Fatalf("seller to platform transfer %+v", exchanges[2])
	}
	if exchanges[3].body["amount"] != "950.00" || exchanges[3].idempotencyKey != "payout:zmwd_1" || exchanges[3].accountId != "acct_seller" {
		t.Fatalf("payout request %+v", exchanges[3])
	}
	for _, exchange := range exchanges {
		if exchange.method != http.MethodGet && exchange.idempotencyKey == "" {
			t.Fatalf("mutation without an idempotency key: %+v", exchange)
		}
	}
}

func TestSellerAccountRequestsMerchantAndRecipientCapabilitiesAndAManualSchedule(t *testing.T) {
	provider, recorder := startFixtureServer(t, fixtureResponse{http.StatusCreated, "createAccount.response.json"}, fixtureResponse{http.StatusOK, ""}, fixtureResponse{http.StatusOK, ""})
	state, err := provider.CreateConnectedAccount(context.Background(), interfaces.ConnectedAccountRequest{ContactEmail: "ada@zudomart.test", DisplayName: "Ada", Country: "NG", AcceptPayments: true, IdempotencyKey: "connected-account:u1"})
	if err != nil || state.AccountId != "acct_3Wq8ZfT1yHnJ5sVe" || state.CapabilityStatuses["ngn_card_collection"] != "restricted" || len(state.OutstandingRequirements) != 2 || state.CurrentDeadline == nil {
		t.Fatalf("state %+v %v", state, err)
	}
	if err := provider.UseManualPayoutSchedule(context.Background(), state.AccountId, "NGN"); err != nil {
		t.Fatal(err)
	}
	configuration := recorder.exchanges[0].body["configuration"].(map[string]any)
	if configuration["merchant"] == nil || configuration["recipient"] == nil || recorder.exchanges[0].body["responsibilities"] == nil {
		t.Fatalf("account request %+v", recorder.exchanges[0].body)
	}
	schedule := recorder.exchanges[2]
	if schedule.path != "/v1/balance_settings" || schedule.accountId != state.AccountId || schedule.body["schedule_by_currency"].(map[string]any)["NGN"].(map[string]any)["interval"] != "manual" {
		t.Fatalf("schedule request %+v", schedule)
	}
}

func TestOnlyIdempotentRequestsAreRetriedAndProviderErrorCodesAreMapped(t *testing.T) {
	provider, recorder := startFixtureServer(t, fixtureResponse{http.StatusBadGateway, ""}, fixtureResponse{http.StatusOK, "getBalances.response.json"})
	if _, err := provider.ReadBalances(context.Background(), ""); err != nil || len(recorder.exchanges) != 2 {
		t.Fatalf("a GET was not retried after a 502: %v (%d calls)", err, len(recorder.exchanges))
	}
	provider, recorder = startFixtureServer(t, fixtureResponse{http.StatusBadRequest, "insufficientBalance.error.json"})
	_, err := provider.CreateTransfer(context.Background(), interfaces.TransferRequest{ToConnectedAccountId: "acct", AmountMinor: 100, Currency: "NGN", IdempotencyKey: "t:1"})
	var requestError *ProviderRequestError
	if !errors.Is(err, interfaces.ErrInsufficientProviderBalance) || !errors.As(err, &requestError) || !requestError.IsDefinitiveRejection() || len(recorder.exchanges) != 1 {
		t.Fatalf("400 must not be retried and must map to insufficient balance: %v (%d calls)", err, len(recorder.exchanges))
	}
	if err := provider.http.send(context.Background(), bachsRequest{method: http.MethodPost, path: "/v1/transfers"}, nil); err == nil {
		t.Fatal("a mutation without an idempotency key must never be sent")
	}
	unconfigured := NewBachsConnectProvider(BachsConnectSettings{})
	if _, err := unconfigured.ReadBalances(context.Background(), ""); !errors.Is(err, interfaces.ErrProviderNotConfigured) {
		t.Fatalf("unconfigured provider: %v", err)
	}
}
