package users

import (
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"
)

var internalHeaders = []string{"X-Internal-Token", strings.Repeat("u", 32)}

func businessBody(handle, purpose string) map[string]any {
	return map[string]any{"displayName": "Page " + handle, "handle": handle, "description": "", "purpose": purpose, "categories": []map[string]any{{"customName": "Community work"}}}
}

func (harness *usersTestHarness) claim(accountId, kind, profileId string) (int, map[string]any) {
	return harness.call("POST", "/api/v1/internal/accounts/"+accountId+"/linked-profiles/claim", "", map[string]any{"kind": kind, "profileId": profileId}, internalHeaders...)
}

func (harness *usersTestHarness) linked(token string) map[string]any {
	return harness.expect("GET", "/api/v1/users/me/linked-profiles", token, nil, http.StatusOK)
}

func expectCode(t *testing.T, status int, body map[string]any, wantStatus int, wantCode string) {
	t.Helper()
	if status != wantStatus || body["code"] != wantCode {
		t.Fatalf("got %d %v, want %d %s", status, body, wantStatus, wantCode)
	}
}

func TestEveryRowOfTheProfileCombinationTable(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)

	_, nobody := harness.newAccount("nobody.here", "Nobody")
	if summary := harness.linked(nobody); summary["choiceRequired"] != false || summary["canCreate"].(map[string]any)["store"] != true || len(summary["items"].([]any)) != 0 {
		t.Fatalf("an account with nothing may create anything: %v", summary)
	}

	storeId, storeToken := harness.newAccount("store.only", "Store")
	store := harness.expect("POST", "/api/v1/users/me/business-profiles", storeToken, businessBody("store.only.page", "store"), http.StatusCreated)
	if store["kind"] != "store" || store["showsMart"] != true {
		t.Fatalf("a store-purpose page is labelled Store and shows the Mart icon: %v", store)
	}
	status, body := harness.call("POST", "/api/v1/users/me/business-profiles", storeToken, businessBody("store.extra.page", "business"))
	expectCode(t, status, body, http.StatusConflict, "PROFILE_LIMIT_STORE_OR_BUSINESS")
	status, body = harness.call("POST", "/api/v1/users/me/business-profiles", storeToken, businessBody("store.second", "store"))
	expectCode(t, status, body, http.StatusConflict, "PROFILE_LIMIT_STORE_OR_BUSINESS")
	if code, _ := harness.claim(storeId, "brand", uuid.NewString()); code != http.StatusOK {
		t.Fatalf("store + brand is allowed, got %d", code)
	}
	status, body = harness.claim(storeId, "brand", uuid.NewString())
	expectCode(t, status, body, http.StatusConflict, "PROFILE_LIMIT_ONE_BRAND")

	businessId, businessToken := harness.newAccount("business.only", "Business")
	page := harness.expect("POST", "/api/v1/users/me/business-profiles", businessToken, businessBody("business.only.page", ""), http.StatusCreated)
	if page["kind"] != "business" || page["showsMart"] != false {
		t.Fatalf("a business page never shows the Mart icon: %v", page)
	}
	status, body = harness.claim(businessId, "store", page["id"].(string))
	expectCode(t, status, body, http.StatusConflict, "PROFILE_LIMIT_STORE_OR_BUSINESS")
	status, body = harness.claim(businessId, "store", uuid.NewString())
	expectCode(t, status, body, http.StatusConflict, "PROFILE_LIMIT_STORE_OR_BUSINESS")
	brandProfile := harness.expect("POST", "/api/v1/users/me/business-profiles", businessToken, map[string]any{"displayName": "Brand page", "handle": "business.brand", "businessType": "brand", "categories": []map[string]any{{"customName": "Fashion"}}}, http.StatusCreated)
	if brandProfile["kind"] != "brand" {
		t.Fatalf("business + brand is allowed and labelled Brand: %v", brandProfile)
	}
	if summary := harness.linked(businessToken); summary["canCreate"].(map[string]any)["brand"] != false || summary["canCreate"].(map[string]any)["store"] != false {
		t.Fatalf("business + brand is the two-in-one maximum: %v", summary)
	}
	if profiles := harness.expect("GET", "/api/v1/users/me/profiles", businessToken, nil, http.StatusOK)["data"].([]any); len(profiles) != 3 {
		t.Fatalf("the switcher shows Personal plus two linked profiles: %v", profiles)
	}

	brandId, brandToken := harness.newAccount("brand.only", "Brand")
	if code, _ := harness.claim(brandId, "brand", uuid.NewString()); code != http.StatusOK {
		t.Fatalf("a brand alone is allowed, got %d", code)
	}
	if summary := harness.linked(brandToken); summary["canCreate"].(map[string]any)["store"] != true || summary["canCreate"].(map[string]any)["brand"] != false {
		t.Fatalf("brand only may still add a store or business: %v", summary)
	}
	status, body = harness.claim(brandId, "brand", uuid.NewString())
	expectCode(t, status, body, http.StatusConflict, "PROFILE_LIMIT_ONE_BRAND")
}

