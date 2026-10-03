package payments

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/payments/src/modules/gateway/services"
)

func registerOrder(t *testing.T, harness *paymentstesting.MoneyHarness, buyer, seller string, amount int64) string {
	t.Helper()
	orderId := uuid.NewString()
	err := harness.Payments.Application.Gateway.RegisterCheckoutPayables(context.Background(), []models.OrderPayable{{
		CheckoutId: uuid.NewString(), OrderId: orderId, OrderReference: "ZM-" + orderId[:5], BuyerUserId: buyer, StoreId: "store-1", SellerUserId: seller,
		AmountMinor: amount, Currency: "NGN", PaymentMode: "escrow",
	}})
	if err != nil {
		t.Fatal(err)
	}
	return orderId
}

func TestCheckoutWaitsForActiveSellerCapabilitiesAndAVerifiedBuyerEmail(t *testing.T) {
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	buyer, seller := uuid.NewString(), uuid.NewString()
	orderId := registerOrder(t, harness, buyer, seller, 250_000)
	initialize := func(key string) paymentstesting.HarnessResponse {
		return harness.Call(http.MethodPost, "/api/v1/payments/initialize", harness.Tokens.UserAccessToken(buyer), key, map[string]any{"orderId": orderId})
	}
	if blocked := initialize("no-account"); blocked.Status != http.StatusConflict || blocked.Body["code"] != "SELLER_NOT_READY_FOR_PAYMENTS" {
		t.Fatalf("checkout before the seller has an account: %d %s", blocked.Status, blocked.Raw)
	}
	sellerToken := harness.Tokens.UserAccessToken(seller)
	created := harness.Call(http.MethodPost, "/api/v1/payments/connected-accounts/me", sellerToken, "", map[string]any{"acceptPayments": true})
	if created.Status != http.StatusCreated || created.Body["readyToAcceptPayments"] != false {
		t.Fatalf("connected account: %d %s", created.Status, created.Raw)
	}
	account, _ := harness.Payments.Application.Gateway.FindConnectedAccountForUser(context.Background(), harness.Database, seller)
	if !harness.Bachs.ManualSchedules[account.ProviderAccountID] {
		t.Fatal("the seller account must be put on a manual payout schedule so escrow stays locked")
	}
	if link := harness.Call(http.MethodPost, "/api/v1/payments/connected-accounts/me/onboarding-link", sellerToken, "", nil); link.Status != http.StatusCreated || link.Body["url"] == "" {
		t.Fatalf("onboarding link: %d %s", link.Status, link.Raw)
	}
	if stillBlocked := initialize("restricted-account"); stillBlocked.Status != http.StatusConflict {
		t.Fatalf("checkout while capabilities are restricted: %d", stillBlocked.Status)
	}
	harness.OnboardConnectedAccount(seller, true)
	harness.Directory.MarkUnverified(buyer)
	if unverified := initialize("unverified-buyer"); unverified.Status != http.StatusForbidden || unverified.Body["code"] != "VERIFY_EMAIL_REQUIRED" {
		t.Fatalf("unverified buyer: %d %s", unverified.Status, unverified.Raw)
	}
	harness.Directory.Unverified[buyer] = false
	started := initialize("verified-buyer")
	if started.Status != http.StatusCreated || started.Body["checkoutUrl"] == "" {
		t.Fatalf("checkout: %d %s", started.Status, started.Raw)
	}
	checkout := harness.Bachs.Checkouts[started.Body["reference"].(string)]
	if checkout.AccountId != account.ProviderAccountID || checkout.PlatformFeeMinor != 12_500 || checkout.CustomerEmail != "user-"+buyer[:8]+"@zudomart.test" {
		t.Fatalf("direct charge not created on the seller account with the platform fee and verified email: %+v", checkout)
	}
	if harness.Bachs.MissingIdempotency != 0 {
		t.Fatalf("%d mutations reached Bachs without an idempotency key", harness.Bachs.MissingIdempotency)
	}
}

