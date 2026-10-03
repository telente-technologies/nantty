package paymentstesting

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

const FakePaystackSecretKey = "sk_test_fake_paystack"

type fakeCharge struct {
	Reference string
	Amount    int64
	Currency  string
	Status    string
	Fees      int64
	Id        int64
}

type FakePaystack struct {
	Server          *httptest.Server
	mutex           sync.Mutex
	charges         map[string]*fakeCharge
	transfers       map[string]string
	TransferOutcome string
	RefundOutcome   string
	RefundCalls     int
	TransferCalls   int
	nextId          int64
}

func StartFakePaystack(t *testing.T) *FakePaystack {
	t.Helper()
	fake := &FakePaystack{charges: map[string]*fakeCharge{}, transfers: map[string]string{}, TransferOutcome: "success", RefundOutcome: "processed", nextId: 1000}
	fake.Server = httptest.NewServer(http.HandlerFunc(fake.serve))
	t.Cleanup(fake.Server.Close)
	return fake
}

func (fake *FakePaystack) respond(writer http.ResponseWriter, status int, data any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(map[string]any{"status": status < 300, "message": "ok", "data": data})
}

func (fake *FakePaystack) serve(writer http.ResponseWriter, request *http.Request) {
	if request.Header.Get("Authorization") != "Bearer "+FakePaystackSecretKey {
		fake.respond(writer, http.StatusUnauthorized, nil)
		return
	}
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	var body map[string]any
	_ = json.NewDecoder(request.Body).Decode(&body)
	path := request.URL.Path
	switch {
	case request.Method == http.MethodPost && path == "/transaction/initialize":
		reference, _ := body["reference"].(string)
		amount, _ := body["amount"].(float64)
		currency, _ := body["currency"].(string)
		fake.nextId++
		fake.charges[reference] = &fakeCharge{Reference: reference, Amount: int64(amount), Currency: currency, Status: "ongoing", Id: fake.nextId}
		fake.respond(writer, http.StatusOK, map[string]any{"authorization_url": "https://checkout.paystack.test/" + reference})
	case request.Method == http.MethodGet && strings.HasPrefix(path, "/transaction/verify/"):
		charge, found := fake.charges[strings.TrimPrefix(path, "/transaction/verify/")]
		if !found {
			fake.respond(writer, http.StatusNotFound, nil)
			return
		}
		fake.respond(writer, http.StatusOK, map[string]any{"id": charge.Id, "status": charge.Status, "reference": charge.Reference, "amount": charge.Amount, "fees": charge.Fees, "currency": charge.Currency})
	case request.Method == http.MethodGet && path == "/transaction":
		var settled []map[string]any
		for _, charge := range fake.charges {
			if charge.Status == "success" {
				settled = append(settled, map[string]any{"reference": charge.Reference, "amount": charge.Amount, "currency": charge.Currency, "status": "success"})
			}
		}
		fake.respond(writer, http.StatusOK, settled)
	case request.Method == http.MethodPost && path == "/refund":
		fake.RefundCalls++
		fake.nextId++
		fake.respond(writer, http.StatusOK, map[string]any{"id": fake.nextId, "status": fake.RefundOutcome})
	case request.Method == http.MethodPost && path == "/transferrecipient":
		fake.respond(writer, http.StatusOK, map[string]any{"recipient_code": "RCP_test"})
	case request.Method == http.MethodPost && path == "/transfer":
		fake.TransferCalls++
		reference, _ := body["reference"].(string)
		fake.transfers[reference] = fake.TransferOutcome
		fake.respond(writer, http.StatusOK, map[string]any{"transfer_code": "TRF_" + reference, "status": fake.TransferOutcome})
	case request.Method == http.MethodGet && strings.HasPrefix(path, "/transfer/verify/"):
		reference := strings.TrimPrefix(path, "/transfer/verify/")
		fake.respond(writer, http.StatusOK, map[string]any{"transfer_code": "TRF_" + reference, "status": fake.transfers[reference]})
	case request.Method == http.MethodGet && path == "/bank/resolve":
		if strings.HasPrefix(request.URL.Query().Get("account_number"), "000") {
			fake.respond(writer, http.StatusUnprocessableEntity, nil)
			return
		}
		fake.respond(writer, http.StatusOK, map[string]any{"account_name": "TEMITOPE ADEYEMI"})
	case request.Method == http.MethodGet && path == "/bank":
		fake.respond(writer, http.StatusOK, []map[string]any{{"code": "058", "name": "Guaranty Trust Bank", "active": true}, {"code": "057", "name": "Zenith Bank", "active": true}})
	default:
		fake.respond(writer, http.StatusNotFound, nil)
	}
}

func (fake *FakePaystack) MarkChargeAs(reference, status string, amountOverride int64, fees int64) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	charge := fake.charges[reference]
	if charge == nil {
		return
	}
	charge.Status = status
	charge.Fees = fees
	if amountOverride > 0 {
		charge.Amount = amountOverride
	}
}

func (fake *FakePaystack) SetTransferStatus(reference, status string) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	fake.transfers[reference] = status
}

func (fake *FakePaystack) ChargeId(reference string) int64 {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	if charge := fake.charges[reference]; charge != nil {
		return charge.Id
	}
	return 0
}

func SignedPaystackWebhook(event string, data map[string]any) ([]byte, http.Header) {
	body, _ := json.Marshal(map[string]any{"event": event, "data": data})
	mac := hmac.New(sha512.New, []byte(FakePaystackSecretKey))
	mac.Write(body)
	headers := http.Header{}
	headers.Set("X-Paystack-Signature", hex.EncodeToString(mac.Sum(nil)))
	headers.Set("Content-Type", "application/json")
	return body, headers
}
