package ads

import (
	"context"
	"net/http"
	"testing"
	"time"

	"nantty/modules/ads/src/generated/ent/adcustomaudience"
	"nantty/modules/ads/src/generated/ent/outboxevent"
)

func createBundle(h *harness, owner *testUser, accountId, key string, mutate func(map[string]any)) map[string]any {
	h.t.Helper()
	body := bundleFor(h.clock.Now().Add(time.Hour).Format(time.RFC3339))
	body["submitForReview"] = false
	if mutate != nil {
		mutate(body)
	}
	return h.expect("POST", "/api/v1/ads/accounts/"+accountId+"/campaigns", owner, key, body, http.StatusCreated)
}

func TestPatchClearsSpendCapEndDateAndFrequencyCapOnExplicitNull(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	owner := h.newUser("patch-owner")
	accountId := createAccount(h, &owner, "patch-account")
	bundle := createBundle(h, &owner, accountId, "patch-bundle", nil)
	campaignId := bundle["campaign"].(map[string]any)["id"].(string)
	adSetId := bundle["adSet"].(map[string]any)["id"].(string)
	base := "/api/v1/ads/accounts/" + accountId
	start := h.clock.Now().Add(time.Hour).Format(time.RFC3339)
	end := h.clock.Now().Add(72 * time.Hour).Format(time.RFC3339)

	set := h.expect("PATCH", base+"/campaigns/"+campaignId, &owner, "", map[string]any{"spendCap": map[string]any{"amountMinor": 5_000_000, "currency": "NGN"}, "schedule": map[string]any{"startAt": start, "endAt": end}}, http.StatusOK)
	if set["spendCap"] == nil || set["schedule"].(map[string]any)["endAt"] == nil {
		t.Fatalf("spend cap and end date were not saved: %v", set)
	}
	untouched := h.expect("PATCH", base+"/campaigns/"+campaignId, &owner, "", map[string]any{"name": "Renamed"}, http.StatusOK)
	if untouched["spendCap"] == nil {
		t.Fatalf("an absent spendCap must leave it unchanged: %v", untouched)
	}
	cleared := h.expect("PATCH", base+"/campaigns/"+campaignId, &owner, "", map[string]any{"spendCap": nil, "schedule": map[string]any{"startAt": start, "endAt": nil}}, http.StatusOK)
	if cleared["spendCap"] != nil || cleared["schedule"].(map[string]any)["endAt"] != nil {
		t.Fatalf("explicit null must clear spend cap and end date: %v", cleared)
	}
	lifetime := map[string]any{"type": "lifetime", "amount": map[string]any{"amountMinor": 5_000_000, "currency": "NGN"}}
	h.expect("PATCH", base+"/campaigns/"+campaignId, &owner, "", map[string]any{"budget": lifetime}, http.StatusBadRequest)

	capped := h.expect("PATCH", base+"/ad-sets/"+adSetId, &owner, "", map[string]any{"frequencyCap": map[string]any{"impressions": 3, "perDays": 7}, "schedule": map[string]any{"startAt": start, "endAt": end}}, http.StatusOK)
	if capped["frequencyCap"] == nil {
		t.Fatalf("frequency cap was not saved: %v", capped)
	}
	h.expect("PATCH", base+"/ad-sets/"+adSetId, &owner, "", map[string]any{"frequencyCap": map[string]any{"impressions": 3, "perDays": 7, "extra": 1}}, http.StatusBadRequest)
	uncapped := h.expect("PATCH", base+"/ad-sets/"+adSetId, &owner, "", map[string]any{"frequencyCap": nil, "schedule": map[string]any{"startAt": start, "endAt": nil}}, http.StatusOK)
	if uncapped["frequencyCap"] != nil || uncapped["schedule"].(map[string]any)["endAt"] != nil {
		t.Fatalf("explicit null must clear the frequency cap and end date: %v", uncapped)
	}
}

func TestCustomAudiencesMustBelongToTheAccountAndBeReady(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	owner := h.newUser("audience-owner")
	accountId := createAccount(h, &owner, "audience-account")
	ctx := context.Background()
	client := h.module.Container.Client
	audience, err := client.AdCustomAudience.Create().SetAccountID(mustParseUuid(t, accountId)).SetName("Buyers").SetType(adcustomaudience.TypeCustomerList).SetParams([]byte("{}")).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	withAudience := func(body map[string]any) {
		body["adSet"].(map[string]any)["audience"].(map[string]any)["customAudienceIds"] = []any{audience.ID.String()}
	}
	status, decoded := h.call("POST", "/api/v1/ads/accounts/"+accountId+"/campaigns", &owner, "audience-building", func() map[string]any {
		body := bundleFor(h.clock.Now().Add(time.Hour).Format(time.RFC3339))
		withAudience(body)
		return body
	}())
	if status != http.StatusBadRequest || decoded["issues"].([]any)[0].(map[string]any)["path"] != "adSet.audience.customAudienceIds" {
		t.Fatalf("a building audience must be refused: %d %v", status, decoded)
	}
	if err := client.AdCustomAudience.UpdateOneID(audience.ID).SetStatus(adcustomaudience.StatusReady).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	created := createBundle(h, &owner, accountId, "audience-ready", withAudience)
	if ids := created["adSet"].(map[string]any)["audience"].(map[string]any)["customAudienceIds"].([]any); len(ids) != 1 {
		t.Fatalf("custom audience was not stored: %v", created["adSet"])
	}
	other := h.newUser("audience-other")
	otherAccount := createAccount(h, &other, "audience-other-account")
	h.expect("POST", "/api/v1/ads/accounts/"+otherAccount+"/campaigns", &other, "audience-foreign", func() map[string]any {
		body := bundleFor(h.clock.Now().Add(time.Hour).Format(time.RFC3339))
		withAudience(body)
		return body
	}(), http.StatusBadRequest)
}

