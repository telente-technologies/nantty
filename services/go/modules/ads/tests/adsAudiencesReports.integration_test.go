package ads_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src"
	"nantty/modules/ads/src/configs"
)

type fakeAudienceSource struct{ members []string }

func (source fakeAudienceSource) StoreCustomers(context.Context, string, int, int) ([]string, error) {
	return source.members, nil
}
func (source fakeAudienceSource) Engagers(context.Context, string, string, int) ([]string, error) {
	return source.members, nil
}
func (source fakeAudienceSource) Followers(context.Context, string) ([]string, error) {
	return source.members, nil
}

type fakeIdentityMatcher struct{ byHash map[string]string }

func (matcher fakeIdentityMatcher) MatchEmailHashes(_ context.Context, hashes []string) ([]string, error) {
	matched := []string{}
	for _, hash := range hashes {
		if id, ok := matcher.byHash[hash]; ok {
			matched = append(matched, id)
		}
	}
	return matched, nil
}
func (matcher fakeIdentityMatcher) MatchPhoneHashes(context.Context, []string) ([]string, error) {
	return nil, nil
}

func hashEmail(email string) string {
	digest := sha256.Sum256([]byte(email))
	return hex.EncodeToString(digest[:])
}

func newUserIds(count int) []string {
	ids := make([]string, count)
	for index := range ids {
		ids[index] = uuid.NewString()
	}
	return ids
}

func createAccount(h *harness, owner *testUser, key string) string {
	account := h.expect("POST", "/api/v1/ads/accounts", owner, key, map[string]any{"name": "Fabric Shop", "kind": "personal", "storeId": nil, "countryCode": "NG", "timezone": "Africa/Lagos"}, http.StatusCreated)
	return account["id"].(string)
}

