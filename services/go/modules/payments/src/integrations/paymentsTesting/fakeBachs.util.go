package paymentstesting

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"zudomart/modules/payments/src/utils"
)

const (
	FakeBachsSecretKey     = "sk_sandbox_fake_bachs"
	FakeBachsSigningSecret = "whsec_fake_bachs"
	FakeBachsPlatformId    = "acct_platform"
	fakeNairaPayoutFee     = 5_000
)

type FakeCheckout struct {
	Id               string
	Reference        string
	AccountId        string
	AmountMinor      int64
	PlatformFeeMinor int64
	Currency         string
	Status           string
	ChargeId         string
	ProcessingFee    int64
	CustomerEmail    string
}

type FakePayout struct {
	Id, AccountId, Reference, Currency, Status string
	AmountMinor, FeeMinor                      int64
}

type FakeBachs struct {
	Server               *httptest.Server
	mutex                sync.Mutex
	nextId               int
	Accounts             map[string]map[string]string
	ManualSchedules      map[string]bool
	Checkouts            map[string]*FakeCheckout
	Balances             map[string]map[string]int64
	Payouts              map[string]*FakePayout
	Transfers            map[string]map[string]any
	Disputes             map[string][]map[string]any
	Refunds              []map[string]any
	idempotentResponses  map[string][]byte
	CallCounts           map[string]int
	MissingIdempotency   int
	FailNextRequestsWith int
}

func StartFakeBachs(t *testing.T) *FakeBachs {
	t.Helper()
	fake := &FakeBachs{
		Accounts: map[string]map[string]string{}, ManualSchedules: map[string]bool{}, Checkouts: map[string]*FakeCheckout{},
		Balances: map[string]map[string]int64{FakeBachsPlatformId: {}}, Payouts: map[string]*FakePayout{}, Transfers: map[string]map[string]any{},
		Disputes: map[string][]map[string]any{}, idempotentResponses: map[string][]byte{}, CallCounts: map[string]int{},
	}
	fake.Server = httptest.NewServer(http.HandlerFunc(fake.serve))
	t.Cleanup(fake.Server.Close)
	return fake
}

func (fake *FakeBachs) newId(prefix string) string {
	fake.nextId++
	return fmt.Sprintf("%s_%06d", prefix, fake.nextId)
}

type fakeRequest struct {
	method, path, accountId string
	segments                []string
	body                    map[string]any
	query                   map[string]string
}

func (fake *FakeBachs) serve(writer http.ResponseWriter, request *http.Request) {
	if request.Header.Get("Authorization") != "Bearer "+FakeBachsSecretKey {
		writeFakeJson(writer, http.StatusUnauthorized, map[string]any{"error_code": "UNAUTHORIZED", "detail": "bad key"})
		return
	}
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	if fake.FailNextRequestsWith > 0 {
		fake.FailNextRequestsWith--
		writeFakeJson(writer, http.StatusBadGateway, map[string]any{"error_code": "UPSTREAM", "detail": "try again"})
		return
	}
	key := request.Header.Get("Idempotency-Key")
	if request.Method != http.MethodGet && key == "" {
		fake.MissingIdempotency++
		writeFakeJson(writer, http.StatusBadRequest, map[string]any{"error_code": "IDEMPOTENCY_KEY_REQUIRED", "detail": "missing key"})
		return
	}
	cacheKey := request.Method + " " + request.URL.Path + " " + request.Header.Get("X-Account-Id") + " " + key
	if cached, found := fake.idempotentResponses[cacheKey]; found && key != "" {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write(cached)
		return
	}
	parsed := fakeRequest{method: request.Method, path: request.URL.Path, accountId: request.Header.Get("X-Account-Id"), body: map[string]any{}, query: map[string]string{}}
	parsed.segments = strings.Split(strings.Trim(request.URL.Path, "/"), "/")
	_ = json.NewDecoder(request.Body).Decode(&parsed.body)
	for name, values := range request.URL.Query() {
		parsed.query[name] = values[0]
	}
	fake.CallCounts[request.Method+" "+routePattern(parsed.segments)]++
	status, response := fake.route(parsed)
	encoded, _ := json.Marshal(response)
	if status < 300 && key != "" {
		fake.idempotentResponses[cacheKey] = encoded
	}
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_, _ = writer.Write(encoded)
}

func routePattern(segments []string) string {
	pattern := make([]string, len(segments))
	for index, segment := range segments {
		pattern[index] = segment
		if strings.Contains(segment, "_") && index > 1 {
			pattern[index] = "{id}"
		}
	}
	return "/" + strings.Join(pattern, "/")
}

func writeFakeJson(writer http.ResponseWriter, status int, body any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(body)
}

func fakeError(code, detail string) map[string]any {
	return map[string]any{"error_code": code, "detail": detail}
}

func decimal(amountMinor int64, currency string) string {
	formatted, _ := utils.FormatMinorUnitsAsMajorDecimal(amountMinor, currency)
	return string(formatted)
}

func minor(raw any, currency string) int64 {
	text, _ := raw.(string)
	amount, _ := utils.ParseMajorDecimalToMinorUnits(text, currency)
	return amount
}

func (fake *FakeBachs) balance(accountId, currency string) int64 {
	if accountId == "" {
		accountId = FakeBachsPlatformId
	}
	return fake.Balances[accountId][currency]
}

func (fake *FakeBachs) adjust(accountId, currency string, delta int64) {
	if accountId == "" {
		accountId = FakeBachsPlatformId
	}
	if fake.Balances[accountId] == nil {
		fake.Balances[accountId] = map[string]int64{}
	}
	fake.Balances[accountId][currency] += delta
}

func (fake *FakeBachs) BalanceOf(accountId, currency string) int64 {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	return fake.balance(accountId, currency)
}

func (fake *FakeBachs) FundPlatformBalance(currency string, amountMinor int64) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	fake.adjust(FakeBachsPlatformId, currency, amountMinor)
}

func (fake *FakeBachs) Calls(pattern string) int {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	return fake.CallCounts[pattern]
}
