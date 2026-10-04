package paymentstesting

import (
	"encoding/json"
	"net/http"
	"os"
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
	fake.FundPlatformBalance("NGN", 1_000_000_000)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /__smoke/charges/{reference}/complete", func(writer http.ResponseWriter, request *http.Request) {
		transaction := fake.CompleteCheckout(request.PathValue("reference"), 0, 0, "card")
		if transaction == nil {
			writeFakeJson(writer, http.StatusNotFound, map[string]any{"message": "unknown reference"})
			return
		}
		writeSignedSmokeWebhook(writer, "charge.success", map[string]any{"id": eventIdBase + transaction.Id, "reference": transaction.Reference, "status": "success", "amount": transaction.AmountMinor, "currency": transaction.Currency, "channel": "card"})
	})
	mux.HandleFunc("POST /__smoke/transfers/{reference}/{status}", func(writer http.ResponseWriter, request *http.Request) {
		transfer := fake.SetTransferStatus(request.PathValue("reference"), request.PathValue("status"))
		if transfer == nil {
			writeFakeJson(writer, http.StatusNotFound, map[string]any{"message": "unknown transfer"})
			return
		}
		writeSignedSmokeWebhook(writer, "transfer."+transfer.Status, map[string]any{"reference": transfer.Reference, "status": transfer.Status, "transfer_code": transfer.Code, "amount": transfer.AmountMinor, "currency": "NGN"})
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
