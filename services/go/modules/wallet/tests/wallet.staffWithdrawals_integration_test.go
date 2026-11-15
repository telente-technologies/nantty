package wallet_test

import (
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

func (harness *walletHarness) fundWithdrawableBalance(userId string, amountMinor int64) (string, string) {
	harness.T.Helper()
	harness.OnboardConnectedAccount(userId, false)
	harness.SeedWalletAvailable(userId, amountMinor)
	harness.Flutterwave.FundMainBalance("NGN", 100_000_000)
	token := harness.Tokens.UserAccessToken(userId)
	account := harness.Call(http.MethodPost, "/api/v1/wallets/me/payout-accounts", token, "", map[string]any{"bankCode": "058", "accountNumber": "0123454821"}, harness.stepUp(token))
	if account.Status != http.StatusCreated {
		harness.T.Fatalf("payout account: %d %s", account.Status, account.Raw)
	}
	return token, account.Body["id"].(string)
}

func TestConcurrentWithdrawalsNeverOverdrawTheWallet(t *testing.T) {
	harness := startWalletHarness(t, true)
	user := uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(user, 100_000)
	var created, refused atomic.Int64
	var group sync.WaitGroup
	for attempt := range 12 {
		group.Add(1)
		go func() {
			defer group.Done()
			response := harness.withdraw(token, fmt.Sprintf("concurrent-withdraw-%02d", attempt), accountId, 30_000)
			switch response.Status {
			case http.StatusCreated:
				created.Add(1)
			case http.StatusUnprocessableEntity:
				refused.Add(1)
			default:
				t.Errorf("unexpected %d %s", response.Status, response.Raw)
			}
		}()
	}
	group.Wait()
	if created.Load() != 3 || refused.Load() != 9 {
		t.Fatalf("created=%d refused=%d", created.Load(), refused.Load())
	}
	if harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")) != 10_000 || harness.balance(ledgermodels.WalletReservedPayoutAccount(user, "NGN")) != 90_000 {
		t.Fatal("reserved and available do not add up to the funded balance")
	}
	harness.AssertLedgerHealthy()
}

func TestStaffSeeWithdrawalDetailsAndCanHoldThenApproveOrRejectWithFundsReturned(t *testing.T) {
	harness := startWalletHarness(t, true)
	user := uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(user, 200_000)
	first := harness.withdraw(token, "staff-view-key-1", accountId, 50_000)
	second := harness.withdraw(token, "staff-view-key-2", accountId, 40_000)
	if first.Status != http.StatusCreated || second.Status != http.StatusCreated {
		t.Fatalf("withdrawals: %s / %s", first.Raw, second.Raw)
	}
	reader := harness.Tokens.StaffTokens(uuid.NewString(), "money.withdrawals.read")
	if forbidden := harness.Call(http.MethodGet, "/api/v1/admin/withdrawals", harness.Tokens.UserAccessToken(user), "", nil); forbidden.Status != http.StatusUnauthorized && forbidden.Status != http.StatusForbidden {
		t.Fatalf("a user read the staff queue: %d", forbidden.Status)
	}
	list := harness.Call(http.MethodGet, "/api/v1/admin/withdrawals?search="+user, reader.AccessToken, "", nil)
	rows := list.Body["data"].([]any)
	if list.Status != http.StatusOK || len(rows) != 2 || list.Body["counts"].(map[string]any)["pending_review"].(float64) < 2 {
		t.Fatalf("staff list: %d %s", list.Status, list.Raw)
	}
	queue := harness.Call(http.MethodGet, "/api/v1/admin/withdrawals?status=pending_review&search="+user, reader.AccessToken, "", nil)
	queued := queue.Body["data"].([]any)
	if len(queued) != 2 || queued[0].(map[string]any)["id"] != first.Body["id"] || queued[1].(map[string]any)["id"] != second.Body["id"] {
		t.Fatalf("the pending queue is oldest first so staff work the longest wait first: %s", queue.Raw)
	}
	if _, hasAge := queued[0].(map[string]any)["ageHours"].(float64); !hasAge {
		t.Fatalf("queue rows carry their waiting age: %v", queued[0])
	}
	if rows[0].(map[string]any)["id"] != second.Body["id"] {
		t.Fatalf("the unfiltered history stays newest first: %s", list.Raw)
	}
	row := rows[0].(map[string]any)
	destination := row["destination"].(map[string]any)
	if row["userId"] != user || row["provider"] != "flutterwave" || destination["accountLast4"] != "4821" || destination["bankName"] == "" || destination["addedAt"] == nil {
		t.Fatalf("staff row: %v", row)
	}
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.withdrawals.process")
	stepUp := staff.StepUp
	firstId, secondId := first.Body["id"].(string), second.Body["id"].(string)
	held := harness.Call(http.MethodPost, "/api/v1/admin/withdrawals/"+firstId+"/review", staff.AccessToken, "hold-key-1", map[string]any{"decision": "hold", "reason": "Checking the account name"}, stepUp())
	if held.Status != http.StatusOK || held.Body["withdrawalStatus"] != "on_hold" || held.Body["reviewNote"] != "Checking the account name" {
		t.Fatalf("hold: %d %s", held.Status, held.Raw)
	}
	if cancel := harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals/"+firstId+"/cancel", token, "", nil); cancel.Status != http.StatusConflict {
		t.Fatalf("a held withdrawal was cancelled by the user: %d", cancel.Status)
	}
	if beyond := harness.withdraw(token, "staff-view-key-3", accountId, 111_000); beyond.Status != http.StatusUnprocessableEntity {
		t.Fatalf("held money was spendable again: %d", beyond.Status)
	}
	approved := harness.Call(http.MethodPost, "/api/v1/admin/withdrawals/"+firstId+"/review", staff.AccessToken, "approve-key-1", map[string]any{"decision": "approve"}, stepUp())
	if approved.Status != http.StatusOK || approved.Body["withdrawalStatus"] != "queued" {
		t.Fatalf("approve from hold: %d %s", approved.Status, approved.Raw)
	}
	rejected := harness.Call(http.MethodPost, "/api/v1/admin/withdrawals/"+secondId+"/review", staff.AccessToken, "reject-key-1", map[string]any{"decision": "reject", "reason": "Account under review"}, stepUp())
	if rejected.Status != http.StatusOK || rejected.Body["withdrawalStatus"] != "failed" {
		t.Fatalf("reject: %d %s", rejected.Status, rejected.Raw)
	}
	detail := harness.Call(http.MethodGet, "/api/v1/admin/withdrawals/"+secondId, reader.AccessToken, "", nil)
	if detail.Status != http.StatusOK || detail.Body["availableBalance"].(map[string]any)["amountMinor"].(float64) != 150_000 || len(detail.Body["recentWithdrawals"].([]any)) != 1 {
		t.Fatalf("detail: %d %s", detail.Status, detail.Raw)
	}
	if again := harness.Call(http.MethodPost, "/api/v1/admin/withdrawals/"+secondId+"/review", staff.AccessToken, "reject-key-2", map[string]any{"decision": "reject", "reason": "Again"}, stepUp()); again.Status != http.StatusConflict {
		t.Fatalf("a rejected withdrawal was reversed twice: %d", again.Status)
	}
	harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp())
	harness.FinishTransfer(first.Body["reference"].(string), false)
	if harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")) != 200_000 || harness.balance(ledgermodels.WalletReservedPayoutAccount(user, "NGN")) != 0 {
		t.Fatal("a failed transfer and a rejection did not return every kobo to available")
	}
	harness.AssertLedgerHealthy()
}
