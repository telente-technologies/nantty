package paymentstesting

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"nantty/modules/payments/src/integrations"
	"nantty/platform/money"
)

const (
	FakeFlutterwaveSecretKey   = "FLWSECK_TEST-fakeflutterwave0000000000-X"
	FakeFlutterwaveWebhookHash = "fake-flutterwave-webhook-hash-0123456789abcdef"
	FakeFlutterwaveMerchantId  = "F400000001"
)

type FakeFlwTransaction struct {
	Id                            int64
	TxRef, FlwRef, Email, Name    string
	AmountMinor, AppFeeMinor      int64
	Currency, Status, PaymentType string
	CardToken                     string
	Settled                       bool
	RefundedMinor                 int64
	CreatedAt                     time.Time
}

type FakeFlwWallet struct {
	Ref, BarterId, Nuban, Email, Name, Status string
	BalanceMinor                              int64
	Lines                                     []map[string]any
	FundingNumbers                            []string
}

type FakeFlwTransfer struct {
	Id                                                int64
	Reference, Status, Currency, AccountBank, Account string
	DebitSubaccount, Narration, CompleteMessage       string
	AmountMinor, FeeMinor                             int64
	Internal                                          bool
	SkipBeneficiary                                   bool
}

type FakeFlutterwave struct {
	Server                *httptest.Server
	mutex                 sync.Mutex
	nextId                int64
	Transactions          map[int64]*FakeFlwTransaction
	Tokens                map[string]string
	Wallets               map[string]*FakeFlwWallet
	Transfers             map[string]*FakeFlwTransfer
	Refunds               []map[string]any
	Chargebacks           []map[string]any
	Settlements           []map[string]any
	Reversals             []map[string]any
	Consents              map[string]map[string]any
	MainBalance           map[string]int64
	CallCounts            map[string]int
	Requests              []string
	Queries               []string
	BankAccountNames      map[string]string
	PayoutFeeValue        any
	FundingFeeMinor       int64
	BankTransferFeeMinor  int64
	RateLimitNext         int
	FailNextRequests      int
	LoseNextChargeReply   bool
	LoseNextRefundReply   bool
	LoseNextTransferReply bool
	RejectPayloadHash     bool
	PublicUrl             string
	RefundDelay           time.Duration
	RefundStatus          string
	DecliningTokens       map[string]bool
	OmitReversalPageInfo  bool
	IgnoreReversalPage    bool
	OmitRefundListMeta    bool
	RefundListTotalPages  int
}

func StartFakeFlutterwave(t *testing.T) *FakeFlutterwave {
	t.Helper()
	fake := NewFakeFlutterwave()
	fake.Server = httptest.NewServer(http.HandlerFunc(fake.serve))
	t.Cleanup(fake.Server.Close)
	return fake
}

func NewFakeFlutterwave() *FakeFlutterwave {
	return &FakeFlutterwave{
		Transactions: map[int64]*FakeFlwTransaction{}, Tokens: map[string]string{}, Wallets: map[string]*FakeFlwWallet{}, Transfers: map[string]*FakeFlwTransfer{},
		Consents: map[string]map[string]any{}, MainBalance: map[string]int64{}, CallCounts: map[string]int{}, BankAccountNames: map[string]string{},
		Refunds: []map[string]any{}, Chargebacks: []map[string]any{}, Settlements: []map[string]any{}, Reversals: []map[string]any{},
		FundingFeeMinor: 5000, BankTransferFeeMinor: 1075, nextId: 7_000_000, DecliningTokens: map[string]bool{},
	}
}

func (fake *FakeFlutterwave) newId() int64 {
	fake.nextId++
	return fake.nextId
}

func fakeMajor(amountMinor int64, currency string) json.Number {
	text, _ := money.FormatMajorUnits(amountMinor, currency)
	return json.Number(text)
}

func fakeMinor(value any, currency string) (int64, bool) {
	var raw string
	switch typed := value.(type) {
	case json.Number:
		raw = typed.String()
	case string:
		raw = typed
	default:
		return 0, false
	}
	amount, err := money.ParseMajorUnits(raw, currency)
	return amount, err == nil && amount > 0
}

type fakeFlwRequest struct {
	method   string
	segments []string
	body     map[string]any
	query    map[string]string
}

