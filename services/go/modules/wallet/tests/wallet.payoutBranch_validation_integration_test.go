package wallet_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
)

func setPayoutAccountBranchBank(t *testing.T, harness *walletHarness, accountID, branchCode string) {
	t.Helper()
	schema := harness.wallet.Payouts.Container.Settings.Money.DatabaseSchema
	query := fmt.Sprintf(`UPDATE "%s".payout_accounts SET bank_code = 'BRANCH', bank_name = 'Branch Bank', branch_code = $1 WHERE id = $2`, schema)
	if _, err := harness.Database.Exec(query, branchCode, accountID); err != nil {
		t.Fatal(err)
	}
}

func TestPayoutDispatchIncludesTheCurrentRequiredBranchCode(t *testing.T) {
	harness := startWalletHarness(t, false)
	token, accountID := harness.fundWithdrawableBalance(uuid.NewString(), 100_000)
	setPayoutAccountBranchBank(t, harness, accountID, "BR-001")
	created := harness.withdraw(token, "payout-branch-current", accountID, 20_000)
	if created.Status != http.StatusCreated {
		t.Fatalf("queue withdrawal: %d %s", created.Status, created.Raw)
	}
	reference := created.Body["reference"].(string)
	harness.wallet.Payouts.Withdrawals.RunPayoutBatch(context.Background(), 10)
	transfer := harness.Flutterwave.TransferByReference(reference)
	if transfer == nil || transfer.DestinationBranchCode != "BR-001" {
		t.Fatalf("provider transfer must carry the validated branch code: %+v", transfer)
	}
}

func TestPayoutWithLegacyMissingBranchIsNotSent(t *testing.T) {
	harness := startWalletHarness(t, false)
	token, accountID := harness.fundWithdrawableBalance(uuid.NewString(), 100_000)
	setPayoutAccountBranchBank(t, harness, accountID, "")
	created := harness.withdraw(token, "payout-branch-legacy", accountID, 20_000)
	if created.Status != http.StatusCreated {
		t.Fatalf("queue withdrawal: %d %s", created.Status, created.Raw)
	}
	reference := created.Body["reference"].(string)
	report := harness.wallet.Payouts.Withdrawals.RunPayoutBatch(context.Background(), 10)
	if report.Errors != 1 || harness.Flutterwave.TransferByReference(reference) != nil {
		t.Fatalf("a payout with missing branch details must not reach the provider: report=%+v transfer=%+v", report, harness.Flutterwave.TransferByReference(reference))
	}
	var status, reason string
	schema := harness.wallet.Payouts.Container.Settings.Money.DatabaseSchema
	query := fmt.Sprintf(`SELECT status, failure_reason FROM "%s".withdrawals WHERE reference = $1`, schema)
	if err := harness.Database.QueryRow(query, reference).Scan(&status, &reason); err != nil {
		t.Fatal(err)
	}
	if status != "queued" || reason == "" {
		t.Fatalf("blocked payout must remain safely queued with a reason: status=%s reason=%q", status, reason)
	}
}

func TestPayoutAccountCannotBeRemovedUntilItsQueuedWithdrawalIsCancelled(t *testing.T) {
	harness := startWalletHarness(t, false)
	token, accountID := harness.fundWithdrawableBalance(uuid.NewString(), 100_000)
	created := harness.withdraw(token, "payout-account-in-flight", accountID, 20_000)
	if created.Status != http.StatusCreated {
		t.Fatalf("queue withdrawal: %d %s", created.Status, created.Raw)
	}
	path := "/api/v1/wallets/me/payout-accounts/" + accountID
	remove := harness.Call(http.MethodDelete, path, token, "", nil, harness.stepUp(token))
	if remove.Status != http.StatusConflict || remove.Body["code"] != "PAYOUT_ACCOUNT_IN_USE" {
		t.Fatalf("an account used by a queued withdrawal cannot be removed: %d %s", remove.Status, remove.Raw)
	}
	cancel := harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals/"+created.Body["id"].(string)+"/cancel", token, "cancel-before-account-removal", nil)
	if cancel.Status >= http.StatusBadRequest {
		t.Fatalf("cancel queued withdrawal: %d %s", cancel.Status, cancel.Raw)
	}
	remove = harness.Call(http.MethodDelete, path, token, "", nil, harness.stepUp(token))
	if remove.Status >= http.StatusBadRequest {
		t.Fatalf("remove account after cancellation: %d %s", remove.Status, remove.Raw)
	}
}
