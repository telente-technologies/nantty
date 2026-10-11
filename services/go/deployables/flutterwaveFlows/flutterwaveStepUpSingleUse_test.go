package flutterwaveflows

import (
	"net/http"
	"sync"
	"testing"

	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
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
