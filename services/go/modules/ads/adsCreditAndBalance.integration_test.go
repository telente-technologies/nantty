package ads

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"testing"
	"time"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcreditlot"
	"nantty/modules/ads/src/generated/ent/adfundstransaction"
	"nantty/modules/ads/src/generated/ent/outboxevent"
	"nantty/modules/ads/src/integrations"
	"nantty/modules/ads/src/jobs"
	"nantty/modules/ads/src/services"
)

func TestAdminCreditNeedsPermissionAndStepUpIsAuditedAndRevokesOnlyTheRemainder(t *testing.T) {
	money, audit := newFakeMoneyAccounts(), &recordingAudit{}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}), withAuditAndWithdrawalFees(audit))
	member := h.newUser("credit-member")
	support, manager := h.newStaff("Sam", "ads:review"), h.newStaff("Ada", "advertisers:manage")
	body := map[string]any{"userId": member.id.String(), "amount": ngn(200_000), "expiresAt": nil, "reason": "Launch promotion credit"}

	if status, _ := h.staffCall("POST", "/api/v1/admin/ads/credits", support, "credit-issue-0001", true, body); status != http.StatusForbidden {
		t.Fatalf("staff without advertisers:manage cannot issue credit: %d", status)
	}
	if status, refused := h.staffCall("POST", "/api/v1/admin/ads/credits", manager, "credit-issue-0001", false, body); status != http.StatusForbidden || refused["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("issuing credit needs a step-up: %d %v", status, refused)
	}
	if status, _ := h.staffCall("POST", "/api/v1/admin/ads/credits", manager, "", true, body); status != http.StatusBadRequest {
		t.Fatalf("issuing credit needs an idempotency key: %d", status)
	}
	if status, _ := h.call("POST", "/api/v1/admin/ads/credits", &member, "credit-issue-0009", body); status != http.StatusForbidden {
		t.Fatalf("a normal user cannot issue credit: %d", status)
	}
	issued := h.issueCredit(manager, "credit-issue-0001", member.id, 200_000, nil)
	replayed := h.issueCredit(manager, "credit-issue-0001", member.id, 200_000, nil)
	if issued["id"] != replayed["id"] || issued["expiresAt"] != nil || issued["source"] != "admin_issued" {
		t.Fatalf("a replay returns the same credit: %v / %v", issued, replayed)
	}
	body["amount"] = ngn(300_000)
	if status, reused := h.staffCall("POST", "/api/v1/admin/ads/credits", manager, "credit-issue-0001", true, body); status != http.StatusConflict || reused["code"] != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("a key reused with a new amount is refused: %d %v", status, reused)
	}
	listed := h.expect("GET", "/api/v1/ads/boosts/balance", &member, "", nil, http.StatusOK)
	if credit := listed["credit"].(map[string]any)["amountMinor"].(float64); credit != 200_000 || listed["balance"].(map[string]any)["amountMinor"].(float64) != 0 {
		t.Fatalf("issued credit shows as ad credit, never as balance: %v", listed)
	}
	if withdrawable := listed["withdrawable"].(map[string]any)["amountMinor"].(float64); withdrawable != 0 || listed["withdrawal"].(map[string]any)["available"] != false {
		t.Fatalf("credit can never be withdrawn: %v", listed)
	}

	lot := h.lotByReference("admin:" + manager.id + ":credit-issue-0001")
	h.module.Container.RunInTransaction(context.Background(), func(tx *ent.Tx) error {
		_, err := services.ConsumeCreditInSpendOrder(context.Background(), tx, lot.AccountID, 75_000, h.clock.Now())
		if err == nil {
			err = tx.AdAccount.UpdateOneID(lot.AccountID).AddCreditMinor(-75_000).Exec(context.Background())
		}
		return err
	})
	if status, refused := h.staffCall("POST", "/api/v1/admin/ads/credits/"+lot.ID.String()+"/revoke", manager, "credit-revoke-001", false, map[string]any{"reason": "Promotion ended early"}); status != http.StatusForbidden || refused["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("revoking needs a step-up: %d %v", status, refused)
	}
	status, revoked := h.staffCall("POST", "/api/v1/admin/ads/credits/"+lot.ID.String()+"/revoke", manager, "credit-revoke-001", true, map[string]any{"reason": "Promotion ended early"})
	if status != http.StatusOK || revoked["revokedAmount"].(map[string]any)["amountMinor"].(float64) != 125_000 || revoked["remaining"].(map[string]any)["amountMinor"].(float64) != 0 {
		t.Fatalf("revoking removes only the unspent remainder: %d %v", status, revoked)
	}
	if status, again := h.staffCall("POST", "/api/v1/admin/ads/credits/"+lot.ID.String()+"/revoke", manager, "credit-revoke-002", true, map[string]any{"reason": "Promotion ended early"}); status != http.StatusConflict || again["code"] != "CREDIT_NOT_REVOCABLE" {
		t.Fatalf("nothing left to revoke: %d %v", status, again)
	}
	if account := h.module.Container.Client.AdAccount.GetX(context.Background(), lot.AccountID); account.CreditMinor != 0 || account.BalanceMinor != 0 {
		t.Fatalf("revoking never touches real balance: %+v", account)
	}
	if status, _ := h.staffCall("PUT", "/api/v1/admin/ads/cashback/"+member.id.String(), support, "cashback-0001", true, map[string]any{"enabled": true, "percent": 10, "reason": "Top advertiser"}); status != http.StatusForbidden {
		t.Fatalf("cashback needs advertisers:manage: %d", status)
	}
	if status, invalid := h.staffCall("PUT", "/api/v1/admin/ads/cashback/"+member.id.String(), manager, "cashback-0001", true, map[string]any{"enabled": true, "percent": 80, "reason": "Top advertiser"}); status != http.StatusBadRequest {
		t.Fatalf("cashback percent is capped: %d %v", status, invalid)
	}
	if status, saved := h.staffCall("PUT", "/api/v1/admin/ads/cashback/"+member.id.String(), manager, "cashback-0002", true, map[string]any{"enabled": true, "percent": 10, "reason": "Top advertiser"}); status != http.StatusOK || saved["percent"].(float64) != 10 {
		t.Fatalf("cashback saved: %d %v", status, saved)
	}
	if status, page := h.staffCall("GET", "/api/v1/admin/ads/credits?userId="+member.id.String(), support, "", false, nil); status != http.StatusForbidden || page == nil {
		t.Fatalf("support without ledger:read or advertisers:manage cannot list credits: %d", status)
	}
	if status, page := h.staffCall("GET", "/api/v1/admin/ads/credits?userId="+member.id.String(), manager, "", false, nil); status != http.StatusOK || len(page["data"].([]any)) != 1 {
		t.Fatalf("issued credit list: %d %v", status, page)
	}
	actions := audit.actions()
	if len(actions) != 3 || actions[0] != "adCredit.issued" || actions[1] != "adCredit.revoked" || actions[2] != "adCashback.updated" {
		t.Fatalf("every admin change is audited once: %v", actions)
	}
}

