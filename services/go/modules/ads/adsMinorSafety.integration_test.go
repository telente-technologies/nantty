package ads

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"testing"
	"time"

	"nantty/modules/ads/src"
	"nantty/modules/ads/src/configs"
)

type viewerAgesByUser struct {
	mutex  sync.Mutex
	adults map[string]bool
	failed map[string]bool
}

func (ages *viewerAgesByUser) IsAdultViewer(_ context.Context, userId string) (bool, error) {
	ages.mutex.Lock()
	defer ages.mutex.Unlock()
	if ages.failed[userId] {
		return false, errors.New("age lookup unavailable")
	}
	return ages.adults[userId], nil
}

func bundleWithCategory(startAt, category, headline string) map[string]any {
	bundle := bundleFor(startAt)
	bundle["campaign"].(map[string]any)["adCategory"] = category
	bundle["ads"].([]any)[0].(map[string]any)["creative"].(map[string]any)["headline"] = headline
	return bundle
}

func (h *harness) approvedFundedAd(advertiser, staff testUser, idempotencyKey string, bundle map[string]any) string {
	h.t.Helper()
	account := h.expect("POST", "/api/v1/ads/accounts", &advertiser, idempotencyKey+"-account", map[string]any{"name": "Shop " + idempotencyKey, "kind": "personal", "storeId": nil, "countryCode": "NG", "timezone": "Africa/Lagos"}, http.StatusCreated)
	created := h.expect("POST", "/api/v1/ads/accounts/"+account["id"].(string)+"/campaigns", &advertiser, idempotencyKey, bundle, http.StatusCreated)
	adId := created["ads"].([]any)[0].(map[string]any)["id"].(string)
	h.expect("POST", "/api/v1/admin/ads/"+adId+"/approve", &staff, "", map[string]any{"overrideCriticalFlags": true}, http.StatusOK)
	if err := h.module.Container.Client.AdAccount.UpdateOneID(mustParseUuid(h.t, account["id"].(string))).SetBalanceMinor(50_000_000).Exec(context.Background()); err != nil {
		h.t.Fatal(err)
	}
	return adId
}

func startAdsWithViewerAges(t *testing.T, ages *viewerAgesByUser) *harness {
	return startAdsAgainstFreshSchema(t, func(collaborators *src.Collaborators, _ *configs.AdsSettings) {
		collaborators.ViewerAge = ages
	})
}

func TestMinorsGetContextualAgeSafeAdsOnly(t *testing.T) {
	ages := &viewerAgesByUser{adults: map[string]bool{}, failed: map[string]bool{}}
	h := startAdsWithViewerAges(t, ages)
	ctx := context.Background()
	advertiser, staff := h.newUser("advertiser.minors"), h.newUser("reviewer.minors", "name:Rita", "perm:ads:review", "perm:config:revenue")
	adult, minor, unknown, lookupFails := h.newUser("adult.viewer"), h.newUser("minor.viewer"), h.newUser("unknown.viewer"), h.newUser("broken.viewer")
	ages.adults[adult.id.String()] = true
	ages.failed[lookupFails.id.String()] = true
	start := h.clock.Now().Add(-time.Hour).Format(time.RFC3339)
	alcoholAdId := h.approvedFundedAd(advertiser, staff, "alcohol-key", bundleWithCategory(start, "alcohol", "Premium lager"))
	cryptoAdId := h.approvedFundedAd(advertiser, staff, "crypto-key", bundleWithCategory(start, "general", "Trade bitcoin today"))
	if err := h.module.Container.Candidates.ReloadFromDatabase(ctx); err != nil {
		t.Fatal(err)
	}
	for _, viewer := range []testUser{minor, unknown, lookupFails} {
		decision := h.expect("POST", "/api/v1/ads/decide", &viewer, "", map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "s-" + viewer.id.String()}, http.StatusOK)
		if decision["ad"] != nil || decision["declinedReason"] != "no_eligible_ad" {
			t.Fatalf("age-restricted ads must never reach a minor or an unknown age: %v", decision)
		}
	}
	spoofed := h.expect("POST", "/api/v1/ads/decide", &adult, "", map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "s-spoof", "viewer": map[string]any{"ageBand": "13-17"}}, http.StatusOK)
	if spoofed["ad"] != nil {
		t.Fatalf("a client saying the viewer is a minor is always respected: %v", spoofed)
	}
	served := h.expect("POST", "/api/v1/ads/decide", &adult, "", map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "s-adult"}, http.StatusOK)
	ad, _ := served["ad"].(map[string]any)
	if ad == nil || (ad["adId"] != alcoholAdId && ad["adId"] != cryptoAdId) {
		t.Fatalf("adults still see adults-only categories: %v", served)
	}

	generalAdId := h.approvedFundedAd(advertiser, staff, "general-key", bundleWithCategory(start, "general", "Fresh fabrics"))
	if err := h.module.Container.Candidates.ReloadFromDatabase(ctx); err != nil {
		t.Fatal(err)
	}
	for index := range 5 {
		decision := h.expect("POST", "/api/v1/ads/decide", &minor, "", map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "s-minor-" + string(rune('a'+index))}, http.StatusOK)
		ad, _ := decision["ad"].(map[string]any)
		if ad == nil || ad["adId"] != generalAdId {
			t.Fatalf("minors see ads, but only safe categories: %v", decision)
		}
	}
}

