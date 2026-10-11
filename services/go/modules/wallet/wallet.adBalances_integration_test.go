package wallet

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	sellerbalances "zudomart/modules/ledger/src/modules/sellerBalances/services"
)

func TestPrepaidAdBalanceIsFundedByCardAndDebitedBySpendAndBoosts(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	harness := startWalletHarness(t, true)
	advertiser := uuid.NewString()
	token := harness.Tokens.UserAccessToken(advertiser)
	adAccount := "ads-" + advertiser[:8]
	started := harness.Call(http.MethodPost, "/api/v1/ads/balance/top-ups", token, "top-up-key-1", map[string]any{"adAccountId": adAccount, "amount": map[string]any{"amountMinor": 500_000, "currency": "NGN"}})
	if started.Status != http.StatusCreated || started.Body["checkoutUrl"] == nil {
		t.Fatalf("top-up: %d %s", started.Status, started.Raw)
	}
	harness.CompleteCheckoutThroughWebhook(started.Body["reference"].(string), 0, 7_500)
	prepaid := ledgermodels.AdvertiserPrepaidBalanceAccount(adAccount, "NGN")
	if harness.balance(prepaid) != 500_000 {
		t.Fatalf("prepaid balance = %d", harness.balance(prepaid))
	}
	internal := http.Header{"X-Internal-Token": {strings.Repeat("w", 32)}}
	batch := map[string]any{"batchId": uuid.NewString(), "accountId": adAccount, "currency": "NGN", "debitMinor": 120_000, "impressionCount": 400, "idempotencyKey": "spend-batch-0001"}
	first := harness.Call(http.MethodPost, "/api/v1/internal/ads/spend-batches", "", "", batch, internal)
	replay := harness.Call(http.MethodPost, "/api/v1/internal/ads/spend-batches", "", "", batch, internal)
	if first.Body["debitedMinor"].(float64) != 120_000 || replay.Body["replayed"] != true || harness.balance(prepaid) != 380_000 || harness.balance(ledgermodels.PlatformAdRevenueAccount("NGN")) != 120_000 {
		t.Fatalf("spend: %s / %s balance %d", first.Raw, replay.Raw, harness.balance(prepaid))
	}
	overspend := map[string]any{"batchId": uuid.NewString(), "accountId": adAccount, "currency": "NGN", "debitMinor": 400_000, "idempotencyKey": "spend-batch-0002"}
	if over := harness.Call(http.MethodPost, "/api/v1/internal/ads/spend-batches", "", "", overspend, internal); over.Body["debitedMinor"].(float64) != 380_000 || over.Body["shortfallMinor"].(float64) != 20_000 {
		t.Fatalf("overspend: %s", over.Raw)
	}
	if forged := harness.Call(http.MethodPost, "/api/v1/internal/ads/spend-batches", "", "", batch); forged.Status != http.StatusUnauthorized {
		t.Fatalf("spend without the internal token: %d", forged.Status)
	}
	booster := uuid.NewString()
	boost := map[string]any{"userId": booster, "amount": map[string]any{"amountMinor": 100_000, "currency": "NGN"}, "idempotencyKey": "boost-key-0001"}
	if poor := harness.Call(http.MethodPost, "/api/v1/internal/ads/boost-debits", "", "", boost, internal); poor.Status != http.StatusConflict || poor.Body["code"] != "INSUFFICIENT_FUNDS" {
		t.Fatalf("boost without funds: %d %s", poor.Status, poor.Raw)
	}
	boostTopUp := harness.Call(http.MethodPost, "/api/v1/ads/balance/top-ups", harness.Tokens.UserAccessToken(booster), "boost-top-up", map[string]any{"adAccountId": "user-" + booster, "amount": map[string]any{"amountMinor": 300_000, "currency": "NGN"}})
	harness.CompleteCheckoutThroughWebhook(boostTopUp.Body["reference"].(string), 0, 4_500)
	if debit := harness.Call(http.MethodPost, "/api/v1/internal/ads/boost-debits", "", "", boost, internal); debit.Status != http.StatusOK || debit.Body["balanceAfter"].(map[string]any)["amountMinor"].(float64) != 200_000 {
		t.Fatalf("boost debit: %d %s", debit.Status, debit.Raw)
	}
	refund := map[string]any{"userId": booster, "amount": map[string]any{"amountMinor": 150_000, "currency": "NGN"}, "idempotencyKey": "refund-boost-key-0001", "debitIdempotencyKey": "boost-key-0001"}
	if tooMuch := harness.Call(http.MethodPost, "/api/v1/internal/ads/boost-refunds", "", "", refund, internal); tooMuch.Status != http.StatusUnprocessableEntity {
		t.Fatalf("refund above the debit: %d", tooMuch.Status)
	}
	refund["amount"] = map[string]any{"amountMinor": 40_000, "currency": "NGN"}
	if returned := harness.Call(http.MethodPost, "/api/v1/internal/ads/boost-refunds", "", "", refund, internal); returned.Body["balanceAfter"].(map[string]any)["amountMinor"].(float64) != 240_000 {
		t.Fatalf("boost refund: %s", returned.Raw)
	}
	unused := harness.Call(http.MethodPost, "/api/v1/ads/balance/refund", harness.Tokens.UserAccessToken(booster), "", map[string]any{"adAccountId": "user-" + booster})
	if unused.Status != http.StatusAccepted || unused.Body["refunded"].(map[string]any)["amountMinor"].(float64) != 240_000 {
		t.Fatalf("unused balance refund: %d %s", unused.Status, unused.Raw)
	}
	harness.AssertLedgerHealthy()
}

