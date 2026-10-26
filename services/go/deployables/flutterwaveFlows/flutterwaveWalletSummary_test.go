package flutterwaveflows

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"testing"
	"time"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

var walletLineKeys = []string{"available", "pending", "locked", "earningsPayable", "adCredit", "coins", "debts"}

func (harness *flowHarness) walletLines(userId string) map[string]int64 {
	harness.T.Helper()
	summary := harness.Call(http.MethodGet, "/api/v1/wallets/me", harness.Tokens.UserAccessToken(userId), "", nil)
	if summary.Status != http.StatusOK {
		harness.T.Fatalf("wallet summary: %d %s", summary.Status, summary.Raw)
	}
	lines, _ := summary.Body["lines"].([]any)
	if len(lines) != len(walletLineKeys) {
		harness.T.Fatalf("the summary keeps its 7 lines: %s", summary.Raw)
	}
	amounts := map[string]int64{}
	for index, raw := range lines {
		line := raw.(map[string]any)
		if line["key"] != walletLineKeys[index] {
			harness.T.Fatalf("line %d is %v, want %s", index, line["key"], walletLineKeys[index])
		}
		amounts[walletLineKeys[index]] = int64(line["amount"].(map[string]any)["amountMinor"].(float64))
	}
	return amounts
}

func (harness *flowHarness) sellerBalances(sellerId string) map[string]int64 {
	harness.T.Helper()
	headers := http.Header{"X-Internal-Token": {strings.Repeat("w", 32)}, "X-Seller-Store-Id": {"6f1c6c6a-0000-4000-8000-000000000001"}, "X-Store-Currency": {"NGN"},
		"X-Store-Country": {"NG"}, "X-Store-Timezone": {"Africa/Lagos"}, "X-Store-Name": {"Ada Fabrics"}}
	response := harness.Call(http.MethodGet, "/api/v1/internal/sellers/"+sellerId+"/wallet/balances", "", "", nil, headers)
	if response.Status != http.StatusOK {
		harness.T.Fatalf("seller balances: %d %s", response.Status, response.Raw)
	}
	amounts := map[string]int64{}
	for _, key := range []string{"escrow", "pending", "available"} {
		amounts[key] = int64(response.Body[key].(map[string]any)["amountMinor"].(float64))
	}
	return amounts
}

func TestWalletSummaryAndSellerViewsReadTheFlutterwaveWalletLedger(t *testing.T) {
	harness := startFlowHarness(t)
	harness.wallet.Payouts.Container.Settings.EscrowSchema = harness.escrow.Application.Container.Settings.Money.DatabaseSchema
	buyer, seller := harness.newUser("NG"), harness.newUser("NG")
	harness.verifyToLevelOne(buyer)
	harness.verifyToLevelOne(seller)
	harness.markSellerBusinessVerified(seller)
	harness.deposit(buyer, 1_000_000)
	harness.runWorkers()
	spendable := harness.balance(ledgermodels.WalletAvailableAccount(buyer, "NGN")) + harness.balance(ledgermodels.WalletDepositHoldAccount(buyer, "NGN"))
	lines := harness.walletLines(buyer)
	if spendable <= 0 || lines["available"]+lines["locked"] != spendable || lines["available"] != harness.balance(ledgermodels.WalletAvailableAccount(buyer, "NGN")) {
		t.Fatalf("buyer summary must show the PSA-backed wallet (spendable %d): %v", spendable, lines)
	}
	placed := harness.registerOrder(buyer, seller, 300_000, "NGN", "escrow")
	harness.initialize(buyer, &placed)
	if paid := harness.payWithWallet(buyer, placed, "summary-pay-0001"); paid.Status != http.StatusOK {
		t.Fatalf("wallet payment: %d %s", paid.Status, paid.Raw)
	}
	held := harness.escrowFor(placed)
	if lines := harness.walletLines(seller); lines["pending"] != held.SellerAmountMinor || lines["available"] != 0 {
		t.Fatalf("the seller sees the escrow as pending (%d): %v", held.SellerAmountMinor, lines)
	}
	if view := harness.sellerBalances(seller); view["escrow"] != held.SellerAmountMinor {
		t.Fatalf("seller dashboard escrow: %v", view)
	}
	if err := harness.confirmReceipt(buyer, placed); err != nil {
		t.Fatal(err)
	}
	harness.runWorkers()
	released := harness.balance(ledgermodels.WalletAvailableAccount(seller, "NGN")) + harness.balance(ledgermodels.WalletDepositHoldAccount(seller, "NGN"))
	if released <= 0 {
		t.Fatal("the release must reach the seller wallet")
	}
	lines = harness.walletLines(seller)
	if lines["pending"] != 0 || lines["available"]+lines["locked"] != released {
		t.Fatalf("after release the seller sees the wallet money (%d): %v", released, lines)
	}
	harness.advance(49 * time.Hour)
	harness.runWorkers()
	lines = harness.walletLines(seller)
	if available := harness.balance(ledgermodels.WalletAvailableAccount(seller, "NGN")); lines["available"] != available || available <= 0 {
		t.Fatalf("after the hold the money is available (%d): %v", available, lines)
	}
	if view := harness.sellerBalances(seller); view["available"] != lines["available"] || view["escrow"] != 0 {
		t.Fatalf("seller dashboard after release: %v", view)
	}
	transactions := harness.Call(http.MethodGet, "/api/v1/wallets/me/transactions", harness.Tokens.UserAccessToken(seller), "", nil)
	if data, _ := transactions.Body["data"].([]any); transactions.Status != http.StatusOK || len(data) == 0 {
		t.Fatalf("seller transactions must list wallet activity: %d %s", transactions.Status, transactions.Raw)
	}
}

