package ads

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent/adboost"
	"zudomart/modules/ads/src/generated/ent/adboostchange"
	"zudomart/modules/ads/src/jobs"
)

func (h *harness) approveBoost(staff *testUser, boostId string) {
	h.t.Helper()
	h.expect("POST", "/api/v1/admin/ads/"+h.boostRow(boostId).AdID.String()+"/approve", staff, "", map[string]any{}, http.StatusOK)
}

func (h *harness) startEarningsBoost(owner *testUser, key string, dailyMinor int64, days int) string {
	h.t.Helper()
	created := h.expect("POST", "/api/v1/ads/boosts", owner, key, boostBody("balance", dailyMinor, days), http.StatusCreated)
	return created["boost"].(map[string]any)["id"].(string)
}

func TestOnlyTheOwnerCanPauseResumeStopAndInvalidTransitionsAreRefused(t *testing.T) {
	money := newFakeMoneyAccounts()
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}))
	owner, stranger, staff := h.newUser("hub-owner"), h.newUser("hub-stranger"), h.newUser("hub-reviewer", "name:Rita", "perm:ads:review")
	money.levels[owner.id.String()] = 1
	boostId := h.startEarningsBoost(&owner, "hub-boost-000001", 100_000, 3)
	base := "/api/v1/ads/boosts/" + boostId

	if refused := h.expect("POST", base+"/pause", &owner, "", map[string]any{}, http.StatusConflict); refused["code"] != "BOOST_STATUS_CHANGE_NOT_ALLOWED" {
		t.Fatalf("an ad in review cannot be paused: %v", refused)
	}
	h.approveBoost(&staff, boostId)
	for _, action := range []string{"pause", "resume", "budget/quote"} {
		if status, refused := h.call("POST", base+"/"+action, &stranger, "", map[string]any{"extraDays": 1}); status != http.StatusForbidden {
			t.Fatalf("a stranger must get 403 on %s: %d %v", action, status, refused)
		}
	}
	if status, _ := h.call("POST", base+"/budget", &stranger, "hub-stranger-budget", map[string]any{"extraDays": 1, "paymentMethod": "card"}); status != http.StatusForbidden {
		t.Fatalf("a stranger cannot add budget: %d", status)
	}
	if status, _ := h.call("POST", base+"/cancel", &stranger, "hub-stranger-cancel", map[string]any{}); status != http.StatusForbidden {
		t.Fatalf("a stranger cannot stop the ad: %d", status)
	}
	if status, _ := h.call("GET", base, &stranger, "", nil); status != http.StatusNotFound {
		t.Fatalf("a stranger cannot read the ad: %d", status)
	}
	if running := h.expect("POST", base+"/resume", &owner, "", map[string]any{}, http.StatusOK); running["status"] != "active" {
		t.Fatalf("resuming a running ad is a no-op: %v", running)
	}
	paused := h.expect("POST", base+"/pause", &owner, "", map[string]any{}, http.StatusOK)
	actions := paused["actions"].(map[string]any)
	if paused["status"] != "paused" || actions["resume"] != true || actions["pause"] != false || actions["changeBudget"] != true {
		t.Fatalf("pause: %v", paused)
	}
	if again := h.expect("POST", base+"/pause", &owner, "", map[string]any{}, http.StatusOK); again["status"] != "paused" {
		t.Fatalf("a second pause is a no-op: %v", again)
	}
	listed := h.expect("GET", "/api/v1/ads/boosts?status=paused", &owner, "", nil, http.StatusOK)
	if items := listed["data"].([]any); len(items) != 1 || items[0].(map[string]any)["id"] != boostId {
		t.Fatalf("status filter: %v", listed)
	}
	if empty := h.expect("GET", "/api/v1/ads/boosts?status=active", &owner, "", nil, http.StatusOK)["data"].([]any); len(empty) != 0 {
		t.Fatalf("a paused ad is not active: %v", empty)
	}
	if bad := h.expect("GET", "/api/v1/ads/boosts?status=bogus", &owner, "", nil, http.StatusBadRequest); bad["code"] != "VALIDATION_FAILED" {
		t.Fatalf("unknown status filter: %v", bad)
	}
	if strangerList := h.expect("GET", "/api/v1/ads/boosts", &stranger, "", nil, http.StatusOK)["data"].([]any); len(strangerList) != 0 {
		t.Fatalf("lists only show your own ads: %v", strangerList)
	}
	if resumed := h.expect("POST", base+"/resume", &owner, "", map[string]any{}, http.StatusOK); resumed["status"] != "active" {
		t.Fatalf("resume: %v", resumed)
	}
	h.expect("POST", base+"/pause", &owner, "", map[string]any{}, http.StatusOK)
	if stopped := h.expect("POST", base+"/cancel", &owner, "hub-stop-paused-01", map[string]any{}, http.StatusOK); stopped["status"] != "cancelled" {
		t.Fatalf("a paused ad can be stopped: %v", stopped)
	}
	if refused := h.expect("POST", base+"/resume", &owner, "", map[string]any{}, http.StatusConflict); refused["code"] != "BOOST_STATUS_CHANGE_NOT_ALLOWED" {
		t.Fatalf("a stopped ad cannot be resumed: %v", refused)
	}
	if refused := h.expect("POST", base+"/budget", &owner, "hub-budget-stopped", map[string]any{"extraDays": 2, "paymentMethod": "card"}, http.StatusConflict); refused["code"] != "BOOST_BUDGET_CHANGE_NOT_ALLOWED" {
		t.Fatalf("a stopped ad cannot get more budget: %v", refused)
	}

	rejectedId := h.startEarningsBoost(&owner, "hub-boost-reject1", 100_000, 1)
	h.rejectBoostAd(&staff, h.boostRow(rejectedId).AdID.String(), http.StatusOK)
	rejected := h.expect("GET", "/api/v1/ads/boosts/"+rejectedId, &owner, "", nil, http.StatusOK)
	if rejected["rejectionReason"] == nil || rejected["actions"].(map[string]any)["resubmit"] != true {
		t.Fatalf("a rejected ad shows its reason and offers resubmission: %v", rejected)
	}
	if refused := h.expect("POST", "/api/v1/ads/boosts/"+rejectedId+"/budget", &owner, "hub-budget-reject1", map[string]any{"extraDays": 1, "paymentMethod": "ad_balance"}, http.StatusConflict); refused["code"] != "BOOST_BUDGET_CHANGE_NOT_ALLOWED" {
		t.Fatalf("a rejected ad cannot get more budget: %v", refused)
	}
	if refused := h.expect("POST", "/api/v1/ads/boosts/"+rejectedId+"/pause", &owner, "", map[string]any{}, http.StatusConflict); refused["code"] != "BOOST_STATUS_CHANGE_NOT_ALLOWED" {
		t.Fatalf("a rejected ad cannot be paused: %v", refused)
	}

	ended := h.startEarningsBoost(&owner, "hub-boost-ended01", 100_000, 1)
	h.approveBoost(&staff, ended)
	h.expect("POST", "/api/v1/ads/boosts/"+ended+"/pause", &owner, "", map[string]any{}, http.StatusOK)
	h.clock.Advance(49 * time.Hour)
	if refused := h.expect("POST", "/api/v1/ads/boosts/"+ended+"/resume", &owner, "", map[string]any{}, http.StatusConflict); refused["code"] != "BOOST_ENDED" {
		t.Fatalf("a paused ad past its end date cannot be resumed: %v", refused)
	}
	if err := jobs.AdvanceFinishedItemsToCompleted(context.Background(), h.module.Container); err != nil {
		t.Fatal(err)
	}
	if status := h.boostRow(ended).Status; status != adboost.StatusCompleted {
		t.Fatalf("a paused ad past its end date completes: %s", status)
	}
}

