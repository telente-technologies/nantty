package paymentstesting_test

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"testing"

	"nantty/modules/payments/src/integrations"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/interfaces"
)

func writeFakeJson(writer http.ResponseWriter, status int, body any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(body)
}

func writeSmokeFlutterwaveWebhook(writer http.ResponseWriter, body []byte, headers http.Header) {
	if body == nil {
		writeFakeJson(writer, http.StatusNotFound, map[string]any{"message": "unknown subject"})
		return
	}
	writeFakeJson(writer, http.StatusOK, map[string]any{"body": string(body), "signatureHeader": integrations.FlutterwaveSignatureHeader, "signature": headers.Get(integrations.FlutterwaveSignatureHeader)})
}

func queryAmount(request *http.Request, name string) int64 {
	value, _ := strconv.ParseInt(request.URL.Query().Get(name), 10, 64)
	return value
}

func mountFlutterwaveSmokeControls(mux *http.ServeMux, fake *paymentstesting.FakeFlutterwave) {
	mux.HandleFunc("POST /__smoke/charges/{reference}/complete", func(writer http.ResponseWriter, request *http.Request) {
		transaction := fake.CompleteCheckout(request.PathValue("reference"), queryAmount(request, "amount"), queryAmount(request, "fee"), "card")
		if transaction == nil {
			writeSmokeFlutterwaveWebhook(writer, nil, nil)
			return
		}
		if request.URL.Query().Get("card") == "decline" {
			fake.DeclineFutureChargesOn(request.PathValue("reference"))
		}
		body, headers := fake.ChargeWebhook(transaction)
		writeSmokeFlutterwaveWebhook(writer, body, headers)
	})
	mux.HandleFunc("POST /__smoke/wallets/{nuban}/fund", func(writer http.ResponseWriter, request *http.Request) {
		ref := fake.WalletRefByNuban(request.PathValue("nuban"))
		if ref == "" {
			writeSmokeFlutterwaveWebhook(writer, nil, nil)
			return
		}
		body, headers := fake.FundWalletAndSignWebhook(ref, queryAmount(request, "amount"), request.URL.Query().Get("reference"), queryAmount(request, "hint"))
		writeSmokeFlutterwaveWebhook(writer, body, headers)
	})
	mux.HandleFunc("POST /__smoke/wallets/{nuban}/{action}", func(writer http.ResponseWriter, request *http.Request) {
		ref := fake.WalletRefByNuban(request.PathValue("nuban"))
		switch request.PathValue("action") {
		case "delete":
			fake.DeleteWalletAtProvider(ref)
		case "debit":
			fake.DebitWalletOutsideLedger(ref, "NGN", queryAmount(request, "amount"))
		default:
			writeFakeJson(writer, http.StatusNotFound, map[string]any{"message": "unknown action"})
			return
		}
		writeFakeJson(writer, http.StatusOK, map[string]any{"accountRef": ref, "balanceMinor": fake.WalletBalance(ref, "NGN")})
	})
	mux.HandleFunc("POST /__smoke/transfers/{reference}/{outcome}", func(writer http.ResponseWriter, request *http.Request) {
		outcome := map[string]interfaces.ProviderOutcome{"successful": interfaces.OutcomeSucceeded, "failed": interfaces.OutcomeFailed}[request.PathValue("outcome")]
		if outcome == "" || !fake.SetPayoutOutcome(request.PathValue("reference"), outcome) {
			writeSmokeFlutterwaveWebhook(writer, nil, nil)
			return
		}
		body, headers := fake.TransferWebhook(request.PathValue("reference"))
		writeSmokeFlutterwaveWebhook(writer, body, headers)
	})
	mux.HandleFunc("POST /__smoke/settle/{currency}", func(writer http.ResponseWriter, request *http.Request) {
		writeFakeJson(writer, http.StatusOK, map[string]any{"settlementId": fake.SettleAll(request.PathValue("currency"))})
	})
	mux.HandleFunc("POST /__smoke/main/{currency}/fund", func(writer http.ResponseWriter, request *http.Request) {
		fake.FundMainBalance(request.PathValue("currency"), queryAmount(request, "amount"))
		writeFakeJson(writer, http.StatusOK, map[string]any{"balanceMinor": fake.MainBalanceOf(request.PathValue("currency"))})
	})
	mux.HandleFunc("POST /__smoke/fundings/{reference}/reverse", func(writer http.ResponseWriter, request *http.Request) {
		writeFakeJson(writer, http.StatusOK, map[string]any{"reversed": fake.ReverseFundingAtBank(request.PathValue("reference"))})
	})
	mux.HandleFunc("POST /__smoke/chargebacks/{reference}/open", func(writer http.ResponseWriter, request *http.Request) {
		chargeback, opened := fake.OpenChargeback(request.PathValue("reference"), queryAmount(request, "amount"))
		if !opened {
			writeFakeJson(writer, http.StatusNotFound, map[string]any{"message": "no successful charge"})
			return
		}
		writeFakeJson(writer, http.StatusOK, chargeback)
	})
	mux.HandleFunc("POST /__smoke/chargebacks/{id}/{outcome}", func(writer http.ResponseWriter, request *http.Request) {
		writeFakeJson(writer, http.StatusOK, fake.ResolveChargeback(request.PathValue("id"), request.PathValue("outcome") == "won"))
	})
	mux.HandleFunc("POST /__smoke/lose-next/{kind}", func(writer http.ResponseWriter, request *http.Request) {
		fake.LoseNextWriteReply(paymentstesting.FakeWriteKind(request.PathValue("kind")))
		writeFakeJson(writer, http.StatusOK, map[string]any{"armed": request.PathValue("kind")})
	})
	mux.HandleFunc("POST /__smoke/rate-limit/{count}", func(writer http.ResponseWriter, request *http.Request) {
		count, _ := strconv.Atoi(request.PathValue("count"))
		fake.SetRateLimitedRequests(count)
		writeFakeJson(writer, http.StatusOK, map[string]any{"rateLimited": count})
	})
	mux.HandleFunc("GET /__smoke/state", func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write(fake.SmokeStateJSON())
	})
}

func TestServeFakeFlutterwaveForLocalApiSmoke(t *testing.T) {
	address := os.Getenv("FAKE_FLUTTERWAVE_LISTEN_ADDRESS")
	if address == "" {
		t.Skip("set FAKE_FLUTTERWAVE_LISTEN_ADDRESS to serve the fake Flutterwave for the sandbox stack")
	}
	fake := paymentstesting.NewFakeFlutterwave()
	fake.FundMainBalance("NGN", 1_000_000_000)
	fake.PublicUrl = "http://" + address
	mux := http.NewServeMux()
	mountFlutterwaveSmokeControls(mux, fake)
	mux.Handle("/", fake)
	t.Logf("fake Flutterwave listening on %s", address)
	if err := http.ListenAndServe(address, mux); err != nil {
		t.Fatal(err)
	}
}
