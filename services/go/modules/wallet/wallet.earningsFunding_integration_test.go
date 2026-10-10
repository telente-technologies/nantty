package wallet

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/integrations/paymentsTesting"
)

var internalHeaders = http.Header{"X-Internal-Token": {strings.Repeat("w", 32)}}

func (harness *walletHarness) fundAdsFromEarnings(userId, adAccountId, key string, amountMinor int64) paymentstesting.HarnessResponse {
	return harness.Call(http.MethodPost, "/api/v1/internal/ads/accounts/"+adAccountId+"/earnings-fundings", "", key,
		map[string]any{"userId": userId, "amount": map[string]any{"amountMinor": amountMinor, "currency": "NGN"}}, internalHeaders)
}

func (harness *walletHarness) countOutboxEvents(schema, eventType, subject string) int {
	harness.T.Helper()
	var count int
	query := "SELECT count(*) FROM " + pgx.Identifier{schema, "outbox_events"}.Sanitize() + " WHERE event_type = $1 AND subject = $2"
	if err := harness.Database.QueryRowContext(context.Background(), query, eventType, subject).Scan(&count); err != nil {
		harness.T.Fatal(err)
	}
	return count
}

func TestUnverifiedUsersCannotFundAdsFromEarningsAndKeepTheirMoney(t *testing.T) {
	harness := startWalletHarness(t, false)
	user := uuid.NewString()
	harness.post(ledgermodels.JournalEntryRequest{Reference: "seed-unverified-" + user, Kind: "test.seedAvailable", Lines: []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.CreatorCoinPayoutExpenseAccount("NGN"), Direction: ledgermodels.Debit, AmountMinor: 50_000},
		{Account: ledgermodels.SellerAvailableAccount(user, "NGN"), Direction: ledgermodels.Credit, AmountMinor: 50_000},
	}})
	refused := harness.fundAdsFromEarnings(user, "ads-"+user[:8], "unverified-fund-1", 10_000)
	if refused.Status != http.StatusForbidden || refused.Body["code"] != "VERIFICATION_REQUIRED" {
		t.Fatalf("an unverified user funded ads: %d %s", refused.Status, refused.Raw)
	}
	if harness.balance(ledgermodels.SellerAvailableAccount(user, "NGN")) != 50_000 {
		t.Fatal("a refused funding must not move money")
	}
	summary := harness.Call(http.MethodGet, "/api/v1/wallets/me", harness.Tokens.UserAccessToken(user), "", nil, http.Header{"X-Client-Region": {"NG"}})
	verification := summary.Body["verification"].(map[string]any)
	if verification["withdrawalsUnlocked"] != false || verification["message"] != "Verify to withdraw ₦500" || verification["nextStep"] != "payout_setup" {
		t.Fatalf("an unverified user must be told to verify, never that money is lost: %s", summary.Raw)
	}
	harness.AssertLedgerHealthy()
}

func TestFundingAdsFromEarningsNetsDebtsIsIdempotentAndReturnsUnusedCredit(t *testing.T) {
	harness := startWalletHarness(t, false)
	harness.wallet.Coins.Container.Settings.AdPrepaidRefundsEnabled = false
	user := uuid.NewString()
	token, _ := harness.fundWithdrawableBalance(user, 100_000)
	harness.bookDebt("debt-ads-"+user, ledgermodels.SellerDebtAccount(user, "NGN"), 30_000)
	adAccount := "ads-" + user[:8]
	if tooMuch := harness.fundAdsFromEarnings(user, adAccount, "fund-too-much-1", 80_000); tooMuch.Status != http.StatusUnprocessableEntity || tooMuch.Body["code"] != "INSUFFICIENT_FUNDS" {
		t.Fatalf("funding above the balance after debts: %d %s", tooMuch.Status, tooMuch.Raw)
	}
	first := harness.fundAdsFromEarnings(user, adAccount, "fund-earnings-1", 50_000)
	replay := harness.fundAdsFromEarnings(user, adAccount, "fund-earnings-1", 50_000)
	if first.Status != http.StatusCreated || replay.Status != http.StatusOK || replay.Body["fundingId"] != first.Body["fundingId"] || replay.Body["replayed"] != true {
		t.Fatalf("idempotent funding: %d %s / %d %s", first.Status, first.Raw, replay.Status, replay.Raw)
	}
	if reused := harness.fundAdsFromEarnings(user, adAccount, "fund-earnings-1", 10_000); reused.Status != http.StatusConflict || reused.Body["code"] != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("a reused key with another amount: %d %s", reused.Status, reused.Raw)
	}
	prepaid := ledgermodels.AdvertiserPrepaidBalanceAccount(adAccount, "NGN")
	if harness.balance(prepaid) != 50_000 || harness.balance(ledgermodels.SellerAvailableAccount(user, "NGN")) != 50_000 {
		t.Fatal("funding must move exactly once from available to ad credit")
	}
	if events := harness.countOutboxEvents(harness.wallet.Coins.Container.Settings.Money.DatabaseSchema, "adBalance.toppedUp", adAccount); events != 1 {
		t.Fatalf("ads must hear about the credit once, got %d", events)
	}
	if overDebt := harness.fundAdsFromEarnings(user, adAccount, "fund-earnings-2", 30_000); overDebt.Status != http.StatusUnprocessableEntity {
		t.Fatalf("funding into the money owed to Zudomart: %d %s", overDebt.Status, overDebt.Raw)
	}
	spend := map[string]any{"batchId": uuid.NewString(), "accountId": adAccount, "currency": "NGN", "debitMinor": 20_000, "impressionCount": 10, "idempotencyKey": "earnings-spend-0001"}
	harness.Call(http.MethodPost, "/api/v1/internal/ads/spend-batches", "", "", spend, internalHeaders)
	summary := harness.Call(http.MethodGet, "/api/v1/wallets/me", token, "", nil, http.Header{"X-Client-Region": {"NG"}})
	lines := map[string]float64{}
	for _, raw := range summary.Body["lines"].([]any) {
		line := raw.(map[string]any)
		lines[line["key"].(string)] = line["amount"].(map[string]any)["amountMinor"].(float64)
	}
	if lines["available"] != 20_000 || lines["adCredit"] != 30_000 || lines["debts"] != 30_000 || len(lines) != 7 || summary.Body["verification"].(map[string]any)["message"] != nil {
		t.Fatalf("one wallet with separate lines: %s", summary.Raw)
	}
	refund := harness.Call(http.MethodPost, "/api/v1/ads/balance/refund", token, "", map[string]any{"adAccountId": adAccount})
	if refund.Status != http.StatusAccepted || refund.Body["refunded"].(map[string]any)["amountMinor"].(float64) != 30_000 {
		t.Fatalf("unused earnings-funded credit must return even with card refunds off: %d %s", refund.Status, refund.Raw)
	}
	if harness.balance(prepaid) != 0 || harness.balance(ledgermodels.SellerAvailableAccount(user, "NGN")) != 80_000 {
		t.Fatal("the refund must land back in available")
	}
	if again := harness.Call(http.MethodPost, "/api/v1/ads/balance/refund", token, "", map[string]any{"adAccountId": adAccount}); again.Status != http.StatusConflict {
		t.Fatalf("a second refund with nothing left: %d %s", again.Status, again.Raw)
	}
	harness.AssertLedgerHealthy()
}