func TestAudiencesBuildMatchRoundAndProtectInUseAudiences(t *testing.T) {
	people := newUserIds(150)
	matcher := fakeIdentityMatcher{byHash: map[string]string{hashEmail("ada@example.com"): uuid.NewString()}}
	h := startAdsAgainstFreshSchema(t, func(collaborators *src.Collaborators, _ *configs.AdsSettings) {
		collaborators.Source, collaborators.Identity = fakeAudienceSource{members: people}, matcher
	})
	owner, outsider := h.newUser("audience-owner"), h.newUser("audience-outsider")
	accountId := createAccount(h, &owner, "audience-account")
	base := "/api/v1/ads/accounts/" + accountId

	engagers := h.expect("POST", base+"/audiences", &owner, "", map[string]any{"type": "engagers", "name": "Watchers", "retentionDays": 30, "engagementSource": "clips_watched"}, http.StatusCreated)
	size := engagers["approximateSize"].(map[string]any)
	if engagers["status"] != "ready" || size["lower"].(float64) >= 150 || size["upper"].(float64) <= 150 {
		t.Fatalf("150 people is ready and exposed only as a range: %v", engagers)
	}
	audienceId := engagers["id"].(string)

	small := h.expect("POST", base+"/audiences/customer-lists", &owner, "list-key-0001", map[string]any{"name": "VIPs", "identifierType": "email", "hashAlgorithm": "sha256", "hashedIdentifiers": []string{hashEmail("ada@example.com"), hashEmail("nobody@example.com")}}, http.StatusCreated)
	if small["status"] != "too_small" {
		t.Fatalf("a list matching fewer than 100 people cannot be targeted: %v", small)
	}
	replay := h.expect("POST", base+"/audiences/customer-lists", &owner, "list-key-0001", map[string]any{"name": "VIPs", "identifierType": "email", "hashAlgorithm": "sha256", "hashedIdentifiers": []string{hashEmail("ada@example.com")}}, http.StatusCreated)
	if replay["id"] != small["id"] {
		t.Fatal("the same Idempotency-Key must return the same audience")
	}
	h.expect("POST", base+"/audiences/customer-lists", &owner, "list-key-0002", map[string]any{"name": "Raw", "identifierType": "email", "hashAlgorithm": "sha256", "hashedIdentifiers": []string{"ada@example.com"}}, http.StatusBadRequest)
	h.expect("POST", base+"/audiences/customer-lists", &outsider, "list-key-0003", map[string]any{"name": "No", "identifierType": "email", "hashAlgorithm": "sha256", "hashedIdentifiers": []string{hashEmail("a@b.c")}}, http.StatusNotFound)

	count, err := h.module.Container.Client.AdAudienceMember.Query().Count(context.Background())
	if err != nil || count != 151 {
		t.Fatalf("only matched people are stored (150 engagers + 1 matched email), got %d %v", count, err)
	}

	lookalike := h.expect("POST", base+"/audiences", &owner, "", map[string]any{"type": "lookalike", "name": "Like watchers", "sourceAudienceId": audienceId, "countryCode": "NG", "similarityPercent": 2}, http.StatusCreated)
	if lookalike["status"] != "ready" {
		t.Fatalf("2%% of nigeria is a ready lookalike: %v", lookalike)
	}
	h.expect("POST", base+"/audiences", &owner, "", map[string]any{"type": "lookalike", "name": "Nested", "sourceAudienceId": lookalike["id"], "countryCode": "NG", "similarityPercent": 2}, http.StatusBadRequest)
	h.expect("POST", base+"/audiences", &owner, "", map[string]any{"type": "lookalike", "name": "Wide", "sourceAudienceId": audienceId, "countryCode": "NG", "similarityPercent": 11}, http.StatusBadRequest)
	h.expect("POST", base+"/audiences", &owner, "", map[string]any{"type": "store_customers", "name": "Buyers", "retentionDays": 30, "minimumOrders": 1}, http.StatusBadRequest)

	h.expect("PATCH", base+"/audiences/"+audienceId, &owner, "", map[string]any{"name": "Clip watchers"}, http.StatusOK)
	list := h.expect("GET", base+"/audiences?type=engagers", &owner, "", nil, http.StatusOK)
	if items := list["data"].([]any); len(items) != 1 || items[0].(map[string]any)["name"] != "Clip watchers" {
		t.Fatalf("unexpected list %v", list)
	}
	h.expect("DELETE", base+"/audiences/"+audienceId, &owner, "", nil, http.StatusConflict)
	h.expect("DELETE", base+"/audiences/"+lookalike["id"].(string), &owner, "", nil, http.StatusNoContent)
	h.expect("DELETE", base+"/audiences/"+audienceId, &owner, "", nil, http.StatusNoContent)

	h.expect("POST", "/internal/v1/ads/audiences/membership", nil, "", map[string]any{"userId": people[0]}, http.StatusUnauthorized)
}

func TestAudienceEstimateReturnsRangesAndRejectsAnEmptyLocationList(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	owner := h.newUser("estimate-owner")
	base := "/api/v1/ads/accounts/" + createAccount(h, &owner, "estimate-account")
	request := map[string]any{
		"objective": "traffic", "audience": nigeriaAudience(), "placements": []any{"feed", "clips"},
		"budget":      map[string]any{"type": "daily", "amount": map[string]any{"amountMinor": 500_000, "currency": "NGN"}},
		"bidStrategy": map[string]any{"type": "auto", "amount": nil}, "schedule": map[string]any{"startAt": time.Now().Format(time.RFC3339), "endAt": nil},
	}
	estimate := h.expect("POST", base+"/estimates/audience", &owner, "", request, http.StatusOK)
	reach := estimate["dailyReach"].(map[string]any)
	if estimate["breadth"] != "broad" || reach["lower"].(float64) >= reach["upper"].(float64) || estimate["resultLabel"] != "Link clicks" {
		t.Fatalf("unexpected estimate %v", estimate)
	}
	request["audience"].(map[string]any)["locations"] = []any{}
	h.expect("POST", base+"/estimates/audience", &owner, "", request, http.StatusBadRequest)
}
