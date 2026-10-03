package ads

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/services"
)

func nigeriaAudience() map[string]any {
	return map[string]any{
		"locations":         []any{map[string]any{"type": "country", "code": "NG", "name": "Nigeria", "countryCode": "NG", "parentName": nil}},
		"excludedLocations": []any{}, "ageMin": 18, "ageMax": 65, "gender": "all", "topicIds": []any{}, "behaviourIds": []any{}, "customAudienceIds": []any{}, "excludedCustomAudienceIds": []any{},
	}
}

func bundleFor(startAt string) map[string]any {
	return map[string]any{
		"campaign": map[string]any{"name": "Launch", "objective": "awareness", "budgetLevel": "campaign", "budget": map[string]any{"type": "daily", "amount": map[string]any{"amountMinor": 1_000_000, "currency": "NGN"}}, "spendCap": nil, "schedule": map[string]any{"startAt": startAt, "endAt": nil}},
		"adSet": map[string]any{
			"name": "All Nigeria", "audience": nigeriaAudience(), "placementMode": "automatic", "placements": []any{}, "schedule": map[string]any{"startAt": startAt, "endAt": nil}, "budget": nil,
			"bidStrategy": map[string]any{"type": "auto", "amount": nil}, "frequencyCap": nil, "conversionEventId": nil,
		},
		"ads": []any{map[string]any{"name": "Ad 1", "creative": map[string]any{
			"format": "feed_post", "source": map[string]any{"type": "post", "id": "post-1"}, "mediaIds": []any{"m1"}, "headline": "Fresh fabrics", "primaryText": "Lagos delivery",
			"callToAction": "shop_now", "destination": map[string]any{"type": "post", "targetId": "post-1", "url": nil},
		}}},
		"submitForReview": true,
	}
}

func TestAdvertiserToImpressionToSettlementFlow(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	ctx := context.Background()
	advertiser, viewer, staff := h.newUser("advertiser"), h.newUser("viewer"), h.newUser("reviewer", "name:Rita", "perm:ads:review", "perm:config:revenue")

	account := h.expect("POST", "/api/v1/ads/accounts", &advertiser, "create-account-1", map[string]any{"name": "Fabric Shop", "kind": "personal", "storeId": nil, "countryCode": "NG", "timezone": "Africa/Lagos"}, http.StatusCreated)
	accountId := account["id"].(string)
	if account["currency"] != "NGN" || account["myRole"] != "admin" {
		t.Fatalf("unexpected account %v", account)
	}
	h.expect("POST", "/api/v1/ads/accounts/"+accountId+"/campaigns", &viewer, "bundle-denied", bundleFor(time.Now().Add(-time.Hour).Format(time.RFC3339)), http.StatusNotFound)

	bundle := h.expect("POST", "/api/v1/ads/accounts/"+accountId+"/campaigns", &advertiser, "bundle-1", bundleFor(h.clock.Now().Add(-time.Hour).Format(time.RFC3339)), http.StatusCreated)
	adId := bundle["ads"].([]any)[0].(map[string]any)["id"].(string)
	if bundle["campaign"].(map[string]any)["status"] != "in_review" {
		t.Fatalf("submitted campaign must be in review: %v", bundle["campaign"])
	}
	h.expect("POST", "/api/v1/admin/ads/"+adId+"/approve", &advertiser, "", map[string]any{}, http.StatusForbidden)
	h.expect("POST", "/api/v1/admin/ads/"+adId+"/approve", &staff, "", map[string]any{}, http.StatusOK)
	h.expect("POST", "/api/v1/admin/ads/"+adId+"/approve", &staff, "", map[string]any{}, http.StatusConflict)

	accountUuid := mustParseUuid(t, accountId)
	if err := h.module.Container.Client.AdAccount.UpdateOneID(accountUuid).SetBalanceMinor(50_000_000).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if err := h.module.Container.Candidates.ReloadFromDatabase(ctx); err != nil {
		t.Fatal(err)
	}

	decision := h.expect("POST", "/api/v1/ads/decide", &viewer, "", map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "session-1"}, http.StatusOK)
	served, _ := decision["ad"].(map[string]any)
	if served == nil || served["adId"] != adId || served["label"] != "Ad" {
		t.Fatalf("expected the approved ad to be served, got %v", decision)
	}
	token := served["impressionToken"].(string)

	events := h.expect("POST", "/api/v1/ads/events", &viewer, "", map[string]any{"events": []any{
		map[string]any{"token": token, "type": "impression"},
		map[string]any{"token": token, "type": "view", "watchMs": 1500, "visiblePercent": 80},
		map[string]any{"token": token, "type": "view", "watchMs": 1500, "visiblePercent": 80},
		map[string]any{"token": token + "x", "type": "impression"},
	}}, http.StatusOK)
	if events["accepted"].(float64) != 2 || events["duplicates"].(float64) != 1 || len(events["rejected"].([]any)) != 1 {
		t.Fatalf("expected 2 accepted, 1 duplicate, 1 rejected (tampered): %v", events)
	}
	stranger := h.newUser("stranger")
	mismatch := h.expect("POST", "/api/v1/ads/events", &stranger, "", map[string]any{"events": []any{map[string]any{"token": token, "type": "click"}}}, http.StatusOK)
	if mismatch["rejected"].([]any)[0].(map[string]any)["reason"] != "token_user_mismatch" {
		t.Fatalf("a token must not be usable by another viewer: %v", mismatch)
	}

	day := services.DayKeyInTimezone(h.clock.Now(), "Africa/Lagos")
	report := h.expect("GET", fmt.Sprintf("/api/v1/ads/accounts/%s/reports?from=%s&to=%s&breakdown=campaign", accountId, day, day), &advertiser, "", nil, http.StatusOK)
	totals := report["totals"].(map[string]any)
	if totals["impressions"].(float64) != 1 || totals["spend"].(map[string]any)["amountMinor"].(float64) != 50 {
		t.Fatalf("a single bidder pays the reserve (50 minor per impression): %v", totals)
	}

	settlement := services.AdSettlement{Client: h.module.Container.Client, Now: h.clock.Now}
	if settled, err := settlement.SettlePendingCharges(ctx); err != nil || settled != 1 {
		t.Fatalf("expected one impression settled, got %d %v", settled, err)
	}
	if settled, _ := settlement.SettlePendingCharges(ctx); settled != 0 {
		t.Fatal("settled impressions must never be billed twice")
	}
	reloaded, _ := h.module.Container.Client.AdAccount.Get(ctx, accountUuid)
	if reloaded.BalanceMinor != 50_000_000-50 {
		t.Fatalf("balance should drop by the cleared price, got %d", reloaded.BalanceMinor)
	}
}

