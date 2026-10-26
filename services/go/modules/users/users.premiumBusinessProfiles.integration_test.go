package users

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent/profilesignal"
)

func (harness *usersTestHarness) setPremium(accountId string, until time.Time) {
	harness.t.Helper()
	client := harness.module.Container().Client
	account := uuid.MustParse(accountId)
	ctx := context.Background()
	if updated, _ := client.ProfileSignal.Update().Where(profilesignal.AccountID(account)).SetPremiumUntil(until).Save(ctx); updated > 0 {
		return
	}
	client.ProfileSignal.Create().SetProfileID(uuid.New()).SetAccountID(account).SetSource("entitlements").SetPremiumUntil(until).ExecX(ctx)
}

func allowanceOf(summary map[string]any) map[string]any {
	return summary["businessProfiles"].(map[string]any)
}

func TestPremiumOwnsUpToFiveBusinessProfilesWithOnlyOneStore(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("premium.owner", "Premium")
	if summary := harness.linked(token); allowanceOf(summary)["limit"] != float64(2) || allowanceOf(summary)["premium"] != false {
		t.Fatalf("without Premium the standard limit applies: %v", summary)
	}
	harness.setPremium(accountId, time.Now().Add(30*24*time.Hour))
	store := harness.expect("POST", "/api/v1/users/me/business-profiles", token, businessBody("premium.store", "store"), http.StatusCreated)
	status, body := harness.call("POST", "/api/v1/users/me/business-profiles", token, businessBody("premium.store.two", "store"))
	expectCode(t, status, body, http.StatusConflict, "STORE_LIMIT_ONE")
	if code, _ := harness.claim(accountId, "store", uuid.NewString()); code != http.StatusConflict {
		t.Fatalf("a second store is refused even with Premium: %d", code)
	}
	for index := 0; index < 3; index++ {
		harness.expect("POST", "/api/v1/users/me/business-profiles", token, businessBody(fmt.Sprintf("premium.brand%d", index), "business"), http.StatusCreated)
	}
	harness.expect("POST", "/api/v1/users/me/business-profiles", token, map[string]any{"displayName": "Brand page", "handle": "premium.label", "businessType": "brand", "categories": []map[string]any{{"customName": "Fashion"}}}, http.StatusCreated)
	summary := harness.linked(token)
	if allowanceOf(summary)["count"] != float64(5) || allowanceOf(summary)["limit"] != float64(5) || summary["canCreate"].(map[string]any)["business"] != false {
		t.Fatalf("five of five: %v", summary)
	}
	status, body = harness.call("POST", "/api/v1/users/me/business-profiles", token, businessBody("premium.sixth", "business"))
	expectCode(t, status, body, http.StatusConflict, "BUSINESS_PROFILE_LIMIT")
	status, body = harness.claim(accountId, "brand", uuid.NewString())
	expectCode(t, status, body, http.StatusConflict, "BUSINESS_PROFILE_LIMIT")
	stores := 0
	for _, raw := range summary["items"].([]any) {
		if item := raw.(map[string]any); item["ownsStore"] == true {
			stores++
			if item["profileId"] != store["id"] {
				t.Fatalf("the store badge sits on the store profile: %v", item)
			}
		}
	}
	if stores != 1 {
		t.Fatalf("exactly one store badge: %v", summary["items"])
	}

	harness.setPremium(accountId, time.Now().Add(-time.Hour))
	lapsed := harness.linked(token)
	needed := 0
	for _, raw := range lapsed["items"].([]any) {
		item := raw.(map[string]any)
		if item["status"] != "active" {
			t.Fatalf("a lapse never holds or deletes a profile: %v", item)
		}
		if item["premiumNeeded"] == true {
			needed++
		}
	}
	if needed != 3 || allowanceOf(lapsed)["premiumNeeded"] != true || lapsed["choiceRequired"] != false || lapsed["canCreate"].(map[string]any)["brand"] != false {
		t.Fatalf("after a lapse the extra profiles keep working, marked Premium needed: %v", lapsed)
	}
	status, body = harness.call("POST", "/api/v1/users/me/business-profiles", token, businessBody("lapsed.extra", "business"))
	expectCode(t, status, body, http.StatusConflict, "PROFILE_LIMIT_STORE_OR_BUSINESS")
	if profiles := harness.expect("GET", "/api/v1/users/me/profiles", token, nil, http.StatusOK)["data"].([]any); len(profiles) != 6 {
		t.Fatalf("all five business profiles stay in the switcher: %d", len(profiles))
	}
}

func TestParallelPremiumCreatesNeverPassFive(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("premium.racer", "Racer")
	harness.setPremium(accountId, time.Now().Add(30*24*time.Hour))
	results := make([]int, 10)
	var group sync.WaitGroup
	for index := range results {
		group.Add(1)
		go func() {
			defer group.Done()
			results[index], _ = harness.call("POST", "/api/v1/users/me/business-profiles", token, businessBody(fmt.Sprintf("race.premium%d", index), "business"))
		}()
	}
	group.Wait()
	if created := countStatus(results, http.StatusCreated); created != 5 || countStatus(results, http.StatusConflict) != 5 {
		t.Fatalf("ten parallel creates, five win: %v", results)
	}
	if count := allowanceOf(harness.linked(token))["count"]; count != float64(5) {
		t.Fatalf("count: %v", count)
	}
}
