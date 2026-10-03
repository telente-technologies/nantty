package escrow

import (
	"context"
	"database/sql"
	"net/http"
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
	escrow *src.Module
	clock  time.Time
}

func startEscrowHarness(t *testing.T) *escrowHarness {
	t.Helper()
	money := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	settings := configs.EscrowSettings{
		Money:                 moneytesting.MoneyModuleSettingsForTests("escrow", moneytesting.CreateEmptySchema(t, money.Database, "escrow"), money.LedgerSchema),
		PlatformCommissionBps: 500, InspectionPeriod: 72 * time.Hour, SellerResponseWindow: 48 * time.Hour, AutoReleaseSweepInterval: time.Hour,
		SellerCreditHoldPeriod: 24 * time.Hour,
	}
	module, err := src.StartEscrowModuleWithSettings(context.Background(), settings, money.Dependencies, money.Overrides(), money.Payments.Application.Gateway)
	if err != nil {
		t.Fatal(err)
	}
	money.MountModule(module)
	harness := &escrowHarness{MoneyHarness: money, escrow: module, clock: time.Now()}
	module.Application.Container.Now = func() time.Time { return harness.clock }
	module.Application.Container.Sellers.Now = func() time.Time { return harness.clock }
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
			SellerUserId: "seller-" + orderId[:4], AmountMinor: amount, Currency: "NGN", ProductSummary: "Ankara dress", PaymentMode: mode, StoreVerified: storeVerified,
		})
	}
	if err := harness.Payments.Application.Gateway.RegisterCheckoutPayables(context.Background(), payables); err != nil {
		harness.T.Fatal(err)
	}
	return checkoutId
}

func (harness *escrowHarness) payCheckoutThroughWebhook(buyer, orderId string, providerAmount int64) string {
	harness.T.Helper()
	initialized := harness.Call(http.MethodPost, "/api/v1/payments/initialize", harness.Tokens.UserAccessToken(buyer), "init-"+orderId, map[string]any{"orderId": orderId, "provider": "paystack"})
	if initialized.Status != http.StatusCreated {
		harness.T.Fatalf("initialize: %d %s", initialized.Status, initialized.Raw)
	}
	reference := initialized.Body["reference"].(string)
	harness.Paystack.MarkChargeAs(reference, "success", providerAmount, 150)
	body, headers := paymentstesting.SignedPaystackWebhook("charge.success", map[string]any{"id": harness.Paystack.ChargeId(reference), "reference": reference})
	if response := harness.Call(http.MethodPost, "/api/v1/payments/webhooks/paystack", "", "", body, headers); response.Status != http.StatusOK {
		harness.T.Fatalf("webhook: %d %s", response.Status, response.Raw)
	}
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
