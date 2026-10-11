package payments

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
)

func TestCardVerificationChargeIsRefundedAsSoonAsTheCardIsSaved(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	token := harness.Tokens.UserAccessToken(uuid.NewString())
	started := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups", token, "", map[string]any{"returnTo": "https://zudomart.test/pay/return"})
	if started.Status != http.StatusCreated {
		t.Fatalf("setup: %d %s", started.Status, started.Raw)
	}
	reference := started.Body["reference"].(string)
	if charge := started.Body["verificationCharge"].(map[string]any); charge["amountMinor"] != float64(5000) || charge["currency"] != "NGN" {
		t.Fatalf("the verification charge is ₦50: %v", charge)
	}
	harness.Flutterwave.CompleteCheckout(reference, 0, 0, "card")
	completed := harness.Call(http.MethodPost, "/api/v1/payments/saved-cards/setups/"+reference+"/complete", token, "", map[string]any{})
	if completed.Status != http.StatusOK {
		t.Fatalf("complete: %d %s", completed.Status, completed.Raw)
	}
	if amounts := harness.Flutterwave.RefundAmountsMinor(); len(amounts) != 1 || amounts[0] != 5000 {
		t.Fatalf("the refund must be sent straight away, not by the five-minute sweep: %v", harness.Flutterwave.Refunds)
	}
}
