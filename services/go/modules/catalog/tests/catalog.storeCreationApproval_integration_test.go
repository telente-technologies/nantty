package catalog_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
)

// Owner decision: stores open before the seller is verified; unverified Nigerian sellers sell escrow-only up to a cap and cannot withdraw.
func TestAStoreCanBeOpenedBeforeTheSellerIsVerified(t *testing.T) {
	harness := startHttpHarness(t)
	_, token := harness.account("new-seller")
	body := map[string]any{"businessProfileId": uuid.NewString(), "name": "Corner Shop"}
	status, response := harness.call("POST", "/api/v1/stores", token, body, "Idempotency-Key", "open-store-before-verification")
	if status != http.StatusUnprocessableEntity || response["code"] != "BUSINESS_PROFILE_INVALID" {
		t.Fatalf("no seller application is needed to open a store; the request should reach profile checks: %d %v", status, response)
	}
}
