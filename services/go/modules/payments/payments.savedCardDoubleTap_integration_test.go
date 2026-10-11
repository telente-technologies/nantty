package payments

import (
	"context"
	"database/sql"
	"net/http"
	"sync"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	"zudomart/modules/payments/src/modules/gateway/models"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
)

func TestSavedCardDoubleTapChargesTheCardOnce(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	gateway := harness.Payments.Application.Gateway
	buyer := uuid.NewString()
	token := harness.Tokens.UserAccessToken(buyer)
	started := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups", token, "", map[string]any{})
	setupReference := started.Body["reference"].(string)
	harness.PayCheckout(setupReference, 75, "card")
	completed := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups/"+setupReference+"/complete", token, "", nil)
	savedCardId, _ := completed.Body["savedCardId"].(string)
	if savedCardId == "" {
		t.Fatalf("complete: %d %s", completed.Status, completed.Raw)
	}
	var intent models.PaymentIntentView
	err := databases.RunInMoneyTransaction(context.Background(), harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		intent, err = gateway.CreatePendingPaymentIntentInTransaction(ctx, transaction, models.CreatePaymentIntentRequest{
			Purpose: "card_verification", OwnerUserId: buyer, SubjectId: uuid.NewString(), Provider: "flutterwave", AmountMinor: 5000, Currency: "NGN",
		})
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	if missing := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/charges", token, "", map[string]any{"paymentReference": intent.Reference, "savedCardId": savedCardId}); missing.Status != http.StatusBadRequest || missing.Body["code"] != "IDEMPOTENCY_KEY_REQUIRED" {
		t.Fatalf("a charge without an Idempotency-Key is refused: %d %s", missing.Status, missing.Raw)
	}
	chargesBefore := harness.Flutterwave.CallCount("POST /tokenized-charges")
	var group sync.WaitGroup
	for index := range 8 {
		group.Add(1)
		go func() {
			defer group.Done()
			key := "double-tap-same-key"
			if index%2 == 1 {
				key = "double-tap-" + uuid.NewString()
			}
			_, _ = gateway.ChargePaymentIntentWithSavedCard(context.Background(), paymentservices.SavedCardChargeRequest{UserId: buyer, PaymentIntentReference: intent.Reference, SavedCardId: savedCardId, IdempotencyKey: key})
		}()
	}
	group.Wait()
	if charges := harness.Flutterwave.CallCount("POST /tokenized-charges") - chargesBefore; charges != 1 {
		t.Fatalf("a double tap must charge the saved card once, got %d charge calls", charges)
	}
	assertLedgerHealthy(t, harness)
}