func (harness *flowHarness) recordWalletDebt(userId string, amountMinor int64) {
	harness.T.Helper()
	err := databases.RunInMoneyTransaction(context.Background(), harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: "test-wallet-debt:" + userId, Kind: "wallet.fundingReversed", Description: "Reversed deposit",
			Lines: []ledgermodels.JournalLineRequest{
				{Account: ledgermodels.WalletDebtAccount(userId, "NGN"), Direction: ledgermodels.Debit, AmountMinor: amountMinor},
				{Account: ledgermodels.PaymentsAwaitingApplicationAccount("NGN"), Direction: ledgermodels.Credit, AmountMinor: amountMinor},
			},
		})
		return err
	})
	if err != nil {
		harness.T.Fatal(err)
	}
}

func TestFundingAdsFromTheWalletNetsAnOutstandingDebtFirst(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.newUser("NG")
	harness.verifyToLevelOne(user)
	harness.deposit(user, 400_000)
	harness.runWorkers()
	spendable := harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")) + harness.balance(ledgermodels.WalletDepositHoldAccount(user, "NGN"))
	harness.recordWalletDebt(user, 250_000)
	if lines := harness.walletLines(user); lines["debts"] != 250_000 {
		t.Fatalf("the summary shows what is owed: %v", lines)
	}
	free := spendable - 250_000
	refused := harness.fundAdsFromWallet(user, "debt-ads-000001", free+1)
	if refused.Status != http.StatusConflict || refused.Body["code"] != "WALLET_DEBT_OUTSTANDING" {
		t.Fatalf("spending money that is owed must be refused: %d %s", refused.Status, refused.Raw)
	}
	if boost := harness.boostFromWallet(user, "debt-boost-00001", free+1); boost.Status != http.StatusConflict {
		t.Fatalf("a boost from the wallet nets the debt too: %d %s", boost.Status, boost.Raw)
	}
	if allowed := harness.fundAdsFromWallet(user, "debt-ads-000002", free); allowed.Status >= 300 {
		t.Fatalf("what is left after the debt can be spent: %d %s", allowed.Status, allowed.Raw)
	}
	if after := harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")) + harness.balance(ledgermodels.WalletDepositHoldAccount(user, "NGN")); after != 250_000 {
		t.Fatalf("the owed amount stays in the wallet, left %d", after)
	}
}