func TestFlaggedSellersKeepTheReservePercentageLockedWhenCreditsMature(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	harness := startWalletHarness(t, true)
	seller := uuid.NewString()
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.withdrawals.process", "money.withdrawals.read")
	stepUp := staff.StepUp
	flagged := harness.Call(http.MethodPut, "/api/v1/admin/wallet/seller-reserves/"+seller, staff.AccessToken, "", map[string]any{"reason": "High chargeback rate", "reserveBps": 1000, "holdDays": 30}, stepUp())
	if flagged.Status != http.StatusCreated {
		t.Fatalf("flag: %d %s", flagged.Status, flagged.Raw)
	}
	harness.post(ledgermodels.JournalEntryRequest{Reference: "seed-release-" + seller, Kind: "test.release", Lines: []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.PlatformProviderBalanceAccount("flutterwave", "NGN"), Direction: ledgermodels.Debit, AmountMinor: 200_000},
		{Account: ledgermodels.SellerPendingAccount(seller, "NGN"), Direction: ledgermodels.Credit, AmountMinor: 200_000},
	}})
	balances := sellerbalances.NewSellerBalancesInSchema(harness.LedgerSchema)
	mustRun := func(work func(context.Context) error) {
		t.Helper()
		if err := work(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	mustRun(func(ctx context.Context) error {
		transaction, err := harness.Database.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if err := balances.ScheduleLockedCreditInTransaction(ctx, transaction, sellerbalances.LockedSellerCredit{SellerUserId: seller, Currency: "NGN", AmountMinor: 200_000, SourceReference: "order-credit:" + seller, AvailableAt: time.Now().Add(-time.Minute)}); err != nil {
			return err
		}
		return transaction.Commit()
	})
	if matured, err := balances.MatureDueCredits(context.Background(), harness.Database, 10); err != nil || matured != 1 {
		t.Fatalf("matured %d %v", matured, err)
	}
	if harness.balance(ledgermodels.SellerAvailableAccount(seller, "NGN")) != 180_000 || harness.balance(ledgermodels.SellerPendingAccount(seller, "NGN")) != 20_000 {
		t.Fatal("a flagged seller must keep 10% locked as a reserve")
	}
	balances.Now = func() time.Time { return time.Now().Add(31 * 24 * time.Hour) }
	if matured, _ := balances.MatureDueCredits(context.Background(), harness.Database, 10); matured != 1 || harness.balance(ledgermodels.SellerAvailableAccount(seller, "NGN")) != 200_000 {
		t.Fatal("the reserve must be released after the hold")
	}
	harness.AssertLedgerHealthy()
}
