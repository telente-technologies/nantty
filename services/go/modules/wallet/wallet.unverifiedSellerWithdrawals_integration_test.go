package wallet

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	moneytesting "zudomart/modules/ledger/src/databases/moneyTesting"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
)

func (harness *walletHarness) recordSale(sellerId string, amountMinor int64) {
	harness.T.Helper()
	orderId := uuid.NewString()
	if err := harness.Payments.Application.Gateway.RegisterCheckoutPayables(context.Background(), []paymentmodels.OrderPayable{{
		CheckoutId: uuid.NewString(), OrderId: orderId, OrderReference: "ZM-" + orderId[:5], BuyerUserId: uuid.NewString(), StoreId: "store-1",
		SellerUserId: sellerId, AmountMinor: amountMinor, Currency: "NGN", PaymentMode: "escrow",
	}}); err != nil {
		harness.T.Fatal(err)
	}
}

func TestUnverifiedSellersCannotWithdrawUntilBusinessVerificationPasses(t *testing.T) {
	harness := startWalletHarness(t, false)
	seller := uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(seller, 100_000)
	harness.recordSale(seller, 100_000)
	blocked := harness.withdraw(token, "unverified-withdraw-1", accountId, 50_000)
	if blocked.Status != http.StatusForbidden || blocked.Body["code"] != "SELLER_VERIFICATION_REQUIRED" {
		t.Fatalf("unverified seller withdrawal: %d %s", blocked.Status, blocked.Raw)
	}
	users := moneytesting.CreateEmptySchema(t, harness.Database, "users")
	harness.Payments.Application.Container.Settings.UsersSchema = users + "_missing"
	if failClosed := harness.withdraw(token, "unverified-withdraw-2", accountId, 50_000); failClosed.Status != http.StatusServiceUnavailable || failClosed.Body["code"] != "SELLER_VERIFICATION_UNAVAILABLE" {
		t.Fatalf("an unreadable verification status must refuse: %d %s", failClosed.Status, failClosed.Raw)
	}
	if _, err := harness.Database.Exec(`CREATE TABLE ` + pgx.Identifier{users, "profile_checkmarks"}.Sanitize() + ` (profile_id uuid, account_id uuid, color text, status text)`); err != nil {
		t.Fatal(err)
	}
	harness.Payments.Application.Container.Settings.UsersSchema = users
	if _, err := harness.Database.Exec(`INSERT INTO `+pgx.Identifier{users, "profile_checkmarks"}.Sanitize()+` VALUES ($1, $2, 'gold', 'suspended')`, uuid.New(), seller); err != nil {
		t.Fatal(err)
	}
	if stillBlocked := harness.withdraw(token, "unverified-withdraw-3", accountId, 50_000); stillBlocked.Status != http.StatusForbidden {
		t.Fatalf("a suspended checkmark is not verification: %d", stillBlocked.Status)
	}
	if err := harness.Payments.Application.Gateway.RecordSellerVerification(context.Background(), seller, "evt-approved", time.Now()); err != nil {
		t.Fatal(err)
	}
	if allowed := harness.withdraw(token, "verified-withdraw-1", accountId, 50_000); allowed.Status != http.StatusCreated {
		t.Fatalf("verified seller withdrawal: %d %s", allowed.Status, allowed.Raw)
	}
	creator := uuid.NewString()
	creatorToken, creatorAccount := harness.fundWithdrawableBalance(creator, 50_000)
	if creatorWithdrawal := harness.withdraw(creatorToken, "creator-withdraw-1", creatorAccount, 20_000); creatorWithdrawal.Status != http.StatusCreated {
		t.Fatalf("a non-seller must not need business verification: %d %s", creatorWithdrawal.Status, creatorWithdrawal.Raw)
	}
	harness.AssertLedgerHealthy()
}
