package escrow

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src/generated/ent/escrow"
	escrowservices "zudomart/modules/escrow/src/modules/escrows/services"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
)

func commerceRefund(harness *escrowHarness, orderId, buyer string, amountMinor int64, reason string) paymentstesting.HarnessResponse {
	request := map[string]any{"orderGroupId": orderId, "storeId": "store-1", "buyerAccountId": buyer, "amountMinor": amountMinor, "currency": "NGN", "reason": reason}
	return harness.Call(http.MethodPost, "/api/v1/internal/order-groups/"+orderId+"/refunds", "", "", request, http.Header{"X-Internal-Token": {strings.Repeat("e", 32)}})
}

func TestAPartiallyRefundedEscrowCanBeFinishedByRefundingExactlyTheRest(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 300_000})
	harness.payAndSettle(buyer, orderId)
	if partial := commerceRefund(harness, orderId, buyer, 100_000, "one item damaged"); partial.Status != http.StatusOK {
		t.Fatalf("partial refund: %d %s", partial.Status, partial.Raw)
	}
	harness.RunMoneyWorkers()
	seller := sellerForOrder(orderId)
	if wrong := commerceRefund(harness, orderId, buyer, 150_000, "a different amount"); wrong.Status != http.StatusConflict || wrong.Body["code"] != "ESCROW_ALREADY_PARTIALLY_REFUNDED" {
		t.Fatalf("only exactly the rest may be refunded: %d %s", wrong.Status, wrong.Raw)
	}
	var released escrowservices.EscrowSettlementResult
	mustRunInTransaction(t, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		released, err = harness.escrow.Application.Escrows.ReleaseEscrowInTransaction(ctx, transaction, orderId, "buyerConfirmed", escrowservices.SystemActor)
		return err
	})
	if !released.AlreadySettled || released.Escrow.Status != escrow.StatusPartiallyRefunded {
		t.Fatalf("releasing a partially refunded escrow moves nothing: %+v", released)
	}
	for range 2 {
		if rest := commerceRefund(harness, orderId, buyer, 200_000, "returned the rest"); rest.Status != http.StatusOK || rest.Body["status"] != "refunded" {
			t.Fatalf("refunding the rest: %d %s", rest.Status, rest.Raw)
		}
	}
	harness.RunMoneyWorkers()
	held := harness.escrow.Application.Container.Client(harness.Database).Escrow.Query().Where(escrow.OrderID(orderId)).OnlyX(context.Background())
	if want := 100_000 + held.ReleasedToSellerMinor; held.RefundedMinor != want || held.Status != escrow.StatusRefunded {
		t.Fatalf("the rest refunds only the seller's kept share once; Zudomart keeps its fees on the released part: %d, want %d", held.RefundedMinor, want)
	}
	if buyerMoney := harness.balance(ledgermodels.WalletAvailableAccount(buyer, "NGN")) + harness.balance(ledgermodels.WalletDepositHoldAccount(buyer, "NGN")); buyerMoney != held.RefundedMinor {
		t.Fatalf("the buyer holds everything refunded: %d %v", buyerMoney, harness.NonZeroBalances())
	}
	if sellerMoney := harness.balance(ledgermodels.WalletAvailableAccount(seller, "NGN")) + harness.balance(ledgermodels.WalletDepositHoldAccount(seller, "NGN")); sellerMoney != 0 {
		t.Fatalf("the seller's kept share is taken back: %d %v", sellerMoney, harness.NonZeroBalances())
	}
	harness.AssertLedgerHealthy()
}