func TestSpendUsesSoonestExpiringCreditFirstAndCashbackOnlyRewardsRealMoney(t *testing.T) {
	money, audit := newFakeMoneyAccounts(), &recordingAudit{}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}), withAuditAndWithdrawalFees(audit))
	advertiser, reviewer, manager := h.newUser("spend-order"), h.newUser("spend-reviewer", "name:Rita", "perm:ads:review"), h.newStaff("Ada", "advertisers:manage")
	soon, later := h.clock.Now().Add(48*time.Hour), h.clock.Now().Add(30*24*time.Hour)
	h.issueCredit(manager, "spend-credit-later", advertiser.id, 100_000, &later)
	h.issueCredit(manager, "spend-credit-never", advertiser.id, 100_000, nil)
	h.issueCredit(manager, "spend-credit-soon1", advertiser.id, 100_000, &soon)
	account := h.lotByReference("admin:" + manager.id + ":spend-credit-soon1").AccountID
	h.callInternal(t, "/internal/v1/ads/accounts/"+account.String()+"/funds", map[string]any{"reference": "seed-top-up-1", "type": "top_up", "amountMinor": 500_000, "currency": "NGN", "description": "Balance top-up"}, http.StatusNoContent)
	if status, _ := h.staffCall("PUT", "/api/v1/admin/ads/cashback/"+advertiser.id.String(), manager, "spend-cashback-01", true, map[string]any{"enabled": true, "percent": 10, "reason": "Top advertiser"}); status != http.StatusOK {
		t.Fatalf("cashback setup: %d", status)
	}
	created := h.expect("POST", "/api/v1/ads/boosts", &advertiser, "spend-order-boost1", boostBody("ad_balance", 100_000, 7), http.StatusCreated)
	boostId := created["boost"].(map[string]any)["id"].(string)
	if poor := h.expect("POST", "/api/v1/ads/boosts", &advertiser, "spend-order-boost2", boostBody("ad_balance", 100_000, 2), http.StatusPaymentRequired); poor["code"] != "INSUFFICIENT_AD_BALANCE" {
		t.Fatalf("committed funds cannot pay for a second ad: %v", poor)
	}
	h.approveBoost(&reviewer, boostId)
	h.serveBoostImpressions(h.boostRow(boostId), 25, 10_000*1_000_000)
	h.settleSpend()

	soonLot, laterLot := h.lotByReference("admin:"+manager.id+":spend-credit-soon1"), h.lotByReference("admin:"+manager.id+":spend-credit-later")
	neverLot := h.lotByReference("admin:" + manager.id + ":spend-credit-never")
	if soonLot.RemainingMinor != 0 || laterLot.RemainingMinor != 0 || neverLot.RemainingMinor != 50_000 {
		t.Fatalf("credit expiring soonest is spent first, then later expiry, then non-expiring: %d %d %d", soonLot.RemainingMinor, laterLot.RemainingMinor, neverLot.RemainingMinor)
	}
	accountRow := h.module.Container.Client.AdAccount.GetX(context.Background(), account)
	if accountRow.BalanceMinor != 500_000 {
		t.Fatalf("real balance is untouched while credit covers spend: %d", accountRow.BalanceMinor)
	}
	if cashback := h.module.Container.Client.AdCreditLot.Query().Where(adcreditlot.SourceEQ(adcreditlot.SourceCashback)).CountX(context.Background()); cashback != 0 {
		t.Fatalf("spend paid with credit earns no cashback: %d", cashback)
	}
	h.serveBoostImpressions(h.boostRow(boostId), 20, 10_000*1_000_000)
	h.settleSpend()
	accountRow = h.module.Container.Client.AdAccount.GetX(context.Background(), account)
	cashbackLots := h.module.Container.Client.AdCreditLot.Query().Where(adcreditlot.SourceEQ(adcreditlot.SourceCashback)).AllX(context.Background())
	if accountRow.BalanceMinor != 350_000 || len(cashbackLots) != 1 || cashbackLots[0].OriginalMinor != 15_000 || cashbackLots[0].ExpiresAt != nil {
		t.Fatalf("10%% cashback on the 150,000 of real spend, never expiring: balance %d lots %+v", accountRow.BalanceMinor, cashbackLots)
	}
	batches := h.module.Container.Client.AdSpendBatch.Query().AllX(context.Background())
	var mixed *ent.AdSpendBatch
	for _, batch := range batches {
		if batch.CashbackMinor > 0 {
			mixed = batch
		}
	}
	if mixed == nil || mixed.CreditUsedMinor != 50_000 || mixed.DebitedMinor != 200_000 {
		t.Fatalf("the second batch used the last credit then real balance: %+v", batches)
	}
	event := h.module.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType("adSpend.batched"), outboxevent.Subject(mixed.ID.String())).OnlyX(context.Background())
	var envelope struct {
		Data map[string]any `json:"data"`
	}
	_ = json.Unmarshal(event.Payload, &envelope)
	if envelope.Data["debitMinor"].(float64) != 150_000 || envelope.Data["creditDebitMinor"].(float64) != 50_000 {
		t.Fatalf("the ledger event splits real money from credit: %v", envelope.Data)
	}
	refund := map[string]any{"amountMinor": 100_000, "reason": "Invalid traffic", "reference": "ivt-0001"}
	h.callInternal(t, "/internal/v1/ads/spend-batches/"+mixed.ID.String()+"/refunds", refund, http.StatusOK)
	h.callInternal(t, "/internal/v1/ads/spend-batches/"+mixed.ID.String()+"/refunds", refund, http.StatusOK)
	accountRow = h.module.Container.Client.AdAccount.GetX(context.Background(), account)
	cashbackLot := h.module.Container.Client.AdCreditLot.GetX(context.Background(), cashbackLots[0].ID)
	if accountRow.BalanceMinor != 425_000 || cashbackLot.RemainingMinor != 7_500 {
		t.Fatalf("a refund returns 75,000 real money and 25,000 credit once, and reverses half the cashback: balance %d cashback left %d", accountRow.BalanceMinor, cashbackLot.RemainingMinor)
	}
	if refundedCredit := h.lotByReference("spendRefund:" + mixed.ID.String() + ":ivt-0001:credit"); refundedCredit.OriginalMinor != 25_000 || refundedCredit.ExpiresAt != nil {
		t.Fatalf("credit refunds come back as never-expiring credit: %+v", refundedCredit)
	}
	h.callInternal(t, "/internal/v1/ads/spend-batches/"+mixed.ID.String()+"/refunds", map[string]any{"amountMinor": 150_000, "reason": "Too much", "reference": "ivt-0002"}, http.StatusUnprocessableEntity)
	history := h.expect("GET", "/api/v1/ads/boosts/balance/transactions", &advertiser, "", nil, http.StatusOK)["data"].([]any)
	kinds := map[string]bool{}
	for _, item := range history {
		entry := item.(map[string]any)
		kinds[entry["pot"].(string)+":"+entry["kind"].(string)] = true
	}
	for _, wanted := range []string{"credit:credit_issued", "credit:credit_spent", "credit:cashback", "credit:cashback_reversed", "credit:refund", "balance:top_up", "balance:spent", "balance:refund"} {
		if !kinds[wanted] {
			t.Fatalf("history is missing %s: %v", wanted, kinds)
		}
	}
}

