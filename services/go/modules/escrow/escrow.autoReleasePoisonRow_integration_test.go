package escrow

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent/escrow"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
)

func TestTheAutoReleaseSweepSkipsAPoisonRowAndReleasesTheRowsBehindIt(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 100_000})
	harness.payAndSettle(buyer, orderId)
	harness.deliverOrderEvent("orderGroup.delivered", orderId, harness.clock.UTC().Truncate(time.Second))
	client := harness.escrow.Application.Container.Client(harness.Database)
	poisonOrder := uuid.NewString()
	client.Escrow.Create().SetOrderID(poisonOrder).SetOrderReference("ZM-LEGACY").SetCheckoutID(uuid.NewString()).SetPaymentIntentID(uuid.New()).
		SetPaymentReference("legacy-" + uuid.NewString()[:8]).SetProvider("flutterwave").SetBuyerUserID(uuid.NewString()).SetStoreID(uuid.NewString()).
		SetSellerUserID(uuid.NewString()).SetAmountMinor(50_000).SetCurrency("NGN").SetCommissionBps(150).SetCommissionMinor(750).SetSellerAmountMinor(48_550).
		SetProcessingFeeMinor(700).SetStatus(escrow.StatusHeld).SetAutoReleaseAt(harness.clock.Add(-48 * time.Hour)).SetDeliveredAt(harness.clock.Add(-120 * time.Hour)).SaveX(context.Background())
	harness.clock = harness.clock.Add(harness.escrow.Application.Container.Settings.UndeliveredReleaseWindow() + time.Hour)
	deadLettersBefore := paymentservices.PaymentAlertCount("escrowAutoReleaseDeadLetter")
	for tick := range 2 {
		released, err := harness.escrow.Application.Escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10)
		if err == nil {
			t.Fatalf("tick %d: the poison row must still be reported", tick)
		}
		if tick == 0 && released != 1 {
			t.Fatalf("the due escrow behind the poison row is released on the first tick: %d %v", released, err)
		}
	}
	if _, _, status := harness.escrowOf(orderId); status != "released" {
		t.Fatalf("the good escrow: %s", status)
	}
	if _, _, status := harness.escrowOf(poisonOrder); status != "held" {
		t.Fatalf("the poison row is left for staff: %s", status)
	}
	if deadLetters := paymentservices.PaymentAlertCount("escrowAutoReleaseDeadLetter") - deadLettersBefore; deadLetters != 2 {
		t.Fatalf("each skipped poison row is counted: %d", deadLetters)
	}
}