func TestConcurrentFundingsAndWithdrawalsNeverOverdrawEarnings(t *testing.T) {
	harness := startWalletHarness(t, false)
	user := uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(user, 100_000)
	var group sync.WaitGroup
	for attempt := range 8 {
		group.Add(2)
		go func() {
			defer group.Done()
			harness.fundAdsFromEarnings(user, "ads-"+user[:8], fmt.Sprintf("race-fund-%02d", attempt), 15_000)
		}()
		go func() {
			defer group.Done()
			harness.withdraw(token, fmt.Sprintf("race-withdraw-%02d", attempt), accountId, 15_000)
		}()
	}
	group.Wait()
	available := harness.balance(ledgermodels.SellerAvailableAccount(user, "NGN"))
	moved := harness.balance(ledgermodels.AdvertiserPrepaidBalanceAccount("ads-"+user[:8], "NGN")) + harness.balance(ledgermodels.SellerReservedPayoutAccount(user, "NGN"))
	if available < 0 || available+moved != 100_000 || moved != 90_000 {
		t.Fatalf("available %d moved %d", available, moved)
	}
	harness.AssertLedgerHealthy()
}

func TestBoostsPaidFromEarningsReturnUnspentMoneyToAvailable(t *testing.T) {
	harness := startWalletHarness(t, false)
	user := uuid.NewString()
	harness.fundWithdrawableBalance(user, 100_000)
	debit := map[string]any{"userId": user, "amount": map[string]any{"amountMinor": 60_000, "currency": "NGN"}, "idempotencyKey": "earnings-boost-0001"}
	first := harness.Call(http.MethodPost, "/api/v1/internal/ads/boost-earnings-debits", "", "", debit, internalHeaders)
	replay := harness.Call(http.MethodPost, "/api/v1/internal/ads/boost-earnings-debits", "", "", debit, internalHeaders)
	if first.Status != http.StatusOK || replay.Body["replayed"] != true || harness.balance(ledgermodels.SellerAvailableAccount(user, "NGN")) != 40_000 {
		t.Fatalf("boost from earnings: %s / %s", first.Raw, replay.Raw)
	}
	refund := map[string]any{"userId": user, "amount": map[string]any{"amountMinor": 60_000, "currency": "NGN"}, "idempotencyKey": "refund-earnings-boost-0001", "debitIdempotencyKey": "earnings-boost-0001"}
	if returned := harness.Call(http.MethodPost, "/api/v1/internal/ads/boost-refunds", "", "", refund, internalHeaders); returned.Status != http.StatusOK {
		t.Fatalf("boost refund: %d %s", returned.Status, returned.Raw)
	}
	if harness.balance(ledgermodels.SellerAvailableAccount(user, "NGN")) != 100_000 || harness.balance(ledgermodels.AdvertiserPrepaidBalanceAccount("user-"+user, "NGN")) != 0 {
		t.Fatal("a cancelled earnings-paid boost must return the money to available")
	}
	stranger := uuid.NewString()
	debit["userId"], debit["idempotencyKey"] = stranger, "earnings-boost-0002"
	if refused := harness.Call(http.MethodPost, "/api/v1/internal/ads/boost-earnings-debits", "", "", debit, internalHeaders); refused.Status != http.StatusForbidden {
		t.Fatalf("an unverified user paid a boost from earnings: %d %s", refused.Status, refused.Raw)
	}
	harness.AssertLedgerHealthy()
}
