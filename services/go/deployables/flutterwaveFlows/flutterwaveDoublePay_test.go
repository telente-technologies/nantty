package flutterwaveflows

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/outboxevent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/generated/ent/reconciliationcase"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
)

func (harness *flowHarness) spendable(userId string) int64 {
	return harness.balance(ledgermodels.WalletAvailableAccount(userId, "NGN")) + harness.balance(ledgermodels.WalletDepositHoldAccount(userId, "NGN"))
}

func (harness *flowHarness) paymentsClient() *ent.Client {
	return harness.Payments.Application.Container.Client(harness.Database)
}

func (harness *flowHarness) intentsFor(placed order) []*ent.PaymentIntent {
	harness.T.Helper()
	intents, err := harness.paymentsClient().PaymentIntent.Query().Where(paymentintent.SubjectID(placed.checkoutId)).All(context.Background())
	if err != nil {
		harness.T.Fatal(err)
	}
	return intents
}

func (harness *flowHarness) assertSettledExactlyOnce(placed order) (settled *ent.PaymentIntent, duplicates []*ent.PaymentIntent) {
	harness.T.Helper()
	for _, intent := range harness.intentsFor(placed) {
		if intent.Status != paymentintent.StatusSucceeded {
			continue
		}
		if strings.HasPrefix(intent.FailureReason, "duplicate") {
			duplicates = append(duplicates, intent)
			continue
		}
		if settled != nil {
			harness.T.Fatalf("checkout %s settled twice: %s and %s", placed.checkoutId, settled.Reference, intent.Reference)
		}
		settled = intent
	}
	if settled == nil {
		harness.T.Fatalf("checkout %s was never settled", placed.checkoutId)
	}
	return settled, duplicates
}

func (harness *flowHarness) paidBuyerAndOrder(walletDeposit int64) (string, order) {
	buyer, seller := harness.newUser("NG"), harness.newUser("NG")
	harness.verifyToLevelOne(buyer)
	harness.verifyToLevelOne(seller)
	harness.deposit(buyer, walletDeposit)
	harness.runWorkers()
	placed := harness.registerOrder(buyer, seller, 300_000, "NGN", "escrow")
	harness.initialize(buyer, &placed)
	return buyer, placed
}

func TestAuditCardChargeAfterWalletPaymentIsRefunded(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, placed := harness.paidBuyerAndOrder(1_000_000)
	before := harness.spendable(buyer)
	paid := harness.payWithWallet(buyer, placed, "pay-dbl-0001")
	if paid.Status != http.StatusOK {
		t.Fatalf("wallet payment: %d %s", paid.Status, paid.Raw)
	}
	transaction := harness.fake.CompleteCheckout(placed.reference, 0, 1_500, "card")
	if transaction == nil {
		t.Fatal("no hosted checkout was opened for the reference")
	}
	body, headers := harness.fake.ChargeWebhook(transaction)
	if response := harness.deliver(body, headers); response.Status != http.StatusOK {
		t.Fatalf("late card webhook: %d %s", response.Status, response.Raw)
	}
	harness.deliver(body, headers)
	harness.runWorkers()
	settled, duplicates := harness.assertSettledExactlyOnce(placed)
	if !strings.HasPrefix(settled.ProviderTransactionID, "wallet:") {
		t.Fatalf("the wallet payment must stay the settlement, got %s", settled.ProviderTransactionID)
	}
	if len(duplicates) != 1 || duplicates[0].ProviderTransactionID != itoa(transaction.Id) || duplicates[0].AmountMinor != 300_000 {
		t.Fatalf("the late card charge must be recorded once as a duplicate: %+v", duplicates)
	}
	if refunds := harness.fake.RefundAmountsMinor(); len(refunds) != 1 || refunds[0] != 300_000 {
		t.Fatalf("the card charge must be refunded once in full at Flutterwave, refunds %v", refunds)
	}
	if spent := before - harness.spendable(buyer); spent != 300_000 {
		t.Fatalf("the wallet must be charged exactly once, spent %d", spent)
	}
	ctx := context.Background()
	if cases, _ := harness.paymentsClient().ReconciliationCase.Query().Where(reconciliationcase.Kind("duplicateSettlement")).Count(ctx); cases != 1 {
		t.Fatalf("finance must get one duplicate-settlement case, got %d", cases)
	}
	if events, _ := harness.paymentsClient().OutboxEvent.Query().Where(outboxevent.EventType("payment.duplicateRefunded"), outboxevent.Subject(duplicates[0].ID.String())).Count(ctx); events != 1 {
		t.Fatalf("the buyer must be told once about the refund, events %d", events)
	}
}

func TestCardSettledFirstRefusesTheWalletPaymentWithoutDebitingIt(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, placed := harness.paidBuyerAndOrder(1_000_000)
	before := harness.spendable(buyer)
	harness.payByCard(placed, 1_500)
	paid := harness.payWithWallet(buyer, placed, "pay-dbl-0002")
	if paid.Status != http.StatusConflict || paid.Body["code"] != "ALREADY_PAID" {
		t.Fatalf("a wallet payment after the card settled must be refused: %d %s", paid.Status, paid.Raw)
	}
	harness.runWorkers()
	settled, duplicates := harness.assertSettledExactlyOnce(placed)
	if strings.HasPrefix(settled.ProviderTransactionID, "wallet:") || len(duplicates) != 0 {
		t.Fatalf("the card must be the only settlement: %s %+v", settled.ProviderTransactionID, duplicates)
	}
	if spent := before - harness.spendable(buyer); spent != 0 {
		t.Fatalf("the wallet must not be debited, spent %d", spent)
	}
}

