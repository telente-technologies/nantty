package wallet

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"nantty/platform/regionpricing"
)

func TestCoinPurchasePriceComesFromTheServerNotTheRegionHeader(t *testing.T) {
	harness := startWalletHarness(t, false)
	usdPrice := regionpricing.CoinPackPrices(100, "web")["USD"]
	if usdPrice <= 0 {
		t.Fatal("the web catalogue must price the first pack in USD")
	}
	buyer := uuid.NewString()
	token := harness.Tokens.UserAccessToken(buyer)

	listed := harness.Call(http.MethodGet, "/api/v1/coins/packages", token, "", nil, http.Header{"X-Client-Region": {"NG"}})
	if price := listed.Body["data"].([]any)[0].(map[string]any)["price"].(map[string]any); price["currency"] != "USD" || int64(price["amountMinor"].(float64)) != usdPrice {
		t.Fatalf("an unverified region hint must not localise the checkout price: %v", price)
	}
	tampered := harness.Call(http.MethodPost, "/api/v1/coins/purchases", token, "tamper-"+buyer[:8], map[string]any{"packageId": "web-coins-1"}, http.Header{"X-Client-Region": {"NG"}})
	if tampered.Status != http.StatusUnprocessableEntity || tampered.Body["code"] != "COUNTRY_REQUIRED" {
		t.Fatalf("with no trusted country the buyer must pick a country, never a fallback or the header's price: %d %s", tampered.Status, tampered.Raw)
	}

	nigerian := uuid.NewString()
	verified := harness.Call(http.MethodPost, "/api/v1/coins/purchases", harness.Tokens.UserAccessToken(nigerian), "verified-"+nigerian[:8], map[string]any{"packageId": "web-coins-1"},
		http.Header{"CloudFront-Viewer-Country": {"NG"}, "X-Client-Region": {"US"}})
	if verified.Status != http.StatusCreated {
		t.Fatalf("start purchase: %d %s", verified.Status, verified.Raw)
	}
	charged := verified.Body["purchase"].(map[string]any)["amount"].(map[string]any)
	if charged["currency"] != "NGN" || charged["amountMinor"].(float64) != 100_000 {
		t.Fatalf("the trusted country decides the price, the header does not: %v", charged)
	}
	converted := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", harness.Tokens.UserAccessToken(nigerian), "convert-"+nigerian[:8], map[string]any{"coins": 100, "currency": "USD"},
		http.Header{"CloudFront-Viewer-Country": {"NG"}, "X-Client-Region": {"US"}})
	if converted.Status != http.StatusUnprocessableEntity || converted.Body["code"] != "CURRENCY_NOT_ALLOWED" {
		t.Fatalf("earned coins must convert only into the verified country's currency: %d %s", converted.Status, converted.Raw)
	}
}
