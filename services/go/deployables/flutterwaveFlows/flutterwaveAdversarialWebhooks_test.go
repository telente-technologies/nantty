package flutterwaveflows

import (
	"context"
	"net/http"
	"sync"
	"testing"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/integrations"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
)

func TestForgedWebhookIsRejectedAndCreditsNothing(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.newUser("NG")
	harness.verifyToLevelOne(user)
	body, _ := harness.fake.FundWalletAndSignWebhook(harness.walletRef(user), 500_000, "PSA_FORGED1", 0)
	forged := harness.deliver(body, http.Header{integrations.FlutterwaveSignatureHeader: {"not-the-hash-not-the-hash-not-the-hash"}})
	missing := harness.deliver(body, http.Header{})
	if forged.Status != http.StatusUnauthorized || missing.Status != http.StatusUnauthorized {
		t.Fatalf("forged or unsigned webhooks must be 401: %d %d", forged.Status, missing.Status)
	}
	if hold := harness.balance(ledgermodels.WalletDepositHoldAccount(user, "NGN")); hold != 0 {
		t.Fatalf("a forged webhook credited %d", hold)
	}
}

func TestFundingWebhookReplayedConcurrentlyCreditsOnce(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.newUser("NG")
	harness.verifyToLevelOne(user)
	body, headers := harness.fake.FundWalletAndSignWebhook(harness.walletRef(user), 400_000, "PSA_REPLAY1", 0)
	var group sync.WaitGroup
	for range 8 {
		group.Add(1)
		go func() {
			defer group.Done()
			if response := harness.deliver(body, headers); response.Status != http.StatusOK {
				t.Errorf("delivery: %d %s", response.Status, response.Raw)
			}
		}()
	}
	group.Wait()
	harness.runWorkers()
	harness.assertWalletMatchesProvider(user)
	if harness.fake.Calls("POST /transfers") != 1 {
		t.Fatalf("the deposit fee must be swept exactly once, got %d transfers", harness.fake.Calls("POST /transfers"))
	}
}

func TestUnderpaidOrOverpaidDepositCreditsWhatTheStatementShows(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.newUser("NG")
	harness.verifyToLevelOne(user)
	body, headers := harness.fake.FundWalletAndSignWebhook(harness.walletRef(user), 300_000, "PSA_HINT1", 900_000)
	if response := harness.deliver(body, headers); response.Status != http.StatusOK {
		t.Fatalf("delivery: %d %s", response.Status, response.Raw)
	}
	harness.runWorkers()
	harness.assertWalletMatchesProvider(user)
	if paymentstesting.FakeFlutterwaveMerchantId == "" || harness.balance(ledgermodels.WalletDepositHoldAccount(user, "NGN")) >= 300_000 {
		t.Fatalf("the webhook amount must never decide the credit")
	}
}

func TestCardChargeWithWrongAmountCurrencyOrCustomerIsNotApplied(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, seller := harness.newUser("NG"), harness.newUser("NG")
	harness.verifyToLevelOne(seller)
	placed := harness.registerOrder(buyer, seller, 100_000, "NGN", "escrow")
	harness.initialize(buyer, &placed)
	transaction := harness.fake.CompleteCheckout(placed.reference, 10_000, 150, "card")
	body, headers := harness.fake.ChargeWebhook(transaction)
	harness.deliver(body, headers)
	intent, err := harness.Payments.Application.Container.Client(harness.Database).PaymentIntent.Query().Where(paymentintent.Reference(placed.reference)).Only(context.Background())
	if err != nil || intent.Status != paymentintent.StatusFailed {
		t.Fatalf("an underpaid charge must fail the payment: %+v %v", intent, err)
	}
	if count, _ := harness.escrow.Application.Container.Client(harness.Database).Escrow.Query().Count(context.Background()); count != 0 {
		t.Fatalf("no escrow may be created for a mismatched charge")
	}
}

func TestReusedChargeCannotPayASecondOrder(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, seller := harness.newUser("NG"), harness.newUser("NG")
	harness.verifyToLevelOne(seller)
	first := harness.registerOrder(buyer, seller, 100_000, "NGN", "escrow")
	harness.initialize(buyer, &first)
	harness.payByCard(first, 1_500)
	second := harness.registerOrder(buyer, seller, 100_000, "NGN", "escrow")
	harness.initialize(buyer, &second)
	paid := harness.fake.TransactionByReference(first.reference)
	body, headers := harness.fake.SignWebhook("charge.completed", map[string]any{"id": paid.Id, "tx_ref": second.reference, "amount": 1000, "currency": "NGN", "status": "successful"})
	harness.deliver(body, headers)
	intent, _ := harness.Payments.Application.Container.Client(harness.Database).PaymentIntent.Query().Where(paymentintent.Reference(second.reference)).Only(context.Background())
	if intent.Status == paymentintent.StatusSucceeded || intent.ProviderTransactionID != "" {
		t.Fatalf("another order's charge id must not settle this order: %+v", intent)
	}
	_, err := harness.Database.Exec(`UPDATE "`+harness.Payments.Application.Container.Settings.Money.DatabaseSchema+`".payment_intents SET provider_transaction_id = $1 WHERE reference = $2`, intent.ID.String()[:0]+itoa(paid.Id), second.reference)
	if err == nil {
		t.Fatal("the database must refuse a second intent with the same provider charge id")
	}
}
