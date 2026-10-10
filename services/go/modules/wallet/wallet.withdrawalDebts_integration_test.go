package wallet

import (
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
)

func (harness *walletHarness) bookDebt(reference string, debt ledgermodels.AccountRef, amountMinor int64) {
	harness.T.Helper()
	harness.post(ledgermodels.JournalEntryRequest{Reference: reference, Kind: "test.debt", Lines: []ledgermodels.JournalLineRequest{
		{Account: debt, Direction: ledgermodels.Debit, AmountMinor: amountMinor},
		{Account: ledgermodels.CreatorCoinPayoutExpenseAccount("NGN"), Direction: ledgermodels.Credit, AmountMinor: amountMinor},
	}})
}

func TestWithdrawalsSettleOutstandingDebtsFirstAndAtomically(t *testing.T) {
	harness := startWalletHarness(t, false)
	user := uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(user, 100_000)
	harness.bookDebt("debt-creator-"+user, ledgermodels.CreatorEarningsDebtAccount(user, "NGN"), 30_000)
	harness.bookDebt("debt-seller-"+user, ledgermodels.SellerDebtAccount(user, "NGN"), 10_000)
	summary := harness.Call(http.MethodGet, "/api/v1/wallets/me?currency=NGN", token, "", nil, http.Header{"X-Client-Region": {"NG"}})
	if summary.Body["available"].(map[string]any)["amountMinor"].(float64) != 60_000 || summary.Body["negativeBalance"].(map[string]any)["amountMinor"].(float64) != 40_000 {
		t.Fatalf("summary must net debts: %s", summary.Raw)
	}
	if tooMuch := harness.withdraw(token, "debt-withdraw-too-much", accountId, 70_000); tooMuch.Status != http.StatusUnprocessableEntity {
		t.Fatalf("withdrawal above the net balance: %d %s", tooMuch.Status, tooMuch.Raw)
	}
	if harness.balance(ledgermodels.CreatorEarningsDebtAccount(user, "NGN")) != 30_000 || harness.balance(ledgermodels.SellerAvailableAccount(user, "NGN")) != 100_000 {
		t.Fatal("a refused withdrawal must not settle any debt")
	}
	var created atomic.Int64
	var group sync.WaitGroup
	for attempt := range 5 {
		group.Add(1)
		go func() {
			defer group.Done()
			if response := harness.withdraw(token, fmt.Sprintf("debt-withdraw-%02d", attempt), accountId, 20_000); response.Status == http.StatusCreated {
				created.Add(1)
			} else if response.Status != http.StatusUnprocessableEntity {
				t.Errorf("unexpected %d %s", response.Status, response.Raw)
			}
		}()
	}
	group.Wait()
	replay := harness.withdraw(token, "debt-withdraw-00", accountId, 20_000)
	if created.Load() != 3 || (replay.Status != http.StatusCreated && replay.Status != http.StatusUnprocessableEntity) {
		t.Fatalf("created=%d replay=%d", created.Load(), replay.Status)
	}
	if harness.balance(ledgermodels.CreatorEarningsDebtAccount(user, "NGN")) != 0 || harness.balance(ledgermodels.SellerDebtAccount(user, "NGN")) != 0 ||
		harness.balance(ledgermodels.SellerAvailableAccount(user, "NGN")) != 0 || harness.balance(ledgermodels.SellerReservedPayoutAccount(user, "NGN")) != 60_000 {
		t.Fatal("debts must be settled exactly once and only the net balance withdrawn")
	}
	harness.AssertLedgerHealthy()
}
