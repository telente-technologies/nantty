package paymentstesting

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"testing"
	"time"

	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/interfaces"
)

func writeSmokeFlutterwaveWebhook(writer http.ResponseWriter, body []byte, headers http.Header) {
	if body == nil {
		writeFakeJson(writer, http.StatusNotFound, map[string]any{"message": "unknown subject"})
		return
	}
	writeFakeJson(writer, http.StatusOK, map[string]any{"body": string(body), "signatureHeader": integrations.FlutterwaveSignatureHeader, "signature": headers.Get(integrations.FlutterwaveSignatureHeader)})
}

func (fake *FakeFlutterwave) walletRefByNuban(nuban string) string {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for _, wallet := range fake.Wallets {
		if containsString(wallet.FundingNumbers, nuban) {
			return wallet.Ref
		}
	}
	return ""
}

func queryAmount(request *http.Request, name string) int64 {
	value, _ := strconv.ParseInt(request.URL.Query().Get(name), 10, 64)
	return value
}

func mountFlutterwaveSmokeControls(mux *http.ServeMux, fake *FakeFlutterwave) {
	mux.HandleFunc("POST /__smoke/charges/{reference}/complete", func(writer http.ResponseWriter, request *http.Request) {
		transaction := fake.CompleteCheckout(request.PathValue("reference"), queryAmount(request, "amount"), queryAmount(request, "fee"), "card")
		if transaction == nil {
			writeSmokeFlutterwaveWebhook(writer, nil, nil)
			return
		}
		body, headers := fake.ChargeWebhook(transaction)
		writeSmokeFlutterwaveWebhook(writer, body, headers)
	})
	mux.HandleFunc("POST /__smoke/wallets/{nuban}/fund", func(writer http.ResponseWriter, request *http.Request) {
		ref := fake.walletRefByNuban(request.PathValue("nuban"))
		if ref == "" {
			writeSmokeFlutterwaveWebhook(writer, nil, nil)
			return
		}
		body, headers := fake.FundWalletAndSignWebhook(ref, queryAmount(request, "amount"), request.URL.Query().Get("reference"), queryAmount(request, "hint"))
		writeSmokeFlutterwaveWebhook(writer, body, headers)
	})
	mux.HandleFunc("POST /__smoke/wallets/{nuban}/{action}", func(writer http.ResponseWriter, request *http.Request) {
		ref := fake.walletRefByNuban(request.PathValue("nuban"))
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
		fake.LoseNextWriteReply(FakeWriteKind(request.PathValue("kind")))
		writeFakeJson(writer, http.StatusOK, map[string]any{"armed": request.PathValue("kind")})
	})
	mux.HandleFunc("POST /__smoke/rate-limit/{count}", func(writer http.ResponseWriter, request *http.Request) {
		count, _ := strconv.Atoi(request.PathValue("count"))
		fake.SetRateLimitedRequests(count)
		writeFakeJson(writer, http.StatusOK, map[string]any{"rateLimited": count})
	})
	mux.HandleFunc("GET /__smoke/state", func(writer http.ResponseWriter, _ *http.Request) {
		fake.mutex.Lock()
		defer fake.mutex.Unlock()
		state, _ := json.Marshal(map[string]any{"transactions": len(fake.Transactions), "transfers": fake.Transfers, "refunds": fake.Refunds, "mainBalance": fake.MainBalance, "requests": fake.Requests})
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write(state)
	})
}

func TestServeFakeFlutterwaveForLocalApiSmoke(t *testing.T) {
	address := os.Getenv("FAKE_FLUTTERWAVE_LISTEN_ADDRESS")
	if address == "" {
		t.Skip("set FAKE_FLUTTERWAVE_LISTEN_ADDRESS to serve the fake Flutterwave for the sandbox stack")
	}
	fake := NewFakeFlutterwave()
	fake.nextId = time.Now().UnixMilli()
	fake.PublicUrl = "http://" + address
	fake.FundMainBalance("NGN", 1_000_000_000)
	mux := http.NewServeMux()
	mountFlutterwaveSmokeControls(mux, fake)
	mux.HandleFunc("/", fake.serve)
	t.Logf("fake Flutterwave listening on %s", address)
	if err := http.ListenAndServe(address, mux); err != nil {
		t.Fatal(err)
	}
}
