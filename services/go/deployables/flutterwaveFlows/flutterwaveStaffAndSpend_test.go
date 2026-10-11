package flutterwaveflows

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"testing"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
)

func TestDeadLetteredFundingIsInspectedRedactedAndReplayedByStaffWithStepUp(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.newUser("NG")
	harness.verifyToLevelOne(user)
	wallet, _ := harness.gateway.FindProviderWallet(context.Background(), harness.Database, user)
	body, headers := harness.fake.SignWebhook("transfer.completed", map[string]any{
		"id": 991, "account_number": wallet.Nuban, "currency": "NGN", "debit_currency": "PSA", "amount": "2,500.00", "status": "SUCCESSFUL",
		"reference": "PSA_LATE1", "narration": "WALLET FUNDING", "fullname": "Temitope Adeyemi",
	})
	if response := harness.deliver(body, headers); response.Status == http.StatusOK {
		t.Fatalf("a funding missing from the statement must not be acknowledged as processed: %s", response.Raw)
	}
	schema := harness.Payments.Application.Container.Settings.Money.DatabaseSchema
	if _, err := harness.Database.Exec(`UPDATE "` + schema + `".webhook_events SET dead_lettered_at = now(), attempt_count = 12 WHERE reference = 'PSA_LATE1'`); err != nil {
		t.Fatal(err)
	}
	reader := harness.Tokens.StaffTokens("staff-reader", "payments:webhooks")
	outsider := harness.Tokens.StaffTokens("staff-outsider", "ledger:read")
	if denied := harness.Call(http.MethodGet, "/api/v1/admin/payments/webhooks/dead-letters", outsider.AccessToken, "", nil); denied.Status != http.StatusForbidden {
		t.Fatalf("listing needs payments:webhooks: %d", denied.Status)
	}
	listed := harness.Call(http.MethodGet, "/api/v1/admin/payments/webhooks/dead-letters?provider=flutterwave", reader.AccessToken, "", nil)
	items, _ := listed.Body["items"].([]any)
	if listed.Status != http.StatusOK || len(items) != 1 {
		t.Fatalf("dead letters: %d %s", listed.Status, listed.Raw)
	}
	id := items[0].(map[string]any)["id"].(string)
	detail := harness.Call(http.MethodGet, "/api/v1/admin/payments/webhooks/dead-letters/"+id, reader.AccessToken, "", nil)
	if detail.Status != http.StatusOK || strings.Contains(string(detail.Raw), wallet.Nuban) || strings.Contains(string(detail.Raw), "Temitope") {
		t.Fatalf("the payload must be shown with account numbers and names redacted: %s", detail.Raw)
	}
	harness.fake.FundWalletAndSignWebhook(wallet.AccountRef, 250_000, "PSA_LATE1", 0)
	reason := map[string]any{"reason": "statement caught up; replaying"}
	if noStepUp := harness.Call(http.MethodPost, "/api/v1/admin/payments/webhooks/dead-letters/"+id+"/replay", reader.AccessToken, "", reason); noStepUp.Status != http.StatusForbidden {
		t.Fatalf("replay needs step-up: %d %s", noStepUp.Status, noStepUp.Raw)
	}
	replayed := harness.Call(http.MethodPost, "/api/v1/admin/payments/webhooks/dead-letters/"+id+"/replay", reader.AccessToken, "", reason, reader.StepUp())
	if replayed.Status != http.StatusOK || replayed.Body["processedAt"] == nil {
		t.Fatalf("replay: %d %s", replayed.Status, replayed.Raw)
	}
	harness.runWorkers()
	harness.assertWalletMatchesProvider(user)
	if again := harness.Call(http.MethodPost, "/api/v1/admin/payments/webhooks/dead-letters/"+id+"/replay", reader.AccessToken, "", reason, reader.StepUp()); again.Status != http.StatusNotFound {
		t.Fatalf("a processed webhook cannot be replayed twice: %d", again.Status)
	}
}

func TestBvnWhoseNameDoesNotMatchStaysBelowLevelOneAndGetsNoWallet(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.newUser("NG")
	harness.fake.BankAccountNames["058:"+testAccountNumber(user)] = "CHUKWUEMEKA OBI"
	harness.verifyToLevelOneExpectingRejection(user)
	if _, err := harness.gateway.FindProviderWallet(context.Background(), harness.Database, user); err == nil {
		t.Fatal("no wallet may be created when the bank account name does not match")
	}
}

