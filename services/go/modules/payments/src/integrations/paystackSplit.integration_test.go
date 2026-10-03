package integrations

import (
	"context"
	"net/http"
	"testing"

	"zudomart/modules/payments/src/interfaces"
)

func TestOneCheckoutTransactionSplitsOnlyTheDirectGroups(t *testing.T) {
	provider, recorder := startPaystackFixtureServer(t, paystackFixtureResponse{http.StatusOK, "initializeTransaction.response.json"})
	_, err := provider.InitializeCharge(context.Background(), interfaces.ChargeRequest{
		Reference: "chk-multi-1", AmountMinor: 3_000_000, Currency: "NGN", CustomerEmail: "ada@zudomart.test", SuccessUrl: "https://zudomart.test/pay/return",
		SplitShares: []interfaces.SplitShare{{Subaccount: "ACCT_direct_1", ShareMinor: 1_980_000}, {Subaccount: "ACCT_direct_2", ShareMinor: 495_000}},
	})
	if err != nil {
		t.Fatal(err)
	}
	body := recorder.exchanges[0].body
	split, _ := body["split"].(map[string]any)
	subaccounts, _ := split["subaccounts"].([]any)
	if split["type"] != "flat" || split["bearer_type"] != "account" || len(subaccounts) != 2 || body["subaccount"] != nil || body["amount"].(float64) != 3_000_000 {
		t.Fatalf("body %+v", body)
	}
	if first := subaccounts[0].(map[string]any); first["subaccount"] != "ACCT_direct_1" || first["share"].(float64) != 1_980_000 {
		t.Fatalf("share %+v", first)
	}
	if _, err := provider.InitializeCharge(context.Background(), interfaces.ChargeRequest{
		Reference: "chk-multi-2", AmountMinor: 1_000, Currency: "NGN", CustomerEmail: "ada@zudomart.test", SplitShares: []interfaces.SplitShare{{Subaccount: "ACCT_x", ShareMinor: 2_000}},
	}); err == nil || len(recorder.exchanges) != 1 {
		t.Fatal("shares above the amount must be refused before calling Paystack")
	}
}
