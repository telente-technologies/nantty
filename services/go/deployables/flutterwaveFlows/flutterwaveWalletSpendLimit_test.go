package flutterwaveflows

import (
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"zudomart/modules/ledger/src/loaders"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
)

func (harness *flowHarness) walletUserWithDailyLimit(depositMinor, basicLimitMinor int64) string {
	user := harness.newUser("NG")
	harness.verifyToLevelOne(user)
	harness.deposit(user, depositMinor)
	harness.runWorkers()
	settings := &harness.Payments.Application.Container.Settings
	settings.PaymentLimits = loaders.DefaultPaymentLimits()
	settings.PaymentLimits.Base.WalletDaily.Basic = basicLimitMinor
	return user
}

func (harness *flowHarness) fundAdsFromWallet(user, key string, amountMinor int64) paymentstesting.HarnessResponse {
	return harness.Call(http.MethodPost, "/api/v1/internal/ads/accounts/acct-"+user[:8]+"/earnings-fundings", "", key,
		map[string]any{"userId": user, "amount": map[string]any{"amountMinor": amountMinor, "currency": "NGN"}}, http.Header{"X-Internal-Token": {strings.Repeat("w", 32)}})
}

func (harness *flowHarness) boostFromWallet(user, key string, amountMinor int64) paymentstesting.HarnessResponse {
	return harness.Call(http.MethodPost, "/api/v1/internal/ads/boost-earnings-debits", "", "", map[string]any{
		"userId": user, "amount": map[string]any{"amountMinor": amountMinor, "currency": "NGN"}, "idempotencyKey": key,
	}, http.Header{"X-Internal-Token": {strings.Repeat("w", 32)}})
}

func TestAdsAndBoostsPaidFromTheWalletCountTowardTheDailyLimitWithPurchases(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.walletUserWithDailyLimit(900_000, 150_000)
	if funded := harness.fundAdsFromWallet(user, "limit-ads-0001", 100_000); funded.Status >= 300 {
		t.Fatalf("ads inside the limit: %d %s", funded.Status, funded.Raw)
	}
	seller := harness.newUser("NG")
	harness.verifyToLevelOne(seller)
	placed := harness.registerOrder(user, seller, 80_000, "NGN", "escrow")
	harness.initialize(user, &placed)
	refused := harness.payWithWallet(user, placed, "limit-pay-00001")
	details, _ := refused.Body["details"].(map[string]any)
	remaining, _ := details["remaining"].(map[string]any)
	if refused.Status != http.StatusUnprocessableEntity || refused.Body["code"] != "WALLET_DAILY_LIMIT" || remaining["amountMinor"] != float64(50_000) {
		t.Fatalf("ads spending must count toward the purchase limit: %d %s", refused.Status, refused.Raw)
	}
	if over := harness.fundAdsFromWallet(user, "limit-ads-0002", 50_001); over.Status != http.StatusUnprocessableEntity || over.Body["code"] != "WALLET_DAILY_LIMIT" {
		t.Fatalf("one kobo over the limit must be refused: %d %s", over.Status, over.Raw)
	}
	if boost := harness.boostFromWallet(user, "limit-boost-0001", 50_001); boost.Status != http.StatusUnprocessableEntity || boost.Body["code"] != "WALLET_DAILY_LIMIT" {
		t.Fatalf("a boost paid from the wallet is limited too: %d %s", boost.Status, boost.Raw)
	}
	if edge := harness.boostFromWallet(user, "limit-boost-0002", 50_000); edge.Status >= 300 {
		t.Fatalf("spending exactly up to the limit is allowed: %d %s", edge.Status, edge.Raw)
	}
	if after := harness.fundAdsFromWallet(user, "limit-ads-0003", 1); after.Status != http.StatusUnprocessableEntity {
		t.Fatalf("nothing more today: %d %s", after.Status, after.Raw)
	}
	harness.advance(24 * time.Hour)
	if paid := harness.payWithWallet(user, placed, "limit-pay-00002"); paid.Status != http.StatusOK {
		t.Fatalf("the limit resets the next day: %d %s", paid.Status, paid.Raw)
	}
	harness.runWorkers()
	harness.assertWalletMatchesProvider(user)
	harness.AssertLedgerHealthy()
}

func TestConcurrentWalletSpendsNeverPassTheDailyLimit(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.walletUserWithDailyLimit(900_000, 150_000)
	before := harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")) + harness.balance(ledgermodels.WalletDepositHoldAccount(user, "NGN"))
	results := make([]paymentstesting.HarnessResponse, 6)
	var group sync.WaitGroup
	for index := range results {
		group.Add(1)
		go func() {
			defer group.Done()
			if index%2 == 0 {
				results[index] = harness.fundAdsFromWallet(user, "limit-race-ads-"+itoa(int64(index)), 50_000)
			} else {
				results[index] = harness.boostFromWallet(user, "limit-race-boost-"+itoa(int64(index)), 50_000)
			}
		}()
	}
	group.Wait()
	accepted := 0
	for _, result := range results {
		switch {
		case result.Status < 300:
			accepted++
		case result.Body["code"] != "WALLET_DAILY_LIMIT":
			t.Fatalf("unexpected refusal: %d %s", result.Status, result.Raw)
		}
	}
	spent := before - harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")) - harness.balance(ledgermodels.WalletDepositHoldAccount(user, "NGN"))
	if accepted != 3 || spent != 150_000 {
		t.Fatalf("exactly the daily limit may be spent: accepted %d, spent %d", accepted, spent)
	}
}
