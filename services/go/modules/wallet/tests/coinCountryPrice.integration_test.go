package wallet_test

import (
	"net/http"
	"testing"
)

func TestAdminCoinCountryPriceOverrideRoundTripsAndRejectsCurrencyMismatch(t *testing.T) {
	harness := startWalletHarness(t, true)
	staff := harness.Tokens.StaffTokens("pricing-editor", "money.monetization.manage", "money.monetization.read")
	row := map[string]any{
		"name": "100 coins", "clientPlatform": "web", "coins": 100, "bonusCoins": 0,
		"prices":         map[string]int64{"NGN": 100_000, "USD": 99},
		"countryPrices":  map[string]any{"NG": map[string]any{"currency": "NGN", "amountMinor": 125_000}},
		"storeProductId": "", "active": true, "sortOrder": 1, "reason": "country pricing regression",
	}

	saved := harness.Call(http.MethodPut, "/api/v1/admin/coins/price-table/web-coins-1", staff.AccessToken, "", row, staff.StepUp())
	if saved.Status != http.StatusOK {
		t.Fatalf("save country override: %d %s", saved.Status, saved.Raw)
	}
	listed := harness.Call(http.MethodGet, "/api/v1/admin/coins/price-table", staff.AccessToken, "", nil, nil)
	if listed.Status != http.StatusOK {
		t.Fatalf("list country override: %d %s", listed.Status, listed.Raw)
	}
	var found map[string]any
	for _, item := range listed.Body["data"].([]any) {
		candidate := item.(map[string]any)
		if candidate["id"] == "web-coins-1" {
			found = candidate
			break
		}
	}
	countryPrice := found["countryPrices"].(map[string]any)["NG"].(map[string]any)
	if countryPrice["currency"] != "NGN" || countryPrice["amountMinor"] != float64(125_000) {
		t.Fatalf("country price did not round-trip: %v", found)
	}
	row["countryPrices"] = map[string]any{"NG": map[string]any{"currency": "USD", "amountMinor": 125_000}}
	row["reason"] = "reject mismatched country currency"
	invalid := harness.Call(http.MethodPut, "/api/v1/admin/coins/price-table/web-coins-1", staff.AccessToken, "", row, staff.StepUp())
	if invalid.Status != http.StatusUnprocessableEntity {
		t.Fatalf("mismatched country currency should be rejected: %d %s", invalid.Status, invalid.Raw)
	}
	row["prices"] = map[string]int64{"ngn": 100_000, "usd": 99}
	row["countryPrices"] = map[string]any{"ng": map[string]any{"currency": "NGN", "amountMinor": 125_000}}
	row["reason"] = "normalize supported pricing codes"
	canonical := harness.Call(http.MethodPut, "/api/v1/admin/coins/price-table/web-coins-1", staff.AccessToken, "", row, staff.StepUp())
	if canonical.Status != http.StatusOK || canonical.Body["prices"].(map[string]any)["NGN"] != float64(100_000) || canonical.Body["countryPrices"].(map[string]any)["NG"] == nil {
		t.Fatalf("supported currency and country codes should be stored canonically: %d %s", canonical.Status, canonical.Raw)
	}
	row["countryPrices"] = map[string]any{
		"NG": map[string]any{"currency": "NGN", "amountMinor": 125_000},
		"ng": map[string]any{"currency": "NGN", "amountMinor": 130_000},
	}
	row["reason"] = "reject ambiguous country aliases"
	duplicate := harness.Call(http.MethodPut, "/api/v1/admin/coins/price-table/web-coins-1", staff.AccessToken, "", row, staff.StepUp())
	if duplicate.Status != http.StatusUnprocessableEntity {
		t.Fatalf("case-variant country aliases must not produce nondeterministic prices: %d %s", duplicate.Status, duplicate.Raw)
	}
}
