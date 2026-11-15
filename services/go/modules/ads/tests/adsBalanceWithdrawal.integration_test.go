package ads_test

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	"nantty/modules/ads/src/generated/ent/adfundstransaction"
	"nantty/modules/ads/src/integrations"
)

func TestWithdrawingAdBalanceNeedsStepUpVerificationAndSettledFundsAndPaysOnce(t *testing.T) {
	money, audit := newFakeMoneyAccounts(), &recordingAudit{}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}), withAuditAndWithdrawalFees(audit))
	member, manager := h.newSteppableUser("withdraw-member"), h.newStaff("Ada", "advertisers:manage")
	h.issueCredit(manager, "withdraw-credit-01", member.id, 300_000, nil)
	account := h.lotByReference("admin:" + manager.id + ":withdraw-credit-01").AccountID
	path := "/api/v1/ads/boosts/balance/withdrawals"
	if status, refused := h.callWithStepUp(path, member, "withdraw-key-00001", h.stepUpFor(member), map[string]any{"amount": ngn(50_000)}); status != http.StatusForbidden || refused["code"] != "VERIFICATION_REQUIRED" {
		t.Fatalf("withdrawing needs payout verification: %d %v", status, refused)
	}
	money.levels[member.id.String()] = 1
	if status, refused := h.callWithStepUp(path, member, "withdraw-key-00001", "", map[string]any{"amount": ngn(50_000)}); status != http.StatusForbidden || refused["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("withdrawing always needs a step-up: %d %v", status, refused)
	}
	if status, refused := h.callWithStepUp(path, member, "withdraw-key-00001", h.stepUpFor(member), map[string]any{"amount": ngn(50_000)}); status != http.StatusUnprocessableEntity || refused["code"] != "WITHDRAWAL_ABOVE_AVAILABLE" {
		t.Fatalf("ad credit can never be withdrawn: %d %v", status, refused)
	}
	h.callInternal(t, "/internal/v1/ads/accounts/"+account.String()+"/funds", map[string]any{"reference": "seed-top-up-2", "type": "top_up", "amountMinor": 400_000, "currency": "NGN", "description": "Balance top-up"}, http.StatusNoContent)
	if status, refused := h.callWithStepUp(path, member, "withdraw-key-00002", h.stepUpFor(member), map[string]any{"amount": ngn(50_000)}); status != http.StatusUnprocessableEntity || refused["code"] != "WITHDRAWAL_ABOVE_AVAILABLE" {
		t.Fatalf("a top-up settled less than 24h ago cannot be withdrawn: %d %v", status, refused)
	}
	h.clock.Advance(24*time.Hour + time.Minute)
	quote := h.expect("POST", path+"/quote", &member.testUser, "", map[string]any{"amount": ngn(400_000)}, http.StatusOK)
	if quote["fee"].(map[string]any)["amountMinor"].(float64) != 6_000 || quote["net"].(map[string]any)["amountMinor"].(float64) != 394_000 {
		t.Fatalf("the provider fee is shown before confirming: %v", quote)
	}
	if status, refused := h.callWithStepUp(path, member, "withdraw-key-00003", h.stepUpFor(member), map[string]any{"amount": ngn(400_001)}); status != http.StatusUnprocessableEntity || refused["code"] != "WITHDRAWAL_ABOVE_AVAILABLE" {
		t.Fatalf("never more than the unspent real balance: %d %v", status, refused)
	}
	status, first := h.callWithStepUp(path, member, "withdraw-key-00004", h.stepUpFor(member), map[string]any{"amount": ngn(250_000)})
	_, second := h.callWithStepUp(path, member, "withdraw-key-00004", h.stepUpFor(member), map[string]any{"amount": ngn(250_000)})
	if status != http.StatusCreated || first["status"] != "completed" || first["id"] != second["id"] {
		t.Fatalf("a double submit makes one withdrawal: %d %v / %v", status, first, second)
	}
	reusedStepUp := h.stepUpFor(member)
	h.callWithStepUp(path, member, "withdraw-key-00005", reusedStepUp, map[string]any{"amount": ngn(10_000)})
	if status, refused := h.callWithStepUp(path, member, "withdraw-key-00006", reusedStepUp, map[string]any{"amount": ngn(10_000)}); status == http.StatusCreated {
		t.Fatalf("a step-up token works once: %d %v", status, refused)
	}
	moved := h.module.Container.Withdrawals.(*integrations.InMemoryAdBalanceWithdrawals).Moved
	if len(moved) != 2 {
		t.Fatalf("one payout per withdrawal: %v", moved)
	}
	for _, request := range moved {
		if request.GrossMinor == 250_000 && request.FeeMinor != 3_750 {
			t.Fatalf("fee recorded with the payout: %+v", request)
		}
	}
	view := h.expect("GET", "/api/v1/ads/boosts/balance", &member.testUser, "", nil, http.StatusOK)
	if view["balance"].(map[string]any)["amountMinor"].(float64) != 140_000 || view["credit"].(map[string]any)["amountMinor"].(float64) != 300_000 {
		t.Fatalf("withdrawals only reduce the real balance: %v", view)
	}
}

