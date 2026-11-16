package flutterwaveflows

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	"nantty/modules/ledger/src/databases"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
)

func TestOldMovementsThatNeverUnblockDoNotStarveANewSettlement(t *testing.T) {
	harness := startFlowHarness(t)
	ctx := context.Background()
	stuck := harness.newUser("NG")
	err := databases.RunInMoneyTransaction(ctx, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		for index := range 120 {
			if _, err := harness.gateway.EnqueueMovementInTransaction(ctx, transaction, paymentmodels.MovementRequest{
				Kind: paymentmodels.MovementEscrowFundIn, SubjectId: fmt.Sprintf("abandoned-%d", index), UserId: stuck, ToUserId: stuck,
				AmountMinor: 1_000, Currency: "NGN", BlockedOn: fmt.Sprintf("settlement:never-settles-%d", index),
			}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	harness.advance(1)
	buyer, _, placed := harness.cardPaidOrder(100_000)
	harness.fake.FundMainBalance("NGN", 1_000_000)
	harness.settleCard("NGN")
	if held := harness.escrowFor(placed); held.WalletFundedAt == nil {
		t.Fatal("a settled card payment must reach the buyer's wallet even behind 120 movements that never unblock")
	}
	if got := harness.fake.WalletBalance(harness.walletRef(buyer), "NGN"); got != 100_000 {
		t.Fatalf("buyer wallet holds %d", got)
	}
}