func TestFrequencyCapStopsTheSecondAdInTheSameSession(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	ctx := context.Background()
	advertiser, viewer, staff := h.newUser("advertiser2"), h.newUser("viewer2"), h.newUser("reviewer2", "name:Rita", "perm:ads:review", "perm:config:revenue")
	account := h.expect("POST", "/api/v1/ads/accounts", &advertiser, "create-account-2", map[string]any{"name": "Shop 2", "kind": "personal", "storeId": nil, "countryCode": "NG", "timezone": "Africa/Lagos"}, http.StatusCreated)
	accountId := account["id"].(string)
	bundle := h.expect("POST", "/api/v1/ads/accounts/"+accountId+"/campaigns", &advertiser, "bundle-2", bundleFor(h.clock.Now().Add(-time.Hour).Format(time.RFC3339)), http.StatusCreated)
	h.expect("POST", "/api/v1/admin/ads/"+bundle["ads"].([]any)[0].(map[string]any)["id"].(string)+"/approve", &staff, "", map[string]any{}, http.StatusOK)
	_ = h.module.Container.Client.AdAccount.UpdateOneID(mustParseUuid(t, accountId)).SetBalanceMinor(50_000_000).Exec(ctx)
	_ = h.module.Container.Candidates.ReloadFromDatabase(ctx)
	h.expect("PUT", "/api/v1/admin/ads-policies/frequency/feed", &staff, "", map[string]any{"sessionCap": 1, "hourCap": 10, "dayCap": 10, "advertiserDayCap": 10, "minGapSlots": 0, "cooldownSecondsAfterSkip": 0, "active": true}, http.StatusNoContent)

	request := map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "session-cap"}
	first := h.expect("POST", "/api/v1/ads/decide", &viewer, "", request, http.StatusOK)
	second := h.expect("POST", "/api/v1/ads/decide", &viewer, "", request, http.StatusOK)
	if first["ad"] == nil || second["ad"] != nil || second["declinedReason"] != "no_eligible_ad" {
		t.Fatalf("the session cap of one must block the second ad: %v %v", first, second)
	}
}

func mustParseUuid(t *testing.T, value string) uuid.UUID {
	t.Helper()
	parsed, err := uuid.Parse(value)
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}
