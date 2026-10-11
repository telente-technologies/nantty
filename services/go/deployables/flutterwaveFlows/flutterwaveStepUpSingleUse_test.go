package flutterwaveflows

import (
	"net/http"
	"strings"
	"sync"
	"testing"

	ledgermiddlewares "zudomart/modules/ledger/src/middlewares"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	walletconfigs "zudomart/modules/wallet/src/configs"
)

func (harness *flowHarness) withdrawWithStepUp(userId, accountId string, amountMinor int64, key string, stepUp http.Header) paymentstesting.HarnessResponse {
	return harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals", harness.Tokens.UserAccessToken(userId), key, map[string]any{
		"payoutAccountId": accountId, "amount": map[string]any{"amountMinor": amountMinor, "currency": "NGN"},
	}, stepUp)
}

func TestAUserStepUpConfirmsOneMoneyActionAndItsReplayIsRefused(t *testing.T) {
	harness := startFlowHarness(t)
	user, accountId := harness.fundedSellerWithPayoutAccount(500_000)
	token := harness.Tokens.UserAccessToken(user)
	stepUp := harness.StepUpFor(token)
	first := harness.withdrawWithStepUp(user, accountId, 100_000, "su-wd-00001", stepUp)
	if first.Status != http.StatusCreated && first.Status != http.StatusOK {
		t.Fatalf("first withdrawal: %d %s", first.Status, first.Raw)
	}
	replayed := harness.withdrawWithStepUp(user, accountId, 100_000, "su-wd-00002", stepUp)
	if replayed.Status != http.StatusUnauthorized || replayed.Body["code"] != "STEP_UP_REUSED" {
		t.Fatalf("a replayed step-up must be refused: %d %s", replayed.Status, replayed.Raw)
	}
	added := harness.Call(http.MethodPost, "/api/v1/wallets/me/payout-accounts", token, "su-add-0001", map[string]any{
		"countryCode": "NG", "bankCode": "044", "accountNumber": paymentstesting.TestBankAccountNumberFor(user),
	}, stepUp)
	if added.Status != http.StatusUnauthorized || added.Body["code"] != "STEP_UP_REUSED" {
		t.Fatalf("a step-up used for a withdrawal must not add a payout account: %d %s", added.Status, added.Raw)
	}
	bank := harness.Call(http.MethodPut, "/api/v1/payments/payout-onboarding/me/bank", token, "", map[string]any{"bankCode": "044", "accountNumber": paymentstesting.TestBankAccountNumberFor(user)}, stepUp)
	if bank.Status != http.StatusUnauthorized || bank.Body["code"] != "STEP_UP_REUSED" {
		t.Fatalf("a used step-up must not change the payout bank: %d %s", bank.Status, bank.Raw)
	}
	if fresh := harness.withdrawWithStepUp(user, accountId, 100_000, "su-wd-00003", harness.StepUpFor(token)); fresh.Status == http.StatusUnauthorized {
		t.Fatalf("a fresh step-up must be accepted: %d %s", fresh.Status, fresh.Raw)
	}
}

func TestTwoConcurrentWithdrawalsWithOneStepUpMoveMoneyOnce(t *testing.T) {
	harness := startFlowHarness(t)
	user, accountId := harness.fundedSellerWithPayoutAccount(500_000)
	stepUp := harness.StepUpFor(harness.Tokens.UserAccessToken(user))
	results := make([]paymentstesting.HarnessResponse, 4)
	var group sync.WaitGroup
	for index := range results {
		group.Add(1)
		go func() {
			defer group.Done()
			results[index] = harness.withdrawWithStepUp(user, accountId, 50_000, "su-race-000"+itoa(int64(index)), stepUp)
		}()
	}
	group.Wait()
	accepted, reused := 0, 0
	for _, result := range results {
		switch {
		case result.Status == http.StatusUnauthorized && result.Body["code"] == "STEP_UP_REUSED":
			reused++
		case result.Status < 300:
			accepted++
		default:
			t.Fatalf("unexpected response: %d %s", result.Status, result.Raw)
		}
	}
	if accepted != 1 || reused != len(results)-1 {
		t.Fatalf("one step-up must confirm exactly one withdrawal: accepted %d, reused %d", accepted, reused)
	}
}