func TestAdsFundedFromTheWalletMoveFromThePsaToTheMainBalance(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.newUser("NG")
	harness.verifyToLevelOne(user)
	harness.deposit(user, 800_000)
	harness.runWorkers()
	before := harness.fake.MainBalanceOf("NGN")
	funded := harness.Call(http.MethodPost, "/api/v1/internal/ads/accounts/acct-"+user[:8]+"/earnings-fundings", "", "ads-fund-0001",
		map[string]any{"userId": user, "amount": map[string]any{"amountMinor": 300_000, "currency": "NGN"}}, http.Header{"X-Internal-Token": {strings.Repeat("w", 32)}})
	if funded.Status >= 300 {
		t.Fatalf("ads funding: %d %s", funded.Status, funded.Raw)
	}
	harness.runWorkers()
	if moved := harness.fake.MainBalanceOf("NGN") - before; moved != 300_000 {
		t.Fatalf("ad funding must move from the PSA to main, moved %d", moved)
	}
	if prepaid := harness.balance(ledgermodels.AdvertiserPrepaidBalanceAccount("acct-"+user[:8], "NGN")); prepaid != 300_000 {
		t.Fatalf("prepaid ad credit %d", prepaid)
	}
	harness.assertWalletMatchesProvider(user)
}

func TestCoinsPaidFromTheWalletAreCreditedOnceAndTheMoneyMovesToMain(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.newUser("NG")
	harness.verifyToLevelOne(user)
	harness.deposit(user, 900_000)
	harness.runWorkers()
	token := harness.Tokens.UserAccessToken(user)
	started := harness.Call(http.MethodPost, "/api/v1/coins/purchases", token, "coins-wallet-01", map[string]any{"packageId": "web-coins-1"})
	if started.Status != http.StatusCreated {
		t.Fatalf("start coin purchase: %d %s", started.Status, started.Raw)
	}
	reference := started.Body["reference"].(string)
	before := harness.fake.MainBalanceOf("NGN")
	paid := harness.Call(http.MethodPost, "/api/v1/payments/wallet-payments/"+reference, token, "coins-pay-0001", nil)
	again := harness.Call(http.MethodPost, "/api/v1/payments/wallet-payments/"+reference, token, "coins-pay-0002", nil)
	if paid.Status != http.StatusOK || again.Status != http.StatusConflict {
		t.Fatalf("pay once, refuse twice: %d %s / %d %s", paid.Status, paid.Raw, again.Status, again.Raw)
	}
	harness.runWorkers()
	amount := int64(paid.Body["amount"].(map[string]any)["amountMinor"].(float64))
	if moved := harness.fake.MainBalanceOf("NGN") - before; moved != amount {
		t.Fatalf("the coin price must move from the PSA to main: moved %d, want %d", moved, amount)
	}
	if awaiting := harness.balance(ledgermodels.PaymentsAwaitingApplicationAccount("NGN")); awaiting != 0 {
		t.Fatalf("nothing may be left awaiting application: %d", awaiting)
	}
	harness.assertWalletMatchesProvider(user)
	availableBefore := harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN"))
	ctx := context.Background()
	intent, err := harness.gateway.Container.Client(harness.Database).PaymentIntent.Query().Where(paymentintent.Reference(reference)).Only(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := databases.RunInMoneyTransaction(ctx, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.gateway.RequestRefundInTransaction(ctx, transaction, paymentmodels.RefundRequest{
			PaymentIntentId: intent.ID, AmountMinor: amount, Currency: "NGN", Reference: "coins-wallet-refund-1", Reason: "smoke reversal",
		})
		return err
	}); err != nil {
		t.Fatal(err)
	}
	harness.gateway.RetryPendingRefunds(ctx, 10)
	harness.runWorkers()
	if len(harness.fake.Refunds) != 0 {
		t.Fatalf("a wallet-paid purchase must never be refunded to a card: %v", harness.fake.Refunds)
	}
	if got := harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")) - availableBefore; got != amount {
		t.Fatalf("the refund must come back into the wallet: got %d, want %d", got, amount)
	}
	harness.assertWalletMatchesProvider(user)
	harness.AssertLedgerHealthy()
}
