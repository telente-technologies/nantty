package wallet

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/wallet/src/modules/adBalances/dtos"
)

func (harness *walletHarness) withdrawAdBalance(adAccountId, userId, key string, grossMinor, feeMinor int64) (int, map[string]any) {
	response := harness.Call(http.MethodPost, "/api/v1/internal/ads/accounts/"+adAccountId+"/withdrawals", "", "",
		map[string]any{"userId": userId, "currency": "NGN", "grossMinor": grossMinor, "feeMinor": feeMinor, "idempotencyKey": key}, internalHeaders)
	return response.Status, response.Body
}

func TestAdCreditLivesInItsOwnLedgerAccountAndOnlyRealBalanceIsWithdrawn(t *testing.T) {
	harness := startWalletHarness(t, false)
	user := uuid.NewString()
	harness.fundWithdrawableBalance(user, 100_000)
	adAccount := uuid.NewString()
	if funded := harness.fundAdsFromEarnings(user, adAccount, "credit-ledger-fund-1", 60_000); funded.Status != http.StatusCreated {
		t.Fatalf("seed ad balance: %d %s", funded.Status, funded.Raw)
	}
	prepaid, credit := ledgermodels.AdvertiserPrepaidBalanceAccount(adAccount, "NGN"), ledgermodels.AdvertiserAdCreditAccount(adAccount, "NGN")
	ctx := context.Background()
	issue := dtos.AdCreditChangeDto{EntryId: "creditLot:a", LotId: uuid.NewString(), AccountId: adAccount, UserId: user, Currency: "NGN", AmountMinor: 20_000, Kind: "issued", Source: "admin_issued", IdempotencyKey: "adCredit:creditLot:a"}
	for range 2 {
		if err := harness.wallet.AdBalances.ApplyAdCreditChange(ctx, issue); err != nil {
			t.Fatal(err)
		}
	}
	if harness.balance(credit) != 20_000 || harness.balance(prepaid) != 60_000 {
		t.Fatalf("issued credit goes to the credit account once, never to the real balance: %v", harness.NonZeroBalances())
	}
	harness.AssertLedgerHealthy()
	spend := map[string]any{"batchId": uuid.NewString(), "accountId": adAccount, "currency": "NGN", "debitMinor": 10_000, "creditDebitMinor": 5_000, "impressionCount": 3, "idempotencyKey": "credit-ledger-spend-1"}
	for range 2 {
		harness.Call(http.MethodPost, "/api/v1/internal/ads/spend-batches", "", "", spend, internalHeaders)
	}
	if harness.balance(prepaid) != 50_000 || harness.balance(credit) != 15_000 {
		t.Fatalf("spend splits real money and credit exactly once: %v", harness.NonZeroBalances())
	}
	harness.AssertLedgerHealthy()
	expire := dtos.AdCreditChangeDto{EntryId: "creditExpire:a", LotId: issue.LotId, AccountId: adAccount, UserId: user, Currency: "NGN", AmountMinor: -15_000, Kind: "expired", Source: "admin_issued", IdempotencyKey: "adCredit:creditExpire:a"}
	for range 2 {
		if err := harness.wallet.AdBalances.ApplyAdCreditChange(ctx, expire); err != nil {
			t.Fatal(err)
		}
	}
	if harness.balance(credit) != 0 || harness.balance(prepaid) != 50_000 {
		t.Fatalf("expiry removes the credit once and never the real balance: %v", harness.NonZeroBalances())
	}
	harness.AssertLedgerHealthy()

	if status, refused := harness.withdrawAdBalance(adAccount, user, "credit-ledger-wd-001", 50_001, 0); status != http.StatusUnprocessableEntity || refused["code"] != "WITHDRAWAL_ABOVE_AVAILABLE" {
		t.Fatalf("never more than the real ad balance: %d %v", status, refused)
	}
	status, first := harness.withdrawAdBalance(adAccount, user, "credit-ledger-wd-002", 30_000, 450)
	replayStatus, replay := harness.withdrawAdBalance(adAccount, user, "credit-ledger-wd-002", 30_000, 450)
	if status != http.StatusOK || replayStatus != http.StatusOK || replay["replayed"] != true || first["netMinor"].(float64) != 29_550 {
		t.Fatalf("one withdrawal per key: %d %v / %d %v", status, first, replayStatus, replay)
	}
	if status, reused := harness.withdrawAdBalance(adAccount, user, "credit-ledger-wd-002", 20_000, 300); status != http.StatusConflict || reused["code"] != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("a reused key with another amount: %d %v", status, reused)
	}
	harness.RunMoneyWorkers()
	if harness.balance(prepaid) != 20_000 || harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")) != 40_000+29_550 {
		t.Fatalf("the net lands in the wallet and the fee is kept once: %v", harness.NonZeroBalances())
	}
	harness.AssertLedgerHealthy()
	stranger := uuid.NewString()
	if status, refused := harness.withdrawAdBalance(adAccount, stranger, "credit-ledger-wd-003", 1_000, 0); status != http.StatusForbidden || refused["code"] != "VERIFICATION_REQUIRED" {
		t.Fatalf("an unverified user cannot withdraw: %d %v", status, refused)
	}
}