func TestAProviderMirrorMismatchFreezesPayoutsUntilBalancesAgreeAgain(t *testing.T) {
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	seller := uuid.NewString()
	accountId := harness.OnboardConnectedAccount(seller, true)
	err := databases.RunInMoneyTransaction(context.Background(), harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{Reference: "seed-mirror-" + seller, Kind: "test.seed", Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.SellerProviderHeldFundsAccount(seller, "NGN"), Direction: ledgermodels.Debit, AmountMinor: 50_000},
			{Account: ledgermodels.SellerAvailableAccount(seller, "NGN"), Direction: ledgermodels.Credit, AmountMinor: 50_000},
		}})
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	harness.Bachs.DebitLostDispute(accountId, "NGN", -50_000)
	harness.AssertProviderMirrorMatches()
	harness.Bachs.DebitLostDispute(accountId, "NGN", 1_000)
	gateway := harness.Payments.Application.Gateway
	if mismatches, _ := gateway.ReconcileProviderHeldSellerFundsAgainstProviderBalances(context.Background()); mismatches != 1 {
		t.Fatalf("mismatches = %d", mismatches)
	}
	_, err = gateway.InitiateSellerPayout(context.Background(), models.SellerPayoutInstruction{Purpose: "withdrawal", SubjectId: uuid.NewString(), BeneficiaryUserId: seller, Reference: "zmwd_frozen", AmountMinor: 10_000, FeeMinor: 5_000, Currency: "NGN", BankCode: "058", AccountNumber: "0123456789"})
	if !errors.Is(err, services.ErrPayoutsFrozen) {
		t.Fatalf("payout while the mirror disagrees: %v", err)
	}
	harness.Bachs.DebitLostDispute(accountId, "NGN", -1_000)
	harness.AssertProviderMirrorMatches()
	if account, _ := gateway.FindConnectedAccountForUser(context.Background(), harness.Database, seller); account.PayoutsFrozen {
		t.Fatal("payouts stayed frozen after the balances agreed again")
	}
	harness.AssertLedgerHealthy()
}

func TestWebSubscriptionTrialIsWebOnlyAndDowngradesWhenPaymentRecoveryRunsOut(t *testing.T) {
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	owner := uuid.NewString()
	token := harness.Tokens.UserAccessToken(owner)
	if mobile := harness.Call(http.MethodPost, "/api/v1/payments/subscriptions/checkout", token, "", map[string]any{"planCode": "premium_web"}, http.Header{"X-Client-Platform": {"ios"}}); mobile.Status != http.StatusUnprocessableEntity {
		t.Fatalf("subscription started in the app: %d", mobile.Status)
	}
	if unknown := harness.Call(http.MethodPost, "/api/v1/payments/subscriptions/checkout", token, "", map[string]any{"planCode": "unknown"}); unknown.Status != http.StatusUnprocessableEntity {
		t.Fatalf("unknown plan: %d", unknown.Status)
	}
	started := harness.Call(http.MethodPost, "/api/v1/payments/subscriptions/checkout", token, "", map[string]any{"planCode": "premium_web"}, http.Header{"X-Client-Platform": {"web"}})
	if started.Status != http.StatusCreated || started.Body["checkoutUrl"] == "" {
		t.Fatalf("trial checkout: %d %s", started.Status, started.Raw)
	}
	reference := started.Body["reference"].(string)
	harness.DeliverBachsEvent("customer.subscription.created", "", map[string]any{"subscription_id": "sub_trial_1", "status": "trialing", "trial_end": "2030-01-14T00:00:00Z", "metadata": map[string]any{"billingSubscriptionReference": reference}})
	harness.DeliverBachsEvent("invoice.payment_failed", "", map[string]any{"invoice_id": "inv_1", "subscription": map[string]any{"subscription_id": "sub_trial_1"}, "status": "open"})
	harness.DeliverBachsEvent("customer.subscription.deleted", "", map[string]any{"subscription_id": "sub_trial_1", "status": "canceled"})
	var status string
	var downgraded bool
	schema := harness.Payments.Application.Container.Settings.Money.DatabaseSchema
	if err := harness.Database.QueryRow(`SELECT status, downgraded_at IS NOT NULL FROM "`+schema+`".billing_subscriptions WHERE reference = $1`, reference).Scan(&status, &downgraded); err != nil {
		t.Fatal(err)
	}
	var downgradeEvents int
	_ = harness.Database.QueryRow(`SELECT count(*) FROM "` + schema + `".outbox_events WHERE event_type = 'billingSubscription.downgraded'`).Scan(&downgradeEvents)
	if status != "canceled" || !downgraded || downgradeEvents != 1 {
		t.Fatalf("status %s downgraded %v events %d", status, downgraded, downgradeEvents)
	}
}
