package wallet

import (
	"fmt"
	"net/http"
	"sync"
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

func TestAnOutstandingWalletDebtBlocksWithdrawalsAndMovesNoMoney(t *testing.T) {
	harness := startWalletHarness(t, false)
	user := uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(user, 100_000)
	harness.bookDebt("debt-wallet-"+user, ledgermodels.WalletDebtAccount(user, "NGN"), 40_000)
	var group sync.WaitGroup
	for attempt := range 5 {
		group.Add(1)
		go func() {
			defer group.Done()
			if response := harness.withdraw(token, fmt.Sprintf("debt-withdraw-%02d", attempt), accountId, 20_000); response.Status != http.StatusConflict || response.Body["code"] != "WALLET_DEBT_OUTSTANDING" {
				t.Errorf("a withdrawal with a debt outstanding: %d %s", response.Status, response.Raw)
			}
		}()
	}
	group.Wait()
	if harness.balance(ledgermodels.WalletDebtAccount(user, "NGN")) != 40_000 || harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")) != 100_000 ||
		harness.balance(ledgermodels.WalletReservedPayoutAccount(user, "NGN")) != 0 {
		t.Fatalf("a refused withdrawal must move no money: %v", harness.NonZeroBalances())
	}
	harness.AssertLedgerHealthy()
}

func TestASellerDebtInAnotherCurrencyAlsoBlocksAWithdrawal(t *testing.T) {
	harness := startWalletHarness(t, false)
	user := uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(user, 100_000)
	harness.post(ledgermodels.JournalEntryRequest{Reference: "debt-seller-usd-" + user, Kind: "test.debt", Lines: []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.SellerDebtAccount(user, "USD"), Direction: ledgermodels.Debit, AmountMinor: 2_500},
		{Account: ledgermodels.CreatorCoinPayoutExpenseAccount("USD"), Direction: ledgermodels.Credit, AmountMinor: 2_500},
	}})
	if response := harness.withdraw(token, "debt-usd-withdraw-01", accountId, 20_000); response.Status != http.StatusConflict || response.Body["code"] != "WALLET_DEBT_OUTSTANDING" {
		t.Fatalf("a chargeback debt in USD must stop an NGN cash-out: %d %s", response.Status, response.Raw)
	}
	if harness.balance(ledgermodels.WalletReservedPayoutAccount(user, "NGN")) != 0 {
		t.Fatalf("a refused withdrawal must move no money: %v", harness.NonZeroBalances())
	}
	harness.AssertLedgerHealthy()
}