func TestStoreReservationsAttachTheStoreAndReleaseOnFailure(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("seller.flow", "Seller")
	application := uuid.NewString()
	if code, _ := harness.claim(accountId, "store", application); code != http.StatusOK {
		t.Fatalf("a seller application reserves the store slot, got %d", code)
	}
	status, body := harness.call("POST", "/api/v1/users/me/business-profiles", token, businessBody("seller.flow.page", "business"))
	expectCode(t, status, body, http.StatusConflict, "PROFILE_LIMIT_STORE_OR_BUSINESS")
	page := harness.expect("POST", "/api/v1/users/me/business-profiles", token, businessBody("seller.flow.store", "store"), http.StatusCreated)
	storeId := uuid.NewString()
	claimed := harness.expect("POST", "/api/v1/internal/accounts/"+accountId+"/linked-profiles/claim", "", map[string]any{"kind": "store", "profileId": page["id"], "storeId": storeId}, http.StatusOK, internalHeaders...)
	if claimed["storeId"] != storeId || claimed["profileId"] != page["id"] {
		t.Fatalf("store creation attaches to the reserved slot: %v", claimed)
	}
	status, body = harness.call("POST", "/api/v1/internal/accounts/"+accountId+"/linked-profiles/claim", "", map[string]any{"kind": "store", "profileId": page["id"], "storeId": uuid.NewString()}, internalHeaders...)
	expectCode(t, status, body, http.StatusConflict, "PROFILE_LIMIT_STORE_OR_BUSINESS")
	harness.expect("POST", "/api/v1/internal/accounts/"+accountId+"/linked-profiles/release", "", map[string]any{"kind": "store", "profileId": page["id"], "storeId": storeId}, http.StatusNoContent, internalHeaders...)
	items := harness.linked(token)["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["storeId"] != nil {
		t.Fatalf("a failed store creation releases only the store id: %v", items)
	}
	harness.expect("POST", "/api/v1/internal/accounts/"+accountId+"/linked-profiles/claim", "", map[string]any{"kind": "store", "profileId": page["id"]}, http.StatusUnauthorized, "X-Internal-Token", "wrong")
	harness.expect("POST", "/api/v1/internal/accounts/"+accountId+"/linked-profiles/claim", token, map[string]any{"kind": "brand", "profileId": uuid.NewString()}, http.StatusUnauthorized)
}

func TestParallelCreatesLetExactlyOneWin(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("race.owner", "Racer")
	results := make([]int, 8)
	var group sync.WaitGroup
	for index := range results {
		group.Add(1)
		go func() {
			defer group.Done()
			purpose := map[bool]string{true: "store", false: "business"}[index%2 == 0]
			results[index], _ = harness.call("POST", "/api/v1/users/me/business-profiles", token, businessBody("race.page"+string(rune('a'+index)), purpose))
		}()
	}
	group.Wait()
	if created := countStatus(results, http.StatusCreated); created != 1 || countStatus(results, http.StatusConflict) != len(results)-1 {
		t.Fatalf("store and business creates raced, want one winner: %v", results)
	}
	brandResults := make([]int, 8)
	for index := range brandResults {
		group.Add(1)
		go func() {
			defer group.Done()
			brandResults[index], _ = harness.claim(accountId, "brand", uuid.NewString())
		}()
	}
	group.Wait()
	if countStatus(brandResults, http.StatusOK) != 1 {
		t.Fatalf("parallel brand claims, want one winner: %v", brandResults)
	}
}

func countStatus(results []int, wanted int) int {
	count := 0
	for _, status := range results {
		if status == wanted {
			count++
		}
	}
	return count
}
