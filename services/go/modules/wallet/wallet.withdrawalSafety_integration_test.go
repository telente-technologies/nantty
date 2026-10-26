package wallet

import (
	"context"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/wallet/src/configs"
)

func (harness *walletHarness) withdrawalStatus(reference string) string {
	harness.T.Helper()
	var status string
	schema := harness.wallet.Payouts.Container.Settings.Money.DatabaseSchema
	if err := harness.Database.QueryRow(`SELECT status FROM "`+schema+`".withdrawals WHERE reference = $1`, reference).Scan(&status); err != nil {
		harness.T.Fatal(err)
	}
	return status
}

func (harness *walletHarness) setClock(at time.Time) {
	harness.wallet.Payouts.Container.Now = func() time.Time { return at }
}

func withLimits(limits configs.WithdrawalLimits) func(*configs.WalletSettings) {
	return func(settings *configs.WalletSettings) { settings.WithdrawalLimits = limits }
}

func TestWithdrawalAndNewPayoutAccountNeedAStepUpForTheSameSession(t *testing.T) {
	harness := startWalletHarness(t, true)
	user, stranger := uuid.NewString(), uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(user, 100_000)
	body := map[string]any{"payoutAccountId": accountId, "amount": map[string]any{"amountMinor": 20_000, "currency": "NGN"}}
	refusals := map[string]http.Header{
		"missing":       nil,
		"another-user":  {"X-Step-Up-Token": {harness.Tokens.UserStepUpToken(stranger)}},
		"plain-access":  {"X-Step-Up-Token": {token}},
		"staff-step-up": {"X-Step-Up-Token": {harness.Tokens.StaffTokens(user).StepUpToken}},
	}
	for name, header := range refusals {
		response := harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals", token, "step-up-"+name, body, header)
		if response.Status != http.StatusForbidden || response.Body["code"] != "STEP_UP_REQUIRED" {
			t.Fatalf("%s step-up: %d %s", name, response.Status, response.Raw)
		}
	}
	if added := harness.Call(http.MethodPost, "/api/v1/wallets/me/payout-accounts", token, "", map[string]any{"bankCode": "058", "accountNumber": "0123454822"}); added.Status != http.StatusForbidden {
		t.Fatalf("payout account added without step-up: %d", added.Status)
	}
	if allowed := harness.withdraw(token, "step-up-ok", accountId, 20_000); allowed.Status != http.StatusCreated {
		t.Fatalf("stepped-up withdrawal: %d %s", allowed.Status, allowed.Raw)
	}
	if harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")) != 80_000 {
		t.Fatal("only the stepped-up withdrawal may reserve money")
	}
	harness.AssertLedgerHealthy()
}

