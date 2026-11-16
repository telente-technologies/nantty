package payments_test

import (
	"context"
	"net/http"
	"sync"
	"testing"

	"github.com/google/uuid"

	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
)

func TestConcurrentSettlementRunsCreditAPaymentIntoTheMainBalanceOnce(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	token := harness.Tokens.UserAccessToken(uuid.NewString())
	reference := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups", token, "", map[string]any{"returnTo": "https://nantty.test/pay/return"}).Body["reference"].(string)
	harness.Flutterwave.CompleteCheckout(reference, 0, 0, "card")
	if completed := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups/"+reference+"/complete", token, "", map[string]any{}); completed.Status != http.StatusOK {
		t.Fatalf("complete: %d %s", completed.Status, completed.Raw)
	}
	harness.Flutterwave.SettleAll("NGN")
	var group sync.WaitGroup
	for range 4 {
		group.Add(1)
		go func() {
			defer group.Done()
			harness.Payments.Application.Gateway.ProcessProviderSettlements(context.Background(), nil)
		}()
	}
	group.Wait()
	harness.Payments.Application.Gateway.ProcessProviderSettlements(context.Background(), nil)
	var entries int
	if err := harness.Database.QueryRow(`SELECT count(*) FROM "`+harness.LedgerSchema+`".journal_entries WHERE reference = $1`, "settled:"+reference).Scan(&entries); err != nil {
		t.Fatal(err)
	}
	if entries != 1 {
		t.Fatalf("one settlement credit per payment: %d", entries)
	}
	harness.AssertLedgerHealthy()
}
