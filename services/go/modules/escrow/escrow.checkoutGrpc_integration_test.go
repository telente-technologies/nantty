package escrow

import (
	"context"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/types/known/timestamppb"

	commonv1 "nantty/contracts/gen/go/nantty/common/v1"
	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	"nantty/modules/ledger/src/loaders"
)

func startCheckoutMoneyClient(t *testing.T, harness *escrowHarness) moneyv1.CheckoutMoneyServiceClient {
	listener := bufconn.Listen(1 << 20)
	server := loaders.NewMoneyGrpcServer("checkout-internal-token-0123456789abcd", harness.escrow.RegisterGrpcServices)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	connection, err := grpc.NewClient("passthrough:///bufnet", grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }),
		grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = connection.Close() })
	return moneyv1.NewCheckoutMoneyServiceClient(connection)
}

func TestCommerceRegistersPayablesRecordsDeliveryAndConfirmsReceiptOverGrpc(t *testing.T) {
	harness := startEscrowHarness(t)
	client := startCheckoutMoneyClient(t, harness)
	ctx := metadata.AppendToOutgoingContext(context.Background(), "authorization", "Bearer checkout-internal-token-0123456789abcd")
	buyer, orderId, checkoutId := uuid.NewString(), uuid.NewString(), uuid.NewString()
	order := &moneyv1.OrderPayable{OrderId: orderId, OrderReference: "ZM-77", StoreId: "store-1", SellerUserId: sellerForOrder("grpc-order"), Amount: &commonv1.Money{AmountMinor: 400_000, Currency: "NGN"}, PaymentMode: moneyv1.OrderPaymentMode_ORDER_PAYMENT_MODE_DIRECT}
	_, err := client.RegisterCheckoutPayables(ctx, &moneyv1.RegisterCheckoutPayablesRequest{CheckoutId: checkoutId, BuyerUserId: buyer, Orders: []*moneyv1.OrderPayable{order}})
	if reason := errorInfoReason(err); status.Code(err) != codes.FailedPrecondition || reason != "DIRECT_PAYMENT_NOT_ALLOWED" {
		t.Fatalf("direct payment for an unverified store: %v %s", err, reason)
	}
	order.PaymentMode = moneyv1.OrderPaymentMode_ORDER_PAYMENT_MODE_ESCROW
	if _, err := client.RegisterCheckoutPayables(context.Background(), &moneyv1.RegisterCheckoutPayablesRequest{CheckoutId: checkoutId, BuyerUserId: buyer, Orders: []*moneyv1.OrderPayable{order}}); status.Code(err) != codes.Unauthenticated {
		t.Fatalf("missing internal token: %v", err)
	}
	if registered, err := client.RegisterCheckoutPayables(ctx, &moneyv1.RegisterCheckoutPayablesRequest{CheckoutId: checkoutId, BuyerUserId: buyer, Orders: []*moneyv1.OrderPayable{order}}); err != nil || registered.RegisteredOrderCount != 1 {
		t.Fatalf("register: %v %v", registered, err)
	}
	harness.payAndSettle(buyer, orderId)
	delivered, err := client.RecordOrderFulfilment(ctx, &moneyv1.RecordOrderFulfilmentRequest{OrderId: orderId, Stage: moneyv1.FulfilmentStage_FULFILMENT_STAGE_DELIVERED, OccurredAt: timestamppb.New(harness.clock)})
	if err != nil || delivered.Escrow.AutoReleaseAt == nil || !delivered.Escrow.AutoReleaseAt.AsTime().Equal(harness.clock.Add(72*time.Hour).UTC().Truncate(time.Microsecond)) {
		t.Fatalf("delivered: %+v %v", delivered, err)
	}
	if _, err := client.ConfirmOrderReceipt(ctx, &moneyv1.ConfirmOrderReceiptRequest{OrderId: orderId, BuyerUserId: uuid.NewString()}); status.Code(err) != codes.NotFound {
		t.Fatalf("another buyer confirmed receipt: %v", err)
	}
	released, err := client.ConfirmOrderReceipt(ctx, &moneyv1.ConfirmOrderReceiptRequest{OrderId: orderId, BuyerUserId: buyer})
	if err != nil || released.Escrow.Status != "released" || released.Escrow.SellerAmount.AmountMinor != 388_400 {
		t.Fatalf("confirm receipt: %+v %v", released, err)
	}
	harness.RunMoneyWorkers()
	if got := harness.Flutterwave.WalletBalance(harness.WalletRef(sellerForOrder("grpc-order")), "NGN"); got != 388_400 {
		t.Fatalf("confirmed receipt must move the seller's share to the seller's wallet: %d", got)
	}
	if view := harness.Call(http.MethodGet, "/api/v1/orders/"+orderId+"/escrow", harness.Tokens.UserAccessToken(buyer), "", nil); view.Body["stage"] != "released_to_seller" {
		t.Fatalf("stage after receipt = %v", view.Body["stage"])
	}
	harness.AssertLedgerHealthy()
}

func errorInfoReason(err error) string {
	for _, detail := range status.Convert(err).Details() {
		if information, isInformation := detail.(*errdetails.ErrorInfo); isInformation {
			return information.Reason
		}
	}
	return ""
}