func TestWithdrawalVelocityDailyCapAndNewAccountCooldown(t *testing.T) {
	harness := startWalletHarness(t, true, withLimits(configs.WithdrawalLimits{
		MaximumPerDay: 3, MinimumGap: 10 * time.Minute, NewAccountCooldown: 48 * time.Hour, BlockWhileProcessing: true,
		DailyCapMinor: configs.ParseLevelCurrencyCaps("1:NGN:100000"),
	}))
	user := uuid.NewString()
	start := time.Now().UTC()
	harness.setClock(start)
	token, accountId := harness.fundWithdrawableBalance(user, 500_000)
	expect := func(key string, amount int64, status int, code string) {
		t.Helper()
		response := harness.withdraw(token, "velocity-"+key, accountId, amount)
		if response.Status != status || (code != "" && response.Body["code"] != code) {
			t.Fatalf("%s: %d %s, want %d %s", key, response.Status, response.Raw, status, code)
		}
	}
	expect("cooling-down", 10_000, http.StatusUnprocessableEntity, "PAYOUT_ACCOUNT_COOLING_DOWN")
	clock := start.Add(49 * time.Hour)
	harness.setClock(clock)
	expect("first", 10_000, http.StatusCreated, "")
	expect("too-soon", 10_000, http.StatusTooManyRequests, "WITHDRAWAL_TOO_SOON")
	clock = clock.Add(11 * time.Minute)
	harness.setClock(clock)
	expect("over-cap", 95_000, http.StatusUnprocessableEntity, "WITHDRAWAL_DAILY_AMOUNT_LIMIT")
	expect("second", 40_000, http.StatusCreated, "")
	clock = clock.Add(11 * time.Minute)
	harness.setClock(clock)
	expect("third", 20_000, http.StatusCreated, "")
	clock = clock.Add(11 * time.Minute)
	harness.setClock(clock)
	expect("fourth", 5_000, http.StatusTooManyRequests, "WITHDRAWAL_DAILY_LIMIT")
	clock = clock.Add(25 * time.Hour)
	harness.setClock(clock)
	schema := harness.wallet.Payouts.Container.Settings.Money.DatabaseSchema
	if _, err := harness.Database.Exec(`UPDATE "`+schema+`".withdrawals SET status = 'processing' WHERE user_id = $1 AND amount_minor = 40000`, user); err != nil {
		t.Fatal(err)
	}
	expect("while-processing", 5_000, http.StatusConflict, "WITHDRAWAL_IN_PROGRESS")
	if _, err := harness.Database.Exec(`UPDATE "`+schema+`".withdrawals SET status = 'pending_review' WHERE user_id = $1 AND amount_minor = 40000`, user); err != nil {
		t.Fatal(err)
	}
	expect("next-day", 50_000, http.StatusCreated, "")
	if harness.balance(ledgermodels.WalletReservedPayoutAccount(user, "NGN")) != 120_000 {
		t.Fatal("refused withdrawals must not reserve money")
	}
	harness.AssertLedgerHealthy()
}

func TestANameMatchedOnlyLevelOneBankIsCappedAtOneHundredThousandNairaPerDay(t *testing.T) {
	harness := startWalletHarness(t, true, withLimits(configs.WithdrawalLimits{
		MaximumPerDay:                10,
		DailyCapMinor:                configs.ParseLevelCurrencyCaps("1:NGN:50000000,2:NGN:500000000"),
		NameMatchedOnlyDailyCapMinor: configs.ParseCurrencyCaps("NGN:10000000"),
	}))
	user := uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(user, 30_000_000)

	// PAYOUT_BANK_VALIDATION=optional and no completed bank validation means the NG payout
	// account is only name-matched: method "payout_account" at Level 1.
	paymentsSchema := harness.Payments.Application.Container.Settings.Money.DatabaseSchema
	if _, err := harness.Database.Exec(`DELETE FROM "`+paymentsSchema+`".customer_validations WHERE user_id = $1`, user); err != nil {
		t.Fatal(err)
	}
	harness.Payments.Application.Container.Settings.CustomerValidationMode = "optional"
	level, err := harness.Payments.Application.Gateway.ReadVerificationLevel(context.Background(), user)
	if err != nil || level.Level != 1 || level.Method == nil || *level.Method != "payout_account" {
		t.Fatalf("expected a name-matched-only Level 1 account, got %+v %v", level, err)
	}

	over := harness.withdraw(token, "name-matched-over", accountId, 20_000_000)
	if over.Status != http.StatusUnprocessableEntity || over.Body["code"] != "WITHDRAWAL_DAILY_AMOUNT_LIMIT" {
		t.Fatalf("200,000 NGN must exceed the 100,000 NGN name-matched-only cap: %d %s", over.Status, over.Raw)
	}
	under := harness.withdraw(token, "name-matched-under", accountId, 9_000_000)
	if under.Status != http.StatusCreated {
		t.Fatalf("90,000 NGN is under the name-matched-only cap: %d %s", under.Status, under.Raw)
	}
	harness.AssertLedgerHealthy()
}

