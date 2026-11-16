package escrow_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
)

func TestAnOrdersPayableCannotBeRepricedAfterCheckoutSoTheHoldMatchesTheOrderTotal(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	checkoutId := harness.registerCheckout(buyer, map[string]int64{orderId: 250_000})
	repriced := []paymentmodels.OrderPayable{{CheckoutId: checkoutId, OrderId: orderId, OrderReference: "ZM-" + orderId[:5], BuyerUserId: buyer, StoreId: "store-" + orderId[:4],
		SellerUserId: sellerForOrder(orderId), AmountMinor: 199_000, Currency: "NGN", ProductSummary: "Ankara dress", PaymentMode: "escrow"}}
	if err := harness.Payments.Application.Gateway.RegisterCheckoutPayables(context.Background(), repriced); !errors.Is(err, paymentservices.ErrCheckoutPayablesConflict) {
		t.Fatalf("a payable registered at checkout must not change price: %v", err)
	}
	harness.payAndSettle(buyer, orderId)
	held := harness.escrow.Application.Container.Client(harness.Database).Escrow.Query().OnlyX(context.Background())
	if held.AmountMinor != 250_000 {
		t.Fatalf("the hold is the checkout total: %d", held.AmountMinor)
	}
	if rest := commerceRefund(harness, orderId, buyer, 250_001, "more than paid"); rest.Status != 422 || rest.Body["code"] != "REFUND_DOES_NOT_MATCH_ORDER" {
		t.Fatalf("the escrow refund cap is the same order total: %d %s", rest.Status, rest.Raw)
	}
}