func TestExpiryJobRemovesCreditExactlyAtTheBoundaryOnce(t *testing.T) {
	money, audit := newFakeMoneyAccounts(), &recordingAudit{}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}), withAuditAndWithdrawalFees(audit))
	member, manager := h.newUser("expiry-member"), h.newStaff("Ada", "advertisers:manage")
	boundary := h.clock.Now().Add(time.Hour).Truncate(time.Second)
	h.issueCredit(manager, "expiry-credit-0001", member.id, 80_000, &boundary)
	lot := h.lotByReference("admin:" + manager.id + ":expiry-credit-0001")
	h.clock.Advance(boundary.Sub(h.clock.Now()) - time.Second)
	if expired, err := jobs.ExpireDueAdCredit(context.Background(), h.module.Container); err != nil || expired != 0 {
		t.Fatalf("one second before the boundary nothing expires: %d %v", expired, err)
	}
	if spendable, _ := services.SpendableCreditMinor(context.Background(), h.module.Container.Client, lot.AccountID, h.clock.Now()); spendable != 80_000 {
		t.Fatalf("still spendable before the boundary: %d", spendable)
	}
	h.clock.Advance(time.Second)
	if spendable, _ := services.SpendableCreditMinor(context.Background(), h.module.Container.Client, lot.AccountID, h.clock.Now()); spendable != 0 {
		t.Fatalf("not spendable at the boundary even before the job runs: %d", spendable)
	}
	for run := 0; run < 2; run++ {
		expired, err := jobs.ExpireDueAdCredit(context.Background(), h.module.Container)
		if err != nil || (run == 0 && expired != 1) || (run == 1 && expired != 0) {
			t.Fatalf("run %d expired %d: %v", run, expired, err)
		}
	}
	entries := h.module.Container.Client.AdFundsTransaction.Query().Where(adfundstransaction.TypeEQ(adfundstransaction.TypeCreditExpired)).AllX(context.Background())
	account := h.module.Container.Client.AdAccount.GetX(context.Background(), lot.AccountID)
	if len(entries) != 1 || entries[0].AmountMinor != -80_000 || account.CreditMinor != 0 {
		t.Fatalf("expiry writes one audited entry: %+v credit %d", entries, account.CreditMinor)
	}
	if events := h.module.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType("adCredit.changed")).CountX(context.Background()); events != 2 {
		t.Fatalf("issue and expiry each tell the ledger once: %d", events)
	}
}

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