func TestConcurrentWithdrawalsRespectTheMinimumGap(t *testing.T) {
	harness := startWalletHarness(t, true, withLimits(configs.WithdrawalLimits{MaximumPerDay: 3, MinimumGap: 10 * time.Minute}))
	user := uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(user, 100_000)
	var created atomic.Int64
	var group sync.WaitGroup
	for attempt := range 10 {
		group.Add(1)
		go func() {
			defer group.Done()
			response := harness.withdraw(token, "gap-race-"+string(rune('a'+attempt)), accountId, 30_000)
			switch response.Status {
			case http.StatusCreated:
				created.Add(1)
			case http.StatusTooManyRequests:
			default:
				t.Errorf("unexpected %d %s", response.Status, response.Raw)
			}
		}()
	}
	group.Wait()
	if created.Load() != 1 || harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")) != 70_000 {
		t.Fatalf("created %d withdrawals inside one gap", created.Load())
	}
	harness.AssertLedgerHealthy()
}

func TestWithdrawalTimeoutThenProviderSuccessIsPaidExactlyOnce(t *testing.T) {
	harness := startWalletHarness(t, false)
	user := uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(user, 100_000)
	created := harness.withdraw(token, "timeout-withdraw", accountId, 50_000)
	reference := created.Body["reference"].(string)
	harness.Flutterwave.LoseNextTransferReply = true
	harness.wallet.Payouts.Withdrawals.RunPayoutBatch(context.Background(), 10)
	if status := harness.withdrawalStatus(reference); status != "processing" {
		t.Fatalf("a lost transfer reply must stay processing, got %s", status)
	}
	harness.wallet.Payouts.Withdrawals.FinalizeProcessingWithdrawalsOlderThan(context.Background(), -time.Minute)
	harness.wallet.Payouts.Withdrawals.RunPayoutBatch(context.Background(), 10)
	if status := harness.withdrawalStatus(reference); status != "processing" {
		t.Fatalf("pending at the provider must stay processing, got %s", status)
	}
	for range 2 {
		harness.FinishTransfer(reference, true)
		harness.wallet.Payouts.Withdrawals.FinalizeProcessingWithdrawalsOlderThan(context.Background(), -time.Minute)
	}
	if status := harness.withdrawalStatus(reference); status != "paid" || harness.Flutterwave.Calls("POST /transfers") != 1 {
		t.Fatalf("status %s after %d transfer posts", status, harness.Flutterwave.Calls("POST /transfers"))
	}
	if harness.balance(ledgermodels.WalletReservedPayoutAccount(user, "NGN")) != 0 || harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")) != 50_000 {
		t.Fatal("a paid withdrawal must leave reserved at zero and never return money")
	}
	harness.AssertLedgerHealthy()
}

func TestProcessingWithdrawalWithoutATransferRowIsQueuedAgainAndPaidOnce(t *testing.T) {
	harness := startWalletHarness(t, false)
	user := uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(user, 100_000)
	reference := harness.withdraw(token, "orphan-withdraw", accountId, 40_000).Body["reference"].(string)
	schema := harness.wallet.Payouts.Container.Settings.Money.DatabaseSchema
	if _, err := harness.Database.Exec(`UPDATE "`+schema+`".withdrawals SET status = 'processing', updated_at = now() - interval '1 hour' WHERE reference = $1`, reference); err != nil {
		t.Fatal(err)
	}
	harness.wallet.Payouts.Withdrawals.FinalizeProcessingWithdrawalsOlderThan(context.Background(), 10*time.Minute)
	if status := harness.withdrawalStatus(reference); status != "queued" || harness.Flutterwave.Calls("POST /transfers") != 0 {
		t.Fatalf("an orphaned withdrawal must go back to the queue without a provider call, got %s", status)
	}
	harness.wallet.Payouts.Withdrawals.RunPayoutBatch(context.Background(), 10)
	harness.wallet.Payouts.Withdrawals.RunPayoutBatch(context.Background(), 10)
	harness.FinishTransfer(reference, true)
	if status := harness.withdrawalStatus(reference); status != "paid" || harness.Flutterwave.Calls("POST /transfers") != 1 {
		t.Fatalf("status %s after %d transfer posts", status, harness.Flutterwave.Calls("POST /transfers"))
	}
	harness.AssertLedgerHealthy()
}
