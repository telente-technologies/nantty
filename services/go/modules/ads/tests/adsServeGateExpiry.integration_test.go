package ads_test

import (
	"context"
	"net/http"
	"testing"
	"time"
)

func TestServeGateIgnoresExpiredAdCredit(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	ctx := context.Background()
	advertiser, viewer, staff := h.newUser("creditonly"), h.newUser("creditviewer"), h.newUser("creditreviewer", "name:Rita", "perm:ads:review", "perm:config:revenue")
	account := h.expect("POST", "/api/v1/ads/accounts", &advertiser, "credit-account", map[string]any{"name": "Credit Shop", "kind": "personal", "storeId": nil, "countryCode": "NG", "timezone": "Africa/Lagos"}, http.StatusCreated)
	accountId := account["id"].(string)
	bundle := h.expect("POST", "/api/v1/ads/accounts/"+accountId+"/campaigns", &advertiser, "credit-bundle", bundleFor(h.clock.Now().Add(-time.Hour).Format(time.RFC3339)), http.StatusCreated)
	adId := bundle["ads"].([]any)[0].(map[string]any)["id"].(string)
	h.expect("POST", "/api/v1/admin/ads/"+adId+"/approve", &staff, "", map[string]any{}, http.StatusOK)
	expiresAt := h.clock.Now().Add(time.Hour)
	if err := h.module.Container.Client.AdAccount.UpdateOneID(mustParseUuid(t, accountId)).SetBalanceMinor(0).SetCreditMinor(50_000_000).SetCreditExpiresAt(expiresAt).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if err := h.module.Container.Candidates.ReloadFromDatabase(ctx); err != nil {
		t.Fatal(err)
	}
	live := h.expect("POST", "/api/v1/ads/decide", &viewer, "", map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "credit-live"}, http.StatusOK)
	if served, _ := live["ad"].(map[string]any); served == nil || served["adId"] != adId {
		t.Fatalf("unexpired credit must still fund delivery: %v", live)
	}

	h.clock.Advance(2 * time.Hour)
	expired := h.expect("POST", "/api/v1/ads/decide", &viewer, "", map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "credit-expired"}, http.StatusOK)
	if expired["ad"] != nil {
		t.Fatalf("an account whose only credit expired must not be served: %v", expired)
	}
	if err := h.module.Container.Candidates.ReloadFromDatabase(ctx); err != nil {
		t.Fatal(err)
	}
	reloaded := h.expect("POST", "/api/v1/ads/decide", &viewer, "", map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "credit-reloaded"}, http.StatusOK)
	if reloaded["ad"] != nil {
		t.Fatalf("a reloaded index must also drop expired credit: %v", reloaded)
	}
}