func TestAddingBudgetChargesTheDifferenceOnceAndAppliesWhenPaid(t *testing.T) {
	money := newFakeMoneyAccounts()
	topUps := &fakeTopUps{status: "pending"}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, topUps))
	owner, staff := h.newUser("budget-owner"), h.newUser("budget-reviewer", "name:Rita", "perm:ads:review")
	money.levels[owner.id.String()] = 1
	boostId := h.startEarningsBoost(&owner, "budget-boost-0001", 100_000, 3)
	h.approveBoost(&staff, boostId)
	base := "/api/v1/ads/boosts/" + boostId
	endsBefore := *h.boostRow(boostId).EndsAt
	change := map[string]any{"extraDays": 2, "dailyBudget": map[string]any{"amountMinor": 150_000, "currency": "NGN"}}

	quote := h.expect("POST", base+"/budget/quote", &owner, "", change, http.StatusOK)
	if cost := quote["additionalCost"].(map[string]any)["amountMinor"].(float64); cost != 50_000*3+150_000*2 {
		t.Fatalf("the quote charges the higher daily budget for the days left plus the new days: %v", quote)
	}
	if lower := h.expect("POST", base+"/budget/quote", &owner, "", map[string]any{"extraDays": 0, "dailyBudget": map[string]any{"amountMinor": 50_000, "currency": "NGN"}}, http.StatusBadRequest); lower["code"] != "VALIDATION_FAILED" {
		t.Fatalf("lowering the daily budget is refused: %v", lower)
	}
	if nothing := h.expect("POST", base+"/budget/quote", &owner, "", map[string]any{"extraDays": 0}, http.StatusBadRequest); nothing["code"] != "VALIDATION_FAILED" {
		t.Fatalf("a change must add something: %v", nothing)
	}
	card := map[string]any{"extraDays": 2, "dailyBudget": map[string]any{"amountMinor": 150_000, "currency": "NGN"}, "paymentMethod": "card"}
	first := h.expect("POST", base+"/budget", &owner, "budget-change-00001", card, http.StatusOK)
	second := h.expect("POST", base+"/budget", &owner, "budget-change-00001", card, http.StatusOK)
	firstChange, secondChange := first["change"].(map[string]any), second["change"].(map[string]any)
	if firstChange["id"] != secondChange["id"] || firstChange["status"] != "pending_payment" || first["checkoutUrl"] == nil {
		t.Fatalf("a double tap returns the same pending change: %v / %v", first, second)
	}
	if count := h.module.Container.Client.AdBoostChange.Query().CountX(context.Background()); count != 1 {
		t.Fatalf("one change row per key: %d", count)
	}
	keys := map[string]bool{}
	for _, started := range topUps.started {
		keys[started.IdempotencyKey] = true
		if started.AmountMinor != 450_000 {
			t.Fatalf("the card is charged exactly the difference: %d", started.AmountMinor)
		}
	}
	if len(keys) != 1 {
		t.Fatalf("replays reuse one payment key so the card is charged once: %v", keys)
	}
	if reused := h.expect("POST", base+"/budget", &owner, "budget-change-00001", map[string]any{"extraDays": 3, "paymentMethod": "card"}, http.StatusConflict); reused["code"] != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("a key reused with another body is refused: %v", reused)
	}
	if total := h.boostRow(boostId).TotalBudgetMinor; total != 300_000 {
		t.Fatalf("nothing changes before the payment lands: %d", total)
	}
	paid := `{"id":"` + uuid.NewString() + `","type":"adBalance.toppedUp","occurredAt":"2026-10-17T10:00:00Z","data":{"adAccountId":"` + h.boostRow(boostId).AccountID.String() + `","topUpId":"money-top-up-1","amount":{"amountMinor":450000,"currency":"NGN"}}}`
	h.deliver([]byte(paid))
	h.deliver([]byte(paid))
	row := h.boostRow(boostId)
	if row.TotalBudgetMinor != 750_000 || row.DailyBudgetMinor != 150_000 || row.DurationDays != 5 || !row.EndsAt.Equal(endsBefore.AddDate(0, 0, 2)) || row.AddedBudgetMinor != 450_000 {
		t.Fatalf("the paid change applies exactly once: %+v", row)
	}
	if status := h.module.Container.Client.AdBoostChange.Query().OnlyX(context.Background()).Status; status != adboostchange.StatusApplied {
		t.Fatalf("change status: %s", status)
	}
	if poor := h.expect("POST", base+"/budget", &owner, "budget-change-00002", map[string]any{"extraDays": 30, "paymentMethod": "ad_balance"}, http.StatusPaymentRequired); poor["code"] != "INSUFFICIENT_AD_BALANCE" {
		t.Fatalf("ad balance must cover the difference: %v", poor)
	}
	if earnings := h.expect("POST", base+"/budget", &owner, "budget-change-00003", map[string]any{"extraDays": 1, "paymentMethod": "balance"}, http.StatusBadRequest); earnings["code"] != "VALIDATION_FAILED" {
		t.Fatalf("budget changes are paid by card or ad funds only: %v", earnings)
	}
	report := h.expect("GET", base+"/report", &owner, "", nil, http.StatusOK)
	if report["resultLabel"] != "People reached" || report["series"] == nil {
		t.Fatalf("report: %v", report)
	}
}
