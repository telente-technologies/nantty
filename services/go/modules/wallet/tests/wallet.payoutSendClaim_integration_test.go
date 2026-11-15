package wallet_test

import (
	"context"
	"sync"
	"testing"

	"github.com/google/uuid"
)

func TestConcurrentSendersOfAnUnconfirmedPayoutPostTheTransferOnce(t *testing.T) {
	harness := startWalletHarness(t, false)
	user := uuid.NewString()
	token, accountId := harness.fundWithdrawableBalance(user, 100_000)
	reference := harness.withdraw(token, "send-claim-withdraw", accountId, 50_000).Body["reference"].(string)
	harness.Flutterwave.LoseNextTransferReply = true
	harness.wallet.Payouts.Withdrawals.RunPayoutBatch(context.Background(), 10)
	if status := harness.withdrawalStatus(reference); status != "processing" || harness.Flutterwave.Calls("POST /transfers") != 1 {
		t.Fatalf("a lost reply leaves the payout processing: %s after %d posts", status, harness.Flutterwave.Calls("POST /transfers"))
	}
	var group sync.WaitGroup
	for range 5 {
		group.Add(1)
		go func() {
			defer group.Done()
			if _, err := harness.Payments.Application.Gateway.SendPreparedSellerPayout(context.Background(), reference); err != nil {
				t.Error(err)
			}
		}()
	}
	group.Wait()
	if posts := harness.Flutterwave.Calls("POST /transfers"); posts != 1 {
		t.Fatalf("a payout whose send is already claimed must not be posted again: %d posts", posts)
	}
	harness.FinishTransfer(reference, true)
	harness.wallet.Payouts.Withdrawals.FinalizeProcessingWithdrawalsOlderThan(context.Background(), 0)
	if status := harness.withdrawalStatus(reference); status != "paid" {
		t.Fatalf("the payout still completes: %s", status)
	}
	harness.AssertLedgerHealthy()
}
