package escrow

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src"
	"zudomart/modules/escrow/src/configs"
	"zudomart/modules/ledger/src/databases"
	moneytesting "zudomart/modules/ledger/src/databases/moneyTesting"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
)

type escrowHarness struct {
	*paymentstesting.MoneyHarness
	escrow    *src.Module
	clock     time.Time
	onboarded map[string]string
}

func processingFeeFor(amountMinor int64) int64 { return amountMinor * 140 / 10_000 }

func (harness *escrowHarness) ensureSellerOnboarded(orderId string) string {
	harness.T.Helper()
	payables, err := harness.Payments.Application.Gateway.FindCheckoutPayablesForOrder(context.Background(), harness.Database, orderId)
	if err != nil {
		harness.T.Fatal(err)
	}
	subaccount := ""
	for _, payable := range payables {
		if _, done := harness.onboarded[payable.SellerUserId]; !done {
			harness.onboarded[payable.SellerUserId] = harness.OnboardConnectedAccount(payable.SellerUserId, true)
		}
		if payable.OrderId == orderId {
			subaccount = harness.onboarded[payable.SellerUserId]
		}
	}
	if subaccount == "" {
		harness.T.Fatalf("order %s has no payable", orderId)
	}
	return subaccount
}

func (harness *escrowHarness) initializePayment(buyer, orderId, key string) paymentstesting.HarnessResponse {
	harness.T.Helper()
	harness.ensureSellerOnboarded(orderId)
	return harness.Call(http.MethodPost, "/api/v1/payments/initialize", harness.Tokens.UserAccessToken(buyer), key, map[string]any{"orderId": orderId})
}

func (harness *escrowHarness) relayQueuedRefunds() {
	harness.T.Helper()
	if !outboxHas(harness.T, harness, "paymentRefund.requested") {
		harness.T.Fatal("refunds must be queued through the outbox")
	}
	harness.Payments.Application.Gateway.RetryPendingRefunds(context.Background(), 100)
}

func (harness *escrowHarness) deliverRefundProcessed(paymentReference string) {
	harness.T.Helper()
	harness.relayQueuedRefunds()
	body, headers, found := harness.Flutterwave.RefundWebhookForCharge(paymentReference, "completed")
	if !found {
		harness.T.Fatalf("no refund for %s", paymentReference)
	}
	if response := harness.DeliverWebhook(body, headers); response.Status != http.StatusOK {
		harness.T.Fatalf("refund webhook: %d %s", response.Status, response.Raw)
	}
}

func (harness *escrowHarness) paymentReferenceForOrder(orderId string) string {
	var reference string
	schema := harness.Payments.Application.Container.Settings.Money.DatabaseSchema
	if err := harness.Database.QueryRow(`SELECT reference FROM "`+schema+`".payment_intents WHERE subject_id IN ($1::text, (SELECT checkout_id FROM "`+schema+`".order_payables WHERE order_id = $1::text)) AND status = 'succeeded' ORDER BY created_at LIMIT 1`, orderId).Scan(&reference); err != nil {
		harness.T.Fatal(err)
	}
	return reference
}

func startEscrowHarness(t *testing.T) *escrowHarness {
	t.Helper()
	money := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	settings := configs.EscrowSettings{
		Money:                 moneytesting.MoneyModuleSettingsForTests("escrow", moneytesting.CreateEmptySchema(t, money.Database, "escrow"), money.LedgerSchema),
		PlatformCommissionBps: 150, InspectionPeriod: 72 * time.Hour, SellerResponseWindow: 48 * time.Hour, AutoReleaseSweepInterval: time.Hour,
		SellerCreditHoldPeriod: 24 * time.Hour, InternalApiToken: strings.Repeat("e", 32),
	}
	module, err := src.StartEscrowModuleWithSettings(context.Background(), settings, money.Dependencies, money.Overrides(), money.Payments.Application.Gateway)
	if err != nil {
		t.Fatal(err)
	}
	money.MountModule(module)
	money.Flutterwave.FundMainBalance("NGN", 10_000_000)
	harness := &escrowHarness{MoneyHarness: money, escrow: module, clock: time.Now(), onboarded: map[string]string{}}
	module.Application.Container.Now = func() time.Time { return harness.clock }
	return harness
}