func TestConcurrentWithdrawalReplayCreatesOnePayoutAndLedgerDebit(t *testing.T) {
	money := newFakeMoneyAccounts()
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}), withAuditAndWithdrawalFees(&recordingAudit{}))
	member, manager := h.newSteppableUser("withdraw-race-member"), h.newStaff("Ada", "advertisers:manage")
	money.levels[member.id.String()] = 1
	h.issueCredit(manager, "withdraw-race-credit", member.id, 300_000, nil)
	accountID := h.lotByReference("admin:" + manager.id + ":withdraw-race-credit").AccountID
	h.callInternal(t, "/internal/v1/ads/accounts/"+accountID.String()+"/funds", map[string]any{"reference": "withdraw-race-top-up", "type": "top_up", "amountMinor": 400_000, "currency": "NGN", "description": "Synthetic settled balance"}, http.StatusNoContent)
	h.clock.Advance(24*time.Hour + time.Minute)

	const attempts = 16
	start := make(chan struct{})
	type result struct {
		status int
		body   map[string]any
	}
	results := make(chan result, attempts)
	var workers sync.WaitGroup
	for range attempts {
		workers.Add(1)
		go func() {
			defer workers.Done()
			<-start
			status, body := h.callWithStepUp("/api/v1/ads/boosts/balance/withdrawals", member, "withdraw-race-key-0001", h.stepUpFor(member), map[string]any{"amount": ngn(250_000)})
			results <- result{status: status, body: body}
		}()
	}
	close(start)
	workers.Wait()
	close(results)

	var withdrawalID string
	for response := range results {
		if response.status != http.StatusCreated {
			t.Fatalf("same-key concurrent withdrawal should resolve successfully: %d %v", response.status, response.body)
		}
		id, _ := response.body["id"].(string)
		if id == "" || withdrawalID != "" && id != withdrawalID {
			t.Fatalf("all retries must resolve to one withdrawal: %q vs %q", id, withdrawalID)
		}
		withdrawalID = id
	}

	client := h.module.Container.Client
	if count := client.AdBalanceWithdrawal.Query().CountX(context.Background()); count != 1 {
		t.Fatalf("one withdrawal row expected, got %d", count)
	}
	if count := client.AdFundsTransaction.Query().Where(adfundstransaction.TypeEQ(adfundstransaction.TypeWithdrawal)).CountX(context.Background()); count != 1 {
		t.Fatalf("one ledger debit expected, got %d", count)
	}
	account := client.AdAccount.GetX(context.Background(), accountID)
	if account.BalanceMinor != 150_000 {
		t.Fatalf("one 250000 withdrawal should leave 150000 real balance, got %d", account.BalanceMinor)
	}
	if moved := h.module.Container.Withdrawals.(*integrations.InMemoryAdBalanceWithdrawals).Moved; len(moved) != 1 {
		t.Fatalf("one downstream payout expected, got %d", len(moved))
	}
}