func TestAdvertisersCannotTargetUnderEighteenAndCategoriesAreValidated(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	advertiser, staff := h.newUser("advertiser.targeting"), h.newUser("reviewer.targeting", "name:Rita", "perm:ads:review", "perm:config:revenue")
	account := h.expect("POST", "/api/v1/ads/accounts", &advertiser, "targeting-account", map[string]any{"name": "Teen Shop", "kind": "personal", "storeId": nil, "countryCode": "NG", "timezone": "Africa/Lagos"}, http.StatusCreated)
	path := "/api/v1/ads/accounts/" + account["id"].(string) + "/campaigns"
	start := h.clock.Now().Add(-time.Hour).Format(time.RFC3339)
	for name, ages := range map[string][2]int{"thirteen to seventeen": {13, 17}, "sixteen up": {16, 65}} {
		bundle := bundleFor(start)
		audience := bundle["adSet"].(map[string]any)["audience"].(map[string]any)
		audience["ageMin"], audience["ageMax"] = ages[0], ages[1]
		if status, body := h.call("POST", path, &advertiser, "teen-"+name, bundle); status != http.StatusUnprocessableEntity && status != http.StatusBadRequest {
			t.Fatalf("%s: targeting below 18 must be refused: %d %v", name, status, body)
		}
	}
	if status, _ := h.call("POST", path, &advertiser, "bad-category", bundleWithCategory(start, "fireworks", "Fresh fabrics")); status != http.StatusUnprocessableEntity && status != http.StatusBadRequest {
		t.Fatalf("an unknown category must be refused, got %d", status)
	}
	created := h.expect("POST", path, &advertiser, "dating-key", bundleWithCategory(start, "dating", "Meet people"), http.StatusCreated)
	campaignId := created["campaign"].(map[string]any)["id"].(string)
	if created["campaign"].(map[string]any)["adCategory"] != "dating" {
		t.Fatalf("the campaign category is returned: %v", created["campaign"])
	}
	if status, _ := h.call("PATCH", path+"/"+campaignId, &advertiser, "", map[string]any{"adCategory": "general"}); status != http.StatusUnprocessableEntity && status != http.StatusBadRequest {
		t.Fatalf("an adults-only campaign cannot be relabelled general, got %d", status)
	}
	general := h.expect("POST", path, &advertiser, "general-2", bundleWithCategory(start, "", "Fresh fabrics"), http.StatusCreated)
	adId := general["ads"].([]any)[0].(map[string]any)["id"].(string)
	if status, _ := h.call("POST", "/api/v1/admin/ads/"+adId+"/approve", &staff, "", map[string]any{"adCategory": "casino"}); status != http.StatusBadRequest && status != http.StatusUnprocessableEntity {
		t.Fatalf("an unknown review category must be refused, got %d", status)
	}
	approved := h.expect("POST", "/api/v1/admin/ads/"+adId+"/approve", &staff, "", map[string]any{"adCategory": "gambling"}, http.StatusOK)
	if approved["adCategory"] != "gambling" || approved["ageRestricted"] != true {
		t.Fatalf("the reviewer can mark an ad adults-only: %v", approved)
	}
}
