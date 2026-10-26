package payments

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/constants"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/modules/gateway/models"
	gatewayservices "nantty/modules/payments/src/modules/gateway/services"
)

func TestAConcurrentCheckoutOpenReturnsRetryInsteadOfOpeningASecondProviderSession(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	owner := uuid.NewString()
	var intent models.PaymentIntentView
	err := databases.RunInMoneyTransaction(context.Background(), harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var createErr error
		intent, createErr = harness.Payments.Application.Gateway.CreatePendingPaymentIntentInTransaction(ctx, transaction, models.CreatePaymentIntentRequest{
			Purpose: constants.PurposeCoinPurchase, OwnerUserId: owner, SubjectId: uuid.NewString(), AmountMinor: 100_000, Currency: "NGN",
		})
		return createErr
	})
	if err != nil {
		t.Fatal(err)
	}

	lockKey := "open-checkout:" + intent.Id.String()
	connection, err := harness.Database.Conn(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	var locked bool
	if err := connection.QueryRowContext(context.Background(), "SELECT pg_try_advisory_lock(hashtextextended($1, 0))", lockKey).Scan(&locked); err != nil || !locked {
		t.Fatalf("take the open-checkout lock: %v (locked=%v)", err, locked)
	}

	if _, err := harness.Payments.Application.Gateway.OpenProviderCheckoutForIntent(context.Background(), intent.Id); !errors.Is(err, gatewayservices.ErrCheckoutOpening) {
		t.Fatalf("a concurrent open must be asked to retry, got %v", err)
	}
	if calls := harness.Flutterwave.CallCounts["POST /payments"]; calls != 0 {
		t.Fatalf("the blocked request must not call the provider: %d", calls)
	}

	if _, err := connection.ExecContext(context.Background(), "SELECT pg_advisory_unlock(hashtextextended($1, 0))", lockKey); err != nil {
		t.Fatal(err)
	}
	opened, err := harness.Payments.Application.Gateway.OpenProviderCheckoutForIntent(context.Background(), intent.Id)
	if err != nil || opened.CheckoutUrl == nil || *opened.CheckoutUrl == "" {
		t.Fatalf("the lock holder opens one checkout: %v %+v", err, opened)
	}
	if calls := harness.Flutterwave.CallCounts["POST /payments"]; calls != 1 {
		t.Fatalf("exactly one provider session is opened: %d", calls)
	}
}
