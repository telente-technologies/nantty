package wallet_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
)

func TestRemovingASellerPayoutAccountConsumesAFreshRelayedStepUp(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	harness := startWalletHarness(t, true)
	seller, storeId := uuid.NewString(), uuid.NewString()
	prefix := "/api/v1/internal/sellers/" + seller
	headers := sellerHeaders(storeId)
	harness.OnboardConnectedAccount(seller, false)
	resolved := harness.Call(http.MethodPost, prefix+"/wallet/payout-accounts/resolve", "", "", map[string]any{"bankCode": "058", "accountNumber": "0123454821"}, headers)
	addedWith := steppedUp(headers)
	added := harness.Call(http.MethodPost, prefix+"/wallet/payout-accounts", "", "", map[string]any{"resolutionId": resolved.Body["resolutionId"]}, addedWith)
	if added.Status != http.StatusCreated {
		t.Fatalf("add: %d %s", added.Status, added.Raw)
	}
	accountPath := prefix + "/wallet/payout-accounts/" + added.Body["id"].(string)
	if missing := harness.Call(http.MethodDelete, accountPath, "", "", nil, headers); missing.Status != http.StatusForbidden || missing.Body["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("removing without a step-up must be refused: %d %s", missing.Status, missing.Raw)
	}
	if spent := harness.Call(http.MethodDelete, accountPath, "", "", nil, addedWith); spent.Status != http.StatusUnauthorized || spent.Body["code"] != "STEP_UP_REUSED" {
		t.Fatalf("a step-up spent on adding must not remove: %d %s", spent.Status, spent.Raw)
	}
	removedWith := steppedUp(headers)
	if removed := harness.Call(http.MethodDelete, accountPath, "", "", nil, removedWith); removed.Status >= 300 {
		t.Fatalf("a fresh step-up removes the account: %d %s", removed.Status, removed.Raw)
	}
	if replayed := harness.Call(http.MethodDelete, accountPath, "", "", nil, removedWith); replayed.Status != http.StatusUnauthorized || replayed.Body["code"] != "STEP_UP_REUSED" {
		t.Fatalf("the removal step-up is single use: %d %s", replayed.Status, replayed.Raw)
	}
	if listed := harness.Call(http.MethodGet, prefix+"/wallet/payout-accounts", "", "", nil, headers); len(listed.Body["data"].([]any)) != 0 {
		t.Fatalf("the account is gone: %s", listed.Raw)
	}
}
