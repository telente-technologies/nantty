package payments

import (
	"context"
	"database/sql"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/constants"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	"zudomart/modules/payments/src/modules/gateway/models"
)

func TestPaymentStatusIsReadableByItsOwnerOnlyWithoutProviderLinks(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	owner := uuid.NewString()
	harness.OnboardConnectedAccount(owner, false)
	var intent models.PaymentIntentView
	err := databases.RunInMoneyTransaction(context.Background(), harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		intent, err = harness.Payments.Application.Gateway.CreatePendingPaymentIntentInTransaction(ctx, transaction, models.CreatePaymentIntentRequest{
			Purpose: constants.PurposeCoinPurchase, OwnerUserId: owner, SubjectId: uuid.NewString(), AmountMinor: 100_000, Currency: "NGN",
		})
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	path := "/api/v1/payments/" + intent.Reference
	mine := harness.Call(http.MethodGet, path, harness.Tokens.UserAccessToken(owner), "", nil)
	if mine.Status != http.StatusOK || mine.Body["status"] != "pending" || mine.Body["purpose"] != constants.PurposeCoinPurchase || mine.Body["amount"].(map[string]any)["amountMinor"].(float64) != 100_000 {
		t.Fatalf("the owner reads status, purpose and amount: %d %s", mine.Status, mine.Raw)
	}
	if mine.Body["checkoutUrl"] != nil || mine.Body["authorizationUrl"] != nil {
		t.Fatalf("the status endpoint never hands out provider links: %s", mine.Raw)
	}
	if stranger := harness.Call(http.MethodGet, path, harness.Tokens.UserAccessToken(uuid.NewString()), "", nil); stranger.Status != http.StatusNotFound {
		t.Fatalf("another user must not see the payment: %d", stranger.Status)
	}
	if anonymous := harness.Call(http.MethodGet, path, "", "", nil); anonymous.Status != http.StatusUnauthorized {
		t.Fatalf("the status needs a signed-in owner: %d", anonymous.Status)
	}
}
