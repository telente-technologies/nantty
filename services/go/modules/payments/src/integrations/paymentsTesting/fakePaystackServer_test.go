package paymentstesting

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"testing"
	"time"

	"zudomart/modules/payments/src/integrations"
)

func writeSignedSmokeWebhook(writer http.ResponseWriter, event string, data map[string]any) {
	body, headers := SignedPaystackWebhook(event, data)
	writeFakeJson(writer, http.StatusOK, map[string]any{"body": string(body), "signature": headers.Get(integrations.PaystackSignatureHeader)})
}

func TestServeFakePaystackForLocalApiSmoke(t *testing.T) {
	address := os.Getenv("FAKE_PAYSTACK_LISTEN_ADDRESS")
	if address == "" {
		t.Skip("set FAKE_PAYSTACK_LISTEN_ADDRESS to serve the fake Paystack for services/scripts/apiSmoke")
	}
	eventIdBase := time.Now().Unix() * 1000
	fake := StartFakePaystack(t)
	fake.nextId = eventIdBase
	fake.FundPlatformBalance("NGN", 1_000_000_000)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /__smoke/charges/{reference}/complete", func(writer http.ResponseWriter, request *http.Request) {
		fee, _ := strconv.ParseInt(request.URL.Query().Get("fee"), 10, 64)
		transaction := fake.CompleteCheckout(request.PathValue("reference"), 0, fee, "card")
		if transaction == nil {
			writeFakeJson(writer, http.StatusNotFound, map[string]any{"message": "unknown reference"})
			return
		}
		if request.URL.Query().Get("card") == "decline" {
			fake.mutex.Lock()
			transaction.AuthorizationCode = fmt.Sprintf("AUTH_DECLINE_%06d", transaction.Id)
			fake.mutex.Unlock()
		}
		writeSignedSmokeWebhook(writer, "charge.success", map[string]any{"id": eventIdBase + transaction.Id, "reference": transaction.Reference, "status": "success", "amount": transaction.AmountMinor, "currency": transaction.Currency, "channel": "card"})
	})
	mux.HandleFunc("POST /__smoke/subscriptions/{reference}/create", func(writer http.ResponseWriter, request *http.Request) {
		fake.mutex.Lock()
		transaction := fake.Transactions[request.PathValue("reference")]
		var data map[string]any
		if transaction != nil && transaction.Status == "success" && transaction.PlanCode != "" {
			fake.nextId++
			code := fmt.Sprintf("SUB_smoke_%d", fake.nextId)
			nextPayment := time.Now().UTC().AddDate(0, 1, 0).Format(time.RFC3339)
			fake.Subscriptions[code] = map[string]any{"subscription_code": code, "email_token": "tok_" + code, "status": "active", "customer": transaction.CustomerCode, "plan": transaction.PlanCode, "next_payment_date": nextPayment}
			data = map[string]any{"id": fake.nextId, "subscription_code": code, "email_token": "tok_" + code, "status": "active", "customer": map[string]any{"customer_code": transaction.CustomerCode}, "plan": map[string]any{"plan_code": transaction.PlanCode}, "next_payment_date": nextPayment}
		}
		fake.mutex.Unlock()
		if data == nil {
			writeFakeJson(writer, http.StatusNotFound, map[string]any{"message": "no paid plan checkout for this reference"})
			return
		}
		writeSignedSmokeWebhook(writer, "subscription.create", data)
	})
	mux.HandleFunc("POST /__smoke/transfers/{reference}/{status}", func(writer http.ResponseWriter, request *http.Request) {
		transfer := fake.SetTransferStatus(request.PathValue("reference"), request.PathValue("status"))
		if transfer == nil {
			writeFakeJson(writer, http.StatusNotFound, map[string]any{"message": "unknown transfer"})
			return
		}
		writeSignedSmokeWebhook(writer, "transfer."+transfer.Status, map[string]any{"reference": transfer.Reference, "status": transfer.Status, "transfer_code": transfer.Code, "amount": transfer.AmountMinor, "currency": "NGN"})
	})
	mux.HandleFunc("POST /__smoke/identifications/{email}/{outcome}", func(writer http.ResponseWriter, request *http.Request) {
		fake.mutex.Lock()
		customer := fake.Customers[request.PathValue("email")]
		identification := fake.Identifications[customer]
		fake.mutex.Unlock()
		if customer == "" || identification == nil {
			writeFakeJson(writer, http.StatusNotFound, map[string]any{"message": "no identification was requested for this email"})
			return
		}
		data := map[string]any{"customer_code": customer, "identification": map[string]any{"country": "NG", "type": "bank_account", "bank_code": identification["bank_code"], "account_number": "012****345"}}
		event := "customeridentification.success"
		if request.PathValue("outcome") != "success" {
			event, data["reason"] = "customeridentification.failed", "Account number or BVN is incorrect"
		}
		writeSignedSmokeWebhook(writer, event, data)
	})
	mux.HandleFunc("GET /__smoke/state", func(writer http.ResponseWriter, _ *http.Request) {
		fake.mutex.Lock()
		defer fake.mutex.Unlock()
		state, _ := json.Marshal(map[string]any{"transactions": len(fake.Transactions), "transfers": fake.Transfers, "refunds": fake.Refunds})
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write(state)
	})
	mux.HandleFunc("/", fake.serve)
	t.Logf("fake Paystack listening on %s", address)
	if err := http.ListenAndServe(address, mux); err != nil {
		t.Fatal(err)
	}
}
