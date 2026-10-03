package paymentstesting

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"zudomart/modules/payments/src/integrations"
)

const FakePaystackSecretKey = "sk_test_fake_paystack"

type FakeTransaction struct {
	Id                int64
	Reference         string
	AmountMinor       int64
	Currency          string
	Email             string
	Subaccount        string
	Bearer            string
	PlanCode          string
	Channel           string
	Status            string
	FeeMinor          int64
	CustomerCode      string
	AuthorizationCode string
	Metadata          map[string]any
	PaidAt            time.Time
}

type FakeTransfer struct {
	Reference, Recipient, Status, Code string
	AmountMinor, FeeMinor              int64
}

type FakePaystack struct {
	Server               *httptest.Server
	mutex                sync.Mutex
	nextId               int64
	Transactions         map[string]*FakeTransaction
	Transfers            map[string]*FakeTransfer
	Recipients           map[string]map[string]any
	Subaccounts          map[string]map[string]any
	Refunds              []map[string]any
	Disputes             []map[string]any
	Subscriptions        map[string]map[string]any
	PlatformBalance      map[string]int64
	SubaccountBalances   map[string]int64
	CallCounts           map[string]int
	RecipientCreations   int
	SubaccountCreations  int
	FailNextRequests     int
	RefundsNeedAttention bool
}

func StartFakePaystack(t *testing.T) *FakePaystack {
	t.Helper()
	fake := &FakePaystack{
		Transactions: map[string]*FakeTransaction{}, Transfers: map[string]*FakeTransfer{}, Recipients: map[string]map[string]any{},
		Subaccounts: map[string]map[string]any{}, Subscriptions: map[string]map[string]any{}, PlatformBalance: map[string]int64{}, SubaccountBalances: map[string]int64{},
		CallCounts: map[string]int{},
	}
	fake.Server = httptest.NewServer(http.HandlerFunc(fake.serve))
	t.Cleanup(fake.Server.Close)
	return fake
}

func (fake *FakePaystack) newId(prefix string) string {
	fake.nextId++
	return fmt.Sprintf("%s_%06d", prefix, fake.nextId)
}

type fakeRequest struct {
	method, path string
	segments     []string
	body         map[string]any
	query        map[string]string
}

func (fake *FakePaystack) serve(writer http.ResponseWriter, request *http.Request) {
	if request.Header.Get("Authorization") != "Bearer "+FakePaystackSecretKey {
		writeFakeJson(writer, http.StatusUnauthorized, map[string]any{"status": false, "message": "Invalid key"})
		return
	}
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	if fake.FailNextRequests > 0 {
		fake.FailNextRequests--
		writeFakeJson(writer, http.StatusBadGateway, map[string]any{"status": false, "message": "upstream unavailable"})
		return
	}
	parsed := fakeRequest{method: request.Method, path: request.URL.Path, body: map[string]any{}, query: map[string]string{}}
	parsed.segments = strings.Split(strings.Trim(request.URL.Path, "/"), "/")
	decoder := json.NewDecoder(request.Body)
	decoder.UseNumber()
	_ = decoder.Decode(&parsed.body)
	for name, values := range request.URL.Query() {
		parsed.query[name] = values[0]
	}
	fake.CallCounts[request.Method+" /"+parsed.segments[0]]++
	status, data, meta := fake.route(parsed)
	envelope := map[string]any{"status": status < 300, "message": "ok", "data": data}
	if meta != nil {
		envelope["meta"] = meta
	}
	if status >= 300 {
		envelope["message"], envelope["code"] = data, fakeErrorCode(data)
		delete(envelope, "data")
	}
	writeFakeJson(writer, status, envelope)
}

func fakeErrorCode(message any) string {
	if text, ok := message.(string); ok && strings.Contains(text, "balance") {
		return "insufficient_balance"
	}
	return ""
}

func writeFakeJson(writer http.ResponseWriter, status int, body any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(body)
}

func number(value any) int64 {
	switch typed := value.(type) {
	case json.Number:
		parsed, _ := typed.Int64()
		return parsed
	case float64:
		return int64(typed)
	}
	return 0
}

func text(value any) string {
	if typed, ok := value.(string); ok {
		return typed
	}
	if typed, ok := value.(json.Number); ok {
		return typed.String()
	}
	return ""
}

func (fake *FakePaystack) Calls(pattern string) int {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	return fake.CallCounts[pattern]
}

func (fake *FakePaystack) PlatformBalanceOf(currency string) int64 {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	return fake.PlatformBalance[currency]
}

func (fake *FakePaystack) FundPlatformBalance(currency string, amountMinor int64) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	fake.PlatformBalance[currency] += amountMinor
}

func (fake *FakePaystack) CompleteCheckout(reference string, paidAmountOverride, feeMinor int64, channel string) *FakeTransaction {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	transaction := fake.Transactions[reference]
	if transaction == nil {
		return nil
	}
	if paidAmountOverride > 0 {
		transaction.AmountMinor = paidAmountOverride
	}
	transaction.Status, transaction.FeeMinor, transaction.PaidAt = "success", feeMinor, time.Now().UTC()
	transaction.Channel = channel
	if transaction.CustomerCode == "" {
		transaction.CustomerCode = "CUS_" + strings.ReplaceAll(transaction.Email, "@", "_")
	}
	if channel == "card" {
		transaction.AuthorizationCode = fmt.Sprintf("AUTH_%06d", transaction.Id)
	}
	fake.creditForTransaction(transaction)
	return transaction
}

func (fake *FakePaystack) creditForTransaction(transaction *FakeTransaction) {
	if transaction.Subaccount != "" {
		fake.SubaccountBalances[transaction.Subaccount] += transaction.AmountMinor - transaction.FeeMinor
		return
	}
	fake.PlatformBalance[transaction.Currency] += transaction.AmountMinor - transaction.FeeMinor
}

func (fake *FakePaystack) SetTransferStatus(reference, status string) *FakeTransfer {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	transfer := fake.Transfers[strings.ToLower(reference)]
	if transfer == nil {
		return nil
	}
	if transfer.Status != "failed" && (status == "failed" || status == "reversed") {
		fake.PlatformBalance["NGN"] += transfer.AmountMinor + transfer.FeeMinor
	}
	transfer.Status = status
	return transfer
}

func SignedPaystackWebhook(event string, data map[string]any) ([]byte, http.Header) {
	body, _ := json.Marshal(map[string]any{"event": event, "data": data})
	return body, http.Header{integrations.PaystackSignatureHeader: {integrations.SignPaystackWebhookPayload(FakePaystackSecretKey, body)}}
}
