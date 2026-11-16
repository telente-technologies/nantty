package ads_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
)

func (h *harness) callWithHeaders(method, path string, user *testUser, idempotencyKey string, body any, headers map[string]string) (int, map[string]any) {
	h.t.Helper()
	encoded, _ := json.Marshal(body)
	request, _ := http.NewRequest(method, h.server.URL+path, bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+user.token)
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		h.t.Fatal(err)
	}
	defer response.Body.Close()
	decoded := map[string]any{}
	_ = json.NewDecoder(response.Body).Decode(&decoded)
	return response.StatusCode, decoded
}

func TestBoostPriceIgnoresATamperedRegionHeader(t *testing.T) {
	money := newFakeMoneyAccounts()
	topUps := &fakeTopUps{status: "pending"}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, topUps))
	buyer := h.newUser("nkem")
	tamper := map[string]string{"X-Client-Region": "US"}

	status, options := h.callWithHeaders("GET", "/api/v1/ads/boosts/options?currency=USD", &buyer, "", nil, tamper)
	if status != http.StatusOK || options["minimumDailyBudget"].(map[string]any)["currency"] != "NGN" {
		t.Fatalf("options must be priced for the verified country, not the header or query: %d %v", status, options)
	}
	usd := boostBody("card", 100_000, 3)
	usd["dailyBudget"] = map[string]any{"amountMinor": 100_000, "currency": "USD"}
	if status, refused := h.callWithHeaders("POST", "/api/v1/ads/boosts", &buyer, "tamper-boost-usd", usd, tamper); status != http.StatusUnprocessableEntity || refused["code"] != "BOOST_CURRENCY_NOT_ALLOWED" {
		t.Fatalf("a currency from another region must be refused: %d %v", status, refused)
	}
	status, created := h.callWithHeaders("POST", "/api/v1/ads/boosts", &buyer, "tamper-boost-ngn", boostBody("card", 100_000, 3), map[string]string{"X-Client-Region": "GH"})
	if status != http.StatusCreated {
		t.Fatalf("a boost in the verified currency must be accepted: %d %v", status, created)
	}
	if len(topUps.started) != 1 || topUps.started[0].Currency != "NGN" || topUps.started[0].AmountMinor != 300_000 {
		t.Fatalf("the charge must be the server price in NGN: %+v", topUps.started)
	}
	account, err := h.module.Container.Client.AdAccount.Get(context.Background(), mustParseUuid(t, topUps.started[0].AdAccountId))
	if err != nil || account.CountryCode != "NG" || account.Currency != "NGN" {
		t.Fatalf("the boost account must use the verified country, not the header: %+v %v", account, err)
	}
}
