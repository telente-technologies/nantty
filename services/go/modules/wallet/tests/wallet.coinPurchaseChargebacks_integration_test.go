package wallet_test

import (
	"context"
	"net/http"
	"testing"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/wallet/src/generated/ent/coinpurchase"
)

func notifyCoinPurchaseDispute(t *testing.T, harness *walletHarness, reference, disputeId, status string, amountMinor int64) {
	t.Helper()
	ctx := context.Background()
	purchase, err := harness.wallet.Coins.Container.Client(harness.Database).CoinPurchase.Query().Where(coinpurchase.Reference(reference)).Only(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if purchase.PaymentIntentID == nil {
		t.Fatalf("purchase %s has no card payment intent", reference)
	}
	intent, err := harness.Payments.Application.Container.Client(harness.Database).PaymentIntent.Get(ctx, *purchase.PaymentIntentID)
	if err != nil {
		t.Fatal(err)
	}
	dispute := interfaces.ProviderDispute{
		ProviderDisputeId: disputeId, ProviderChargeId: intent.ProviderTransactionID, ChargeReference: reference,
		AmountMinor: amountMinor, Currency: purchase.Currency, Status: status, Reason: "test dispute",
	}
	if err := harness.Payments.Application.Gateway.HandleProviderDisputeNotification(ctx, interfaces.WebhookNotification{
		Kind: interfaces.WebhookKindDispute, Dispute: &dispute,
	}); err != nil {
		t.Fatalf("record %s dispute %s: %v", status, disputeId, err)
	}
}

func startAndCompleteCoinPurchase(t *testing.T, harness *walletHarness, userId, idempotencyKey string) string {
	t.Helper()
	started := harness.Call(http.MethodPost, "/api/v1/coins/purchases", harness.Tokens.UserAccessToken(userId), idempotencyKey,
		map[string]any{"packageId": "web-coins-1"}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if started.Status != http.StatusCreated {
		t.Fatalf("start coin purchase: %d %s", started.Status, started.Raw)
	}
	reference := started.Body["reference"].(string)
	harness.CompleteCheckoutThroughWebhook(reference, 0, 2_000)
	return reference
}

func TestLostCoinPurchaseChargebacksAccumulateAndRecordSpentCoinDebt(t *testing.T) {
	harness := startWalletHarness(t, true)
	buyer, creator := "b9aa5eef-2516-49e9-a7df-2cf2b9cad8d0", "d787a983-4325-4d25-ae3d-e4de7f301e0e"
	reference := startAndCompleteCoinPurchase(t, harness, buyer, "coin-chargeback-buy")
	if balance := harness.balance(ledgermodels.UserSpendableCoinsAccount(buyer)); balance != 100 {
		t.Fatalf("coin purchase balance = %d; want 100", balance)
	}

	transfer := harness.Call(http.MethodPost, "/api/v1/coins/transfers", harness.Tokens.UserAccessToken(buyer), "spend-before-chargeback",
		map[string]any{"recipientUserId": creator, "coins": 80})
	if transfer.Status != http.StatusCreated {
		t.Fatalf("spend coins before chargeback: %d %s", transfer.Status, transfer.Raw)
	}
	creatorBalance := harness.balance(ledgermodels.UserSpendableCoinsAccount(creator))
	if creatorBalance != 60 {
		t.Fatalf("recipient balance after transfer = %d; want 60", creatorBalance)
	}
	harness.creditEarnedCoins(creator, 35)
	creatorGiftEarnings := harness.balance(ledgermodels.CreatorEarnedCoinsAccount(creator))

	client := harness.wallet.Coins.Container.Client(harness.Database)
	purchase, err := client.CoinPurchase.Query().Where(coinpurchase.Reference(reference)).Only(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	partial := purchase.AmountMinor / 4
	if partial <= 0 || partial*4 != purchase.AmountMinor {
		t.Fatalf("test package price %d cannot be split into exact partial disputes", purchase.AmountMinor)
	}

	// An open notice and its repeated delivery must not claw back any coins.
	notifyCoinPurchaseDispute(t, harness, reference, "chargeback-partial-1", "open", partial)
	notifyCoinPurchaseDispute(t, harness, reference, "chargeback-partial-1", "open", partial)
	if got := harness.balance(ledgermodels.UserSpendableCoinsAccount(buyer)); got != 20 {
		t.Fatalf("open dispute changed buyer coins: %d", got)
	}

	// The first loss removes the cumulative 25% share (25 coins) from what
	// remains, recording a 5-coin debt. Re-delivery is idempotent.
	notifyCoinPurchaseDispute(t, harness, reference, "chargeback-partial-1", "lost", partial)
	notifyCoinPurchaseDispute(t, harness, reference, "chargeback-partial-1", "lost", partial)
	if got := harness.balance(ledgermodels.UserSpendableCoinsAccount(buyer)); got != 0 {
		t.Fatalf("buyer spendable coins after first loss = %d; want 0", got)
	}
	if got := harness.balance(ledgermodels.UserCoinDebtAccount(buyer)); got != 5 {
		t.Fatalf("buyer coin debt after first loss = %d; want 5", got)
	}

	// A distinct partial dispute brings the cumulative chargeback to 50% and
	// removes only the additional 25 coins, never the original target twice.
	notifyCoinPurchaseDispute(t, harness, reference, "chargeback-partial-2", "lost", partial)
	if got := harness.balance(ledgermodels.UserCoinDebtAccount(buyer)); got != 30 {
		t.Fatalf("buyer coin debt after cumulative losses = %d; want 30", got)
	}
	if got := harness.balance(ledgermodels.UserSpendableCoinsAccount(creator)); got != creatorBalance {
		t.Fatalf("chargeback changed recipient/creator balance from %d to %d", creatorBalance, got)
	}
	if got := harness.balance(ledgermodels.CreatorEarnedCoinsAccount(creator)); got != creatorGiftEarnings {
		t.Fatalf("chargeback changed creator gift earnings from %d to %d", creatorGiftEarnings, got)
	}

	updated, err := client.CoinPurchase.Query().Where(coinpurchase.Reference(reference)).Only(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if updated.ReviewStatus != coinpurchase.ReviewStatusPendingReview || updated.ClawbackShortfallCoins != 30 {
		t.Fatalf("lost dispute must queue staff review and record total shortfall: status=%s shortfall=%d", updated.ReviewStatus, updated.ClawbackShortfallCoins)
	}
	if len(updated.ReviewFlags) != 1 || updated.ReviewFlags[0] != "coin_purchase_chargeback_lost" {
		t.Fatalf("lost dispute review flags = %v", updated.ReviewFlags)
	}
	var recordedDisputes int
	if err := harness.Database.QueryRow(`SELECT count(*) FROM "`+harness.wallet.Coins.Container.Settings.Money.DatabaseSchema+`".coin_purchase_chargebacks WHERE purchase_id = $1`, purchase.ID).Scan(&recordedDisputes); err != nil {
		t.Fatal(err)
	}
	if recordedDisputes != 2 {
		t.Fatalf("recorded %d partial chargebacks; want two unique dispute records", recordedDisputes)
	}
	harness.AssertLedgerHealthy()
}

func TestOpenAndWonCoinPurchaseDisputesDoNotClawBackCoins(t *testing.T) {
	harness := startWalletHarness(t, true)
	for _, status := range []string{"open", "won"} {
		buyer := "e1a31df1-7025-4cac-a251-" + map[string]string{"open": "0f5ab04a2a01", "won": "4dbfa45276a2"}[status]
		reference := startAndCompleteCoinPurchase(t, harness, buyer, "no-clawback-"+status)
		before := harness.balance(ledgermodels.UserSpendableCoinsAccount(buyer))
		notifyCoinPurchaseDispute(t, harness, reference, "no-clawback-"+status, status, 25_000)
		after := harness.balance(ledgermodels.UserSpendableCoinsAccount(buyer))
		debt := harness.balance(ledgermodels.UserCoinDebtAccount(buyer))
		purchase, err := harness.wallet.Coins.Container.Client(harness.Database).CoinPurchase.Query().Where(coinpurchase.Reference(reference)).Only(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if after != before || debt != 0 || purchase.ReviewStatus == coinpurchase.ReviewStatusPendingReview || len(purchase.ReviewFlags) != 0 {
			t.Fatalf("%s dispute changed wallet coins or review state: balance=%d->%d debt=%d status=%s flags=%v", status, before, after, debt, purchase.ReviewStatus, purchase.ReviewFlags)
		}
	}
	harness.AssertLedgerHealthy()
}