func TestCardChargedButWebhookStillInFlightRefusesTheWalletPayment(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, placed := harness.paidBuyerAndOrder(1_000_000)
	before := harness.spendable(buyer)
	transaction := harness.fake.CompleteCheckout(placed.reference, 0, 1_500, "card")
	paid := harness.payWithWallet(buyer, placed, "pay-dbl-0003")
	if paid.Status != http.StatusConflict {
		t.Fatalf("the wallet must see the card charge already made: %d %s", paid.Status, paid.Raw)
	}
	body, headers := harness.fake.ChargeWebhook(transaction)
	harness.deliver(body, headers)
	harness.runWorkers()
	settled, duplicates := harness.assertSettledExactlyOnce(placed)
	if settled.ProviderTransactionID != itoa(transaction.Id) || len(duplicates) != 0 || len(harness.fake.RefundAmountsMinor()) != 0 {
		t.Fatalf("the card charge must settle once with nothing refunded: %s %+v", settled.ProviderTransactionID, duplicates)
	}
	if spent := before - harness.spendable(buyer); spent != 0 {
		t.Fatalf("the wallet must not be debited, spent %d", spent)
	}
}

func TestCardWebhookRacingTheWalletPaymentChargesTheBuyerOnce(t *testing.T) {
	for round := range 6 {
		harness := startFlowHarness(t)
		buyer, placed := harness.paidBuyerAndOrder(1_000_000)
		before := harness.spendable(buyer)
		var wallet, webhook paymentstesting.HarnessResponse
		var body []byte
		var headers http.Header
		var group sync.WaitGroup
		group.Add(2)
		go func() {
			defer group.Done()
			wallet = harness.payWithWallet(buyer, placed, "pay-race-"+itoa(int64(round)))
		}()
		go func() {
			defer group.Done()
			time.Sleep(time.Duration(round%3) * 20 * time.Millisecond)
			body, headers = harness.fake.ChargeWebhook(harness.fake.CompleteCheckout(placed.reference, 0, 1_500, "card"))
			webhook = harness.deliver(body, headers)
		}()
		group.Wait()
		harness.deliver(body, headers)
		harness.runWorkers()
		if webhook.Status != http.StatusOK || (wallet.Status != http.StatusOK && wallet.Status != http.StatusConflict) {
			t.Fatalf("round %d: webhook %d, wallet %d %s", round, webhook.Status, wallet.Status, wallet.Raw)
		}
		settled, duplicates := harness.assertSettledExactlyOnce(placed)
		t.Logf("round %d: settled by %s, wallet %d, duplicates %d", round, settled.ProviderTransactionID, wallet.Status, len(duplicates))
		var refunded int64
		for _, amount := range harness.fake.RefundAmountsMinor() {
			refunded += amount
		}
		walletSpent := before - harness.spendable(buyer)
		if charged := walletSpent + 300_000 - refunded; charged != 300_000 || refunded != int64(len(duplicates))*300_000 {
			t.Fatalf("round %d: buyer charged %d (wallet %d, card 300000, refunded %d, duplicates %d)", round, charged, walletSpent, refunded, len(duplicates))
		}
	}
}

func TestTheDatabaseRefusesASecondSettlementOfTheSameCheckout(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, placed := harness.paidBuyerAndOrder(1_000_000)
	harness.payByCard(placed, 1_500)
	second := harness.initializeAgainExpectingConflict(buyer, placed)
	if second.Status != http.StatusConflict {
		t.Fatalf("a paid checkout must not open another payment: %d %s", second.Status, second.Raw)
	}
	settled, _ := harness.assertSettledExactlyOnce(placed)
	table := pgx.Identifier{harness.Payments.Application.Container.Settings.Money.DatabaseSchema, "payment_intents"}.Sanitize()
	_, err := harness.Database.Exec(`INSERT INTO `+table+` (id, created_at, reference, purpose, owner_user_id, subject_id, provider, amount_minor, currency, status, provider_transaction_id, metadata, updated_at)
		SELECT gen_random_uuid(), now(), reference || '-forged', purpose, owner_user_id, subject_id, provider, amount_minor, currency, 'succeeded', 'forged-charge', metadata, now() FROM `+table+` WHERE id = $1`, settled.ID)
	var postgresError *pgconn.PgError
	if !errors.As(err, &postgresError) || postgresError.ConstraintName != "payment_intents_one_settlement_per_subject" {
		t.Fatalf("a second settled intent for the checkout must violate the unique index, got %v", err)
	}
}

func (harness *flowHarness) initializeAgainExpectingConflict(buyer string, placed order) paymentstesting.HarnessResponse {
	return harness.Call(http.MethodPost, "/api/v1/payments/initialize", harness.Tokens.UserAccessToken(buyer), "init-again-"+placed.orderId, map[string]any{"checkoutId": placed.checkoutId})
}