func TestTargetingCataloguesKeepTheEchoedLocationShape(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	user := h.newUser("catalogue-user")
	page := h.expect("GET", "/api/v1/ads/locations?search=lag&countryCode=NG", &user, "", nil, http.StatusOK)
	items := page["data"].([]any)
	if len(items) == 0 || len(items) > 25 {
		t.Fatalf("unexpected locations %v", page)
	}
	first := items[0].(map[string]any)
	if len(first) != 5 || first["code"] != "NG-LA" || first["parentName"] != "Nigeria" {
		t.Fatalf("location items must carry exactly type, code, name, countryCode, parentName: %v", first)
	}
	all := h.expect("GET", "/api/v1/ads/locations", &user, "", nil, http.StatusOK)["data"].([]any)
	if all[0].(map[string]any)["code"] != "NG" || len(all) != 25 {
		t.Fatalf("Nigeria must come first and results are capped at 25: %v", all[0])
	}
	behaviours := h.expect("GET", "/api/v1/ads/behaviours", &user, "", nil, http.StatusOK)["data"].([]any)
	if len(behaviours) == 0 {
		t.Fatal("no behaviours")
	}
	accountId := createAccount(h, &user, "catalogue-account")
	createBundle(h, &user, accountId, "catalogue-behaviour", func(body map[string]any) {
		body["adSet"].(map[string]any)["audience"].(map[string]any)["behaviourIds"] = []any{"beh_recent_buyers"}
	})
	status, _ := h.call("POST", "/api/v1/ads/accounts/"+accountId+"/campaigns", &user, "catalogue-unknown", func() map[string]any {
		body := bundleFor(h.clock.Now().Add(time.Hour).Format(time.RFC3339))
		body["adSet"].(map[string]any)["audience"].(map[string]any)["behaviourIds"] = []any{"beh_unknown"}
		return body
	}())
	if status != http.StatusBadRequest {
		t.Fatalf("unknown behaviours must be refused, got %d", status)
	}
}

func TestInvitesNotifyTheInviteeAndReportTheRightField(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	owner, invitee := h.newUser("notify-owner"), h.newUser("notify-invitee")
	base := "/api/v1/ads/accounts/" + createAccount(h, &owner, "notify-account") + "/invites"
	invite := h.expect("POST", base, &owner, "", map[string]any{"email": "notify-invitee@example.test", "role": "analyst"}, http.StatusCreated)
	exists, err := h.module.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType("adInvite.created"), outboxevent.Subject(invite["id"].(string))).Exist(context.Background())
	if err != nil || !exists {
		t.Fatalf("no adInvite.created outbox event: %v", err)
	}
	pending := h.expect("GET", "/api/v1/ads/invites", &invitee, "", nil, http.StatusOK)["data"].([]any)
	if len(pending) != 1 || pending[0].(map[string]any)["accountName"] != "Fabric Shop" || pending[0].(map[string]any)["id"] != invite["id"] {
		t.Fatalf("the invitee must see the pending invite: %v", pending)
	}
	if mine := h.expect("GET", "/api/v1/ads/invites", &owner, "", nil, http.StatusOK)["data"].([]any); len(mine) != 0 {
		t.Fatalf("the owner has no invites: %v", mine)
	}
	_, duplicate := h.call("POST", base, &owner, "", map[string]any{"email": "notify-invitee@example.test", "role": "analyst"})
	if duplicate["issues"].([]any)[0].(map[string]any)["path"] != "email" {
		t.Fatalf("an email invite must report the email field: %v", duplicate)
	}
}

func TestCommentThreadSlotSpacesAdsAndAcceptsSlotIndex(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	viewer := h.newUser("thread-viewer")
	decide := func(slot map[string]any) (int, map[string]any) {
		return h.call("POST", "/api/v1/ads/decide", &viewer, "", map[string]any{"slot": slot, "sessionId": "thread-session"})
	}
	if status, decoded := decide(map[string]any{"kind": "feedCommentThread", "contentId": "post-9"}); status != http.StatusBadRequest {
		t.Fatalf("slotIndex is required for threads: %d %v", status, decoded)
	}
	if _, decoded := decide(map[string]any{"kind": "feedCommentThread", "contentId": "post-9", "slotIndex": 1}); decoded["declinedReason"] != "frequencyCap" {
		t.Fatalf("no ad before the third reply: %v", decoded)
	}
	if _, decoded := decide(map[string]any{"kind": "feedCommentThread", "contentId": "post-9", "slotIndex": 12, "slotsSinceLastAd": 4}); decoded["declinedReason"] != "frequencyCap" {
		t.Fatalf("at most one ad per 8 replies: %v", decoded)
	}
	first, decoded := decide(map[string]any{"kind": "feedCommentThread", "contentId": "post-9", "slotIndex": 4})
	if first != http.StatusOK || decoded["declinedReason"] == "frequencyCap" {
		t.Fatalf("a valid thread slot must be decided: %d %v", first, decoded)
	}
	if _, again := decide(map[string]any{"kind": "feedCommentThread", "contentId": "post-9", "slotIndex": 4}); again["declinedReason"] != "frequencyCap" {
		t.Fatalf("one decision per slotIndex per session: %v", again)
	}
}
