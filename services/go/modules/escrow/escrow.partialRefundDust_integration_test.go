package escrow

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent/escrow"
)

func TestAPartialRefundKeepsTheHeldCommissionProRataWithTheRoundingDustToTheSeller(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 200_067})
	harness.payAndSettle(buyer, orderId)
	request := map[string]any{"orderGroupId": orderId, "storeId": "store-1", "buyerAccountId": buyer, "amountMinor": 66_689, "currency": "NGN", "reason": "one item damaged"}
	if response := harness.Call(http.MethodPost, "/api/v1/internal/order-groups/"+orderId+"/refunds", "", "", request, http.Header{"X-Internal-Token": {strings.Repeat("e", 32)}}); response.Status != http.StatusOK {
		t.Fatalf("partial refund: %d %s", response.Status, response.Raw)
	}
	held := harness.escrow.Application.Container.Client(harness.Database).Escrow.Query().Where(escrow.OrderID(orderId)).OnlyX(context.Background())
	platformKept := held.AmountMinor - held.RefundedMinor - held.ReleasedToSellerMinor
	wanted := held.CommissionMinor * 133_378 / 200_067
	if commissionKept := platformKept - held.ProcessingFeeMinor; commissionKept != wanted {
		t.Fatalf("the platform keeps its held commission pro rata, rounded down: got %d, want %d of %d (seller %d)", commissionKept, wanted, held.CommissionMinor, held.ReleasedToSellerMinor)
	}
	harness.RunMoneyWorkers()
	harness.AssertLedgerHealthy()
}