func TestAStepUpSpentOnAWithdrawalCannotConfirmAnAdsPayment(t *testing.T) {
	harness := startFlowHarness(t)
	user, accountId := harness.fundedSellerWithPayoutAccount(500_000)
	stepUp := harness.StepUpFor(harness.Tokens.UserAccessToken(user))
	if first := harness.withdrawWithStepUp(user, accountId, 100_000, "su-ads-wd-0001", stepUp); first.Status >= 300 {
		t.Fatalf("withdrawal: %d %s", first.Status, first.Raw)
	}
	internal := http.Header{"X-Internal-Token": {strings.Repeat("w", 32)}}
	consume := func(digest string) paymentstesting.HarnessResponse {
		return harness.Call(http.MethodPost, "/api/v1/internal/ads/step-up-consumptions", "", "", map[string]any{"digest": digest, "userId": user, "route": "POST /api/v1/ads/boosts"}, internal)
	}
	if reused := consume(ledgermiddlewares.StepUpTokenDigest(stepUp.Get("X-Step-Up-Token"))); reused.Status != http.StatusUnauthorized || reused.Body["code"] != "STEP_UP_REUSED" {
		t.Fatalf("goAds must be told the token was already spent: %d %s", reused.Status, reused.Raw)
	}
	fresh := ledgermiddlewares.StepUpTokenDigest(harness.StepUpFor(harness.Tokens.UserAccessToken(user)).Get("X-Step-Up-Token"))
	if first := consume(fresh); first.Status != http.StatusNoContent {
		t.Fatalf("a fresh digest is consumed once: %d %s", first.Status, first.Raw)
	}
	if again := consume(fresh); again.Status != http.StatusUnauthorized {
		t.Fatalf("and only once: %d %s", again.Status, again.Raw)
	}
	if forged := harness.Call(http.MethodPost, "/api/v1/internal/ads/step-up-consumptions", "", "", map[string]any{"digest": fresh, "userId": user, "route": "x"}, http.Header{"X-Internal-Token": {strings.Repeat("x", 32)}}); forged.Status != http.StatusUnauthorized || forged.Body["code"] == "STEP_UP_REUSED" {
		t.Fatalf("the endpoint needs the internal token: %d %s", forged.Status, forged.Raw)
	}
}

func TestAWithdrawalInACurrencyWithoutADailyCapIsRefused(t *testing.T) {
	harness := startFlowHarness(t)
	user, accountId := harness.fundedSellerWithPayoutAccount(500_000)
	harness.wallet.Payouts.Container.Settings.WithdrawalLimits.DailyCapMinor = walletconfigs.ParseLevelCurrencyCaps("1:GHS:500000")
	refused := harness.withdraw(user, accountId, 100_000, "no-cap-wd-0001", true)
	if refused.Status != http.StatusUnprocessableEntity || refused.Body["code"] != "WITHDRAWAL_CURRENCY_NOT_AVAILABLE" {
		t.Fatalf("a currency with no configured daily cap must fail closed: %d %s", refused.Status, refused.Raw)
	}
	harness.wallet.Payouts.Container.Settings.WithdrawalLimits.DailyCapMinor = walletconfigs.ParseLevelCurrencyCaps("1:NGN:150000")
	if over := harness.withdraw(user, accountId, 150_001, "no-cap-wd-0002", true); over.Body["code"] != "WITHDRAWAL_DAILY_AMOUNT_LIMIT" {
		t.Fatalf("a configured cap still applies: %d %s", over.Status, over.Raw)
	}
	if allowed := harness.withdraw(user, accountId, 100_000, "no-cap-wd-0003", true); allowed.Status >= 300 {
		t.Fatalf("a withdrawal inside the cap goes through: %d %s", allowed.Status, allowed.Raw)
	}
}