func (harness *escrowHarness) registerCheckout(buyer string, orders map[string]int64) string {
	harness.T.Helper()
	return harness.registerCheckoutWithMode(buyer, orders, "escrow", false)
}

func (harness *escrowHarness) registerCheckoutWithMode(buyer string, orders map[string]int64, mode string, storeVerified bool) string {
	harness.T.Helper()
	checkoutId := uuid.NewString()
	var payables []paymentmodels.OrderPayable
	for orderId, amount := range orders {
		payables = append(payables, paymentmodels.OrderPayable{
			CheckoutId: checkoutId, OrderId: orderId, OrderReference: "ZM-" + orderId[:5], BuyerUserId: buyer, StoreId: "store-" + orderId[:4],
			SellerUserId: sellerForOrder(orderId), AmountMinor: amount, Currency: "NGN", ProductSummary: "Ankara dress", PaymentMode: mode, StoreVerified: storeVerified,
		})
	}
	if storeVerified {
		for _, payable := range payables {
			if err := harness.Payments.Application.Gateway.RecordSellerVerification(context.Background(), payable.SellerUserId, "test", time.Now()); err != nil {
				harness.T.Fatal(err)
			}
		}
	}
	if err := harness.Payments.Application.Gateway.RegisterCheckoutPayables(context.Background(), payables); err != nil {
		harness.T.Fatal(err)
	}
	return checkoutId
}

func (harness *escrowHarness) payCheckoutThroughWebhook(buyer, orderId string, providerAmount int64) string {
	harness.T.Helper()
	initialized := harness.initializePayment(buyer, orderId, "init-"+orderId)
	if initialized.Status != http.StatusCreated {
		harness.T.Fatalf("initialize: %d %s", initialized.Status, initialized.Raw)
	}
	reference := initialized.Body["reference"].(string)
	amount := int64(initialized.Body["payment"].(map[string]any)["amount"].(map[string]any)["amountMinor"].(float64))
	harness.SetCountry(buyer, "NG")
	harness.CompleteCheckoutThroughWebhook(reference, providerAmount, processingFeeFor(amount))
	return reference
}

func (harness *escrowHarness) payAndSettle(buyer, orderId string) string {
	harness.T.Helper()
	reference := harness.payCheckoutThroughWebhook(buyer, orderId, 0)
	harness.SettleCardPayments("NGN")
	return reference
}

func (harness *escrowHarness) balance(account ledgermodels.AccountRef) int64 {
	balance, err := harness.Ledger.ReadAccountBalance(context.Background(), harness.Database, account)
	if err != nil {
		harness.T.Fatal(err)
	}
	return balance
}

func mustRunInTransaction(t *testing.T, database *sql.DB, work func(ctx context.Context, transaction *sql.Tx) error) {
	t.Helper()
	if err := databases.RunInMoneyTransaction(context.Background(), database, work); err != nil {
		t.Fatal(err)
	}
}

func outboxHas(t *testing.T, harness *escrowHarness, eventType string) bool {
	var count int
	schema := harness.Payments.Application.Container.Settings.Money.DatabaseSchema
	_ = harness.Database.QueryRow(`SELECT count(*) FROM "`+schema+`".outbox_events WHERE event_type = $1`, eventType).Scan(&count)
	return count > 0
}

func contains(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

type HarnessReference struct{ reference string }

func escrowIdForOrder(t *testing.T, harness *escrowHarness, orderId string) string {
	view := harness.Call(http.MethodGet, "/api/v1/admin/orders/"+orderId+"/escrow", harness.Tokens.StaffTokens(uuid.NewString(), "money.disputes.resolve").AccessToken, "", nil)
	identifier, _ := view.Body["escrowId"].(string)
	if identifier == "" {
		t.Fatalf("escrow lookup: %d %s", view.Status, view.Raw)
	}
	return identifier
}

func sellerForOrder(orderId string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte("seller:"+orderId)).String()
}
