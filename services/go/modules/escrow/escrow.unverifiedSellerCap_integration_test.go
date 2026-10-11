package escrow

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	commonv1 "zudomart/contracts/gen/go/zudomart/common/v1"
	moneyv1 "zudomart/contracts/gen/go/zudomart/money/v1"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
)

func (harness *escrowHarness) registerSellerOrder(buyer, seller, orderId string, amount int64, mode string) error {
	return harness.Payments.Application.Gateway.RegisterCheckoutPayables(context.Background(), []paymentmodels.OrderPayable{{
		CheckoutId: uuid.NewString(), OrderId: orderId, OrderReference: "ZM-" + orderId[:5], BuyerUserId: buyer, StoreId: "store-" + seller,
		SellerUserId: seller, AmountMinor: amount, Currency: "NGN", ProductSummary: "Ankara dress", PaymentMode: mode,
	}})
}

func TestUnverifiedSellersSellEscrowOnlyUpToTheSalesCapUntilVerified(t *testing.T) {
	harness := startEscrowHarness(t)
	gateway := harness.Payments.Application.Gateway
	harness.Payments.Application.Container.Settings.UnverifiedSellerSalesCaps = map[string]int64{"NGN": 1_000_000}
	seller, buyer := uuid.NewString(), uuid.NewString()
	paid := uuid.NewString()
	if err := harness.registerSellerOrder(buyer, seller, paid, 600_000, "escrow"); err != nil {
		t.Fatalf("below the cap: %v", err)
	}
	harness.payCheckoutThroughWebhook(buyer, paid, 0)
	if err := harness.registerSellerOrder(buyer, seller, uuid.NewString(), 50_000, "direct"); !errors.Is(err, paymentservices.ErrDirectPaymentNotAllowed) {
		t.Fatalf("direct payment for an unverified seller: %v", err)
	}
	if err := harness.registerSellerOrder(buyer, seller, uuid.NewString(), 400_000, "escrow"); err != nil {
		t.Fatalf("exactly at the cap must be allowed: %v", err)
	}
	if err := harness.registerSellerOrder(buyer, seller, uuid.NewString(), 100, "escrow"); !errors.Is(err, paymentservices.ErrSellerSalesCapReached) {
		t.Fatalf("an unpaid checkout still holds the cap, so this must be refused: %v", err)
	}
	if err := harness.registerSellerOrder(buyer, uuid.NewString(), uuid.NewString(), 900_000, "escrow"); err != nil {
		t.Fatalf("the cap is per seller: %v", err)
	}
	client := startCheckoutMoneyClient(t, harness)
	ctx := metadata.AppendToOutgoingContext(context.Background(), "authorization", "Bearer checkout-internal-token-0123456789abcd")
	_, err := client.RegisterCheckoutPayables(ctx, &moneyv1.RegisterCheckoutPayablesRequest{CheckoutId: uuid.NewString(), BuyerUserId: buyer, Orders: []*moneyv1.OrderPayable{{
		OrderId: uuid.NewString(), OrderReference: "ZM-cap", StoreId: "store-" + seller, SellerUserId: seller, Amount: &commonv1.Money{AmountMinor: 5_000, Currency: "NGN"},
	}}})
	if status.Code(err) != codes.FailedPrecondition || errorInfoReason(err) != "SELLER_SALES_CAP_REACHED" {
		t.Fatalf("commerce must see the cap reason over gRPC: %v %s", err, errorInfoReason(err))
	}
	if err := gateway.RecordSellerVerification(context.Background(), seller, "evt-1", time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := harness.registerSellerOrder(buyer, seller, uuid.NewString(), 5_000_000, "escrow"); err != nil {
		t.Fatalf("verification must lift the cap: %v", err)
	}
	if err := gateway.RecordSellerVerification(context.Background(), seller, "evt-2", time.Now()); err != nil {
		t.Fatalf("a repeated approval event must be idempotent: %v", err)
	}
	harness.AssertLedgerHealthy()
}
