package escrow

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent/escrow"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

func (harness *escrowHarness) releaseAfterDelivery(orderId string) {
	harness.T.Helper()
	deliveredAt := harness.clock.UTC().Truncate(time.Second)
	harness.deliverOrderEvent("orderGroup.delivered", orderId, deliveredAt)
	harness.clock = deliveredAt.Add(72*time.Hour + time.Minute)
	harness.sweep()
	harness.RunMoneyWorkers()
}

func (harness *escrowHarness) lastOutboxData(eventType string) map[string]any {
	harness.T.Helper()
	var raw []byte
	_ = harness.Database.QueryRow(`SELECT payload FROM "`+harness.escrow.Application.Container.Settings.Money.DatabaseSchema+`".outbox_events WHERE event_type = $1 ORDER BY created_at DESC LIMIT 1`, eventType).Scan(&raw)
	decoded := map[string]any{}
	_ = json.Unmarshal(raw, &decoded)
	if data, isEnvelope := decoded["data"].(map[string]any); isEnvelope {
		return data
	}
	return decoded
}

func TestARefundAfterTheSellerWasPaidReturnsOnlyTheSellersPortionAndKeepsZudomartsFees(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 1_000_000})
	harness.payAndSettle(buyer, orderId)
	harness.releaseAfterDelivery(orderId)
	client := harness.escrow.Application.Container.Client(harness.Database)
	released := client.Escrow.Query().Where(escrow.OrderID(orderId)).OnlyX(context.Background())
	if released.Status != escrow.StatusReleased {
		t.Fatalf("released first: %s", released.Status)
	}
	sellerPortion, fees := released.ReleasedToSellerMinor, released.CommissionMinor+released.ProcessingFeeMinor
	buyerBefore := harness.balance(ledgermodels.WalletAvailableAccount(buyer, "NGN"))
	feeRevenueBefore := harness.balance(ledgermodels.PlatformEscrowFeeRevenueAccount("NGN"))
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.disputes.resolve")
	refunded := harness.Call(http.MethodPost, "/api/v1/admin/orders/"+orderId+"/escrow/refund", staff.AccessToken, "after-payout-1", map[string]any{"reason": "Returned after release"}, staff.StepUp())
	if refunded.Status != http.StatusOK {
		t.Fatalf("refund after payout: %d %s", refunded.Status, refunded.Raw)
	}
	harness.RunMoneyWorkers()
	clawed := client.Escrow.Query().Where(escrow.OrderID(orderId)).OnlyX(context.Background())
	if got := harness.balance(ledgermodels.WalletAvailableAccount(buyer, "NGN")) - buyerBefore; got != sellerPortion {
		t.Fatalf("the buyer gets back only the seller's portion: got %d, want %d (fees %d)", got, sellerPortion, fees)
	}
	if clawed.RefundedMinor != sellerPortion || clawed.Status != escrow.StatusClawedBack {
		t.Fatalf("escrow records the seller's portion as refunded: %d %s", clawed.RefundedMinor, clawed.Status)
	}
	if harness.balance(ledgermodels.PlatformEscrowFeeRevenueAccount("NGN")) != feeRevenueBefore || harness.balance(ledgermodels.RefundedProcessingFeesExpenseAccount("NGN")) != 0 {
		t.Fatalf("Zudomart's escrow fee and processing fee are not refunded: %v", harness.NonZeroBalances())
	}
	breakdown, _ := harness.lastOutboxData("escrow.clawedBack")["refundBreakdown"].(map[string]any)
	if breakdown == nil || breakdown["refundedToBuyer"].(map[string]any)["amountMinor"].(float64) != float64(sellerPortion) ||
		breakdown["escrowFeeKept"].(map[string]any)["amountMinor"].(float64) != float64(released.CommissionMinor) ||
		breakdown["processingFeeKept"].(map[string]any)["amountMinor"].(float64) != float64(released.ProcessingFeeMinor) {
		t.Fatalf("the buyer is shown the breakdown: %v", breakdown)
	}
	if view := harness.Call(http.MethodGet, "/api/v1/orders/"+orderId+"/escrow", harness.Tokens.UserAccessToken(buyer), "", nil); view.Body["feesKeptOnRefund"].(map[string]any)["amountMinor"].(float64) != float64(fees) || view.Body["stage"] != "refunded" {
		t.Fatalf("the escrow view shows the fees kept: %s", view.Raw)
	}
	harness.AssertLedgerHealthy()
}