func (fake *FakeFlutterwave) serve(writer http.ResponseWriter, request *http.Request) {
	if request.Header.Get("Authorization") != "Bearer "+FakeFlutterwaveSecretKey {
		writeFakeJson(writer, http.StatusUnauthorized, map[string]any{"status": "error", "message": "Invalid authorization key", "data": nil})
		return
	}
	if fake.RefundDelay > 0 && request.Method == http.MethodPost && strings.HasSuffix(request.URL.Path, "/refund") {
		time.Sleep(fake.RefundDelay)
	}
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	parsed := fakeFlwRequest{method: request.Method, body: map[string]any{}, query: map[string]string{}}
	parsed.segments = strings.Split(strings.Trim(strings.TrimPrefix(request.URL.Path, "/v3"), "/"), "/")
	decoder := json.NewDecoder(request.Body)
	decoder.UseNumber()
	_ = decoder.Decode(&parsed.body)
	for name, values := range request.URL.Query() {
		parsed.query[name] = values[0]
	}
	fake.CallCounts[request.Method+" /"+parsed.segments[0]]++
	fake.Requests = append(fake.Requests, request.Method+" "+request.URL.Path)
	fake.Queries = append(fake.Queries, request.URL.Query().Encode())
	if fake.RateLimitNext > 0 {
		fake.RateLimitNext--
		writer.Header().Set("Retry-After", "0")
		writeFakeJson(writer, http.StatusTooManyRequests, map[string]any{"status": "error", "message": "Too many requests", "data": nil})
		return
	}
	if fake.FailNextRequests > 0 {
		fake.FailNextRequests--
		writeFakeJson(writer, http.StatusServiceUnavailable, map[string]any{"status": "error", "message": "Service unavailable", "data": nil})
		return
	}
	status, data, meta := fake.route(parsed)
	if lost := fake.consumeLostReply(parsed); lost && status < 300 {
		writeFakeJson(writer, http.StatusServiceUnavailable, map[string]any{"status": "error", "message": "Gateway timeout", "data": nil})
		return
	}
	if status >= 300 {
		writeFakeJson(writer, status, map[string]any{"status": "error", "message": data, "data": nil})
		return
	}
	envelope := map[string]any{"status": "success", "message": "ok", "data": data}
	if meta != nil {
		envelope["meta"] = meta
	}
	writeFakeJson(writer, status, envelope)
}

func (fake *FakeFlutterwave) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	fake.serve(writer, request)
}

func (fake *FakeFlutterwave) consumeLostReply(request fakeFlwRequest) bool {
	if request.method != http.MethodPost {
		return false
	}
	switch {
	case request.segments[0] == "transfers" && len(request.segments) == 1 && fake.LoseNextTransferReply:
		fake.LoseNextTransferReply = false
		return true
	case request.segments[0] == "tokenized-charges" && fake.LoseNextChargeReply:
		fake.LoseNextChargeReply = false
		return true
	case request.segments[0] == "transactions" && len(request.segments) == 3 && request.segments[2] == "refund" && fake.LoseNextRefundReply:
		fake.LoseNextRefundReply = false
		return true
	}
	return false
}

func (fake *FakeFlutterwave) route(request fakeFlwRequest) (int, any, any) {
	switch request.segments[0] {
	case "payments", "transactions", "tokenized-charges", "refunds":
		return fake.routeCharges(request)
	case "payout-subaccounts":
		return fake.routeWallets(request)
	case "transfers":
		return fake.routeTransfers(request)
	case "balances", "settlements", "chargebacks", "banks", "accounts", "bvn":
		return fake.routeAccounts(request)
	}
	return http.StatusNotFound, "Route not found", nil
}

func (fake *FakeFlutterwave) publicUrl() string {
	if fake.PublicUrl != "" {
		return fake.PublicUrl
	}
	return fake.Server.URL
}

func (fake *FakeFlutterwave) Link(reference string) string {
	return fake.publicUrl() + "/hosted/pay/" + reference
}

func fakeFlwHeaders() http.Header {
	return http.Header{integrations.FlutterwaveSignatureHeader: {FakeFlutterwaveWebhookHash}}
}

func SignedFlutterwaveWebhook(event string, data map[string]any) ([]byte, http.Header) {
	body, _ := json.Marshal(map[string]any{"event": event, "event.type": strings.ToUpper(strings.ReplaceAll(event, ".", "_")), "data": data})
	return body, fakeFlwHeaders()
}

func (fake *FakeFlutterwave) Calls(pattern string) int {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	return fake.CallCounts[pattern]
}

func (fake *FakeFlutterwave) RequestLog() []string {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	return append([]string(nil), fake.Requests...)
}

func (fake *FakeFlutterwave) QueryLog() []string {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	return append([]string(nil), fake.Queries...)
}

func (fake *FakeFlutterwave) walletByBarter(barterId string) *FakeFlwWallet {
	for _, wallet := range fake.Wallets {
		if wallet.BarterId == barterId {
			return wallet
		}
	}
	return nil
}

func (fake *FakeFlutterwave) walletLine(wallet *FakeFlwWallet, kind, reference string, amountMinor int64, remarks string) {
	wallet.Lines = append(wallet.Lines, map[string]any{
		"type": kind, "amount": fakeMajorGrouped(amountMinor), "currency": "NGN", "reference": reference, "remarks": remarks,
		"date": time.Now().UTC().Format(time.RFC3339),
	})
}

func fakeMajorGrouped(amountMinor int64) string {
	whole, fraction, _ := strings.Cut(fakeMajor(amountMinor, "NGN").String(), ".")
	var grouped []string
	for len(whole) > 3 {
		grouped = append([]string{whole[len(whole)-3:]}, grouped...)
		whole = whole[:len(whole)-3]
	}
	grouped = append([]string{whole}, grouped...)
	return strings.Join(grouped, ",") + "." + fraction
}
