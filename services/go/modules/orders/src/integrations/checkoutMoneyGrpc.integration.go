package integrations

import (
	"context"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/timestamppb"

	commonv1 "zudomart/contracts/gen/go/zudomart/common/v1"
	moneyv1 "zudomart/contracts/gen/go/zudomart/money/v1"
	"zudomart/modules/orders/src/interfaces"
	"zudomart/platform/money"
)

type CheckoutMoneyClient struct {
	connection *grpc.ClientConn
	service    moneyv1.CheckoutMoneyServiceClient
	options    InternalGrpcOptions
}

func DialCheckoutMoneyService(options InternalGrpcOptions) (*CheckoutMoneyClient, error) {
	connection, err := dialInternalGrpcService(options)
	if err != nil {
		return nil, fmt.Errorf("dial money service: %w", err)
	}
	return &CheckoutMoneyClient{connection: connection, service: moneyv1.NewCheckoutMoneyServiceClient(connection), options: options}, nil
}

func (client *CheckoutMoneyClient) Close() error { return client.connection.Close() }

func (client *CheckoutMoneyClient) RegisterCheckoutPayables(ctx context.Context, request interfaces.RegisterPayablesRequest) error {
	message := &moneyv1.RegisterCheckoutPayablesRequest{CheckoutId: request.CheckoutId, BuyerUserId: request.BuyerUserId}
	for _, order := range request.Orders {
		message.Orders = append(message.Orders, &moneyv1.OrderPayable{
			OrderId: order.OrderId, OrderReference: order.OrderReference, StoreId: order.StoreId, SellerUserId: order.SellerUserId,
			Amount:         &commonv1.Money{AmountMinor: order.Amount.AmountMinor, Currency: string(order.Amount.Currency)},
			ProductSummary: order.ProductSummary, PaymentMode: moneyv1.OrderPaymentMode_ORDER_PAYMENT_MODE_ESCROW, StoreVerified: order.StoreVerified,
		})
	}
	_, err := callWithRetryOnUnavailable(ctx, client.options, true, func(attempt context.Context) (*moneyv1.RegisterCheckoutPayablesResponse, error) {
		return client.service.RegisterCheckoutPayables(attempt, message)
	})
	return err
}

func (client *CheckoutMoneyClient) RecordOrderFulfilment(ctx context.Context, record interfaces.FulfilmentRecord) (interfaces.EscrowSummary, error) {
	stage := moneyv1.FulfilmentStage_FULFILMENT_STAGE_SHIPPED
	if record.Delivered {
		stage = moneyv1.FulfilmentStage_FULFILMENT_STAGE_DELIVERED
	}
	message := &moneyv1.RecordOrderFulfilmentRequest{
		OrderId: record.OrderId, Stage: stage, OccurredAt: timestamppb.New(record.OccurredAt), CourierName: record.CourierName,
		TrackingNumber: record.TrackingNumber, TrackingUrl: record.TrackingUrl,
	}
	if record.EstimatedDeliveryAt != nil {
		message.EstimatedDeliveryAt = timestamppb.New(*record.EstimatedDeliveryAt)
	}
	response, err := callWithRetryOnUnavailable(ctx, client.options, true, func(attempt context.Context) (*moneyv1.RecordOrderFulfilmentResponse, error) {
		return client.service.RecordOrderFulfilment(attempt, message)
	})
	if err != nil {
		return interfaces.EscrowSummary{}, err
	}
	return summarizeEscrow(response.GetEscrow()), nil
}

func (client *CheckoutMoneyClient) ConfirmOrderReceipt(ctx context.Context, orderId, buyerUserId string) (interfaces.EscrowSummary, error) {
	response, err := callWithRetryOnUnavailable(ctx, client.options, true, func(attempt context.Context) (*moneyv1.ConfirmOrderReceiptResponse, error) {
		return client.service.ConfirmOrderReceipt(attempt, &moneyv1.ConfirmOrderReceiptRequest{OrderId: orderId, BuyerUserId: buyerUserId})
	})
	if err != nil {
		return interfaces.EscrowSummary{}, err
	}
	return summarizeEscrow(response.GetEscrow()), nil
}

func (client *CheckoutMoneyClient) GetOrderEscrow(ctx context.Context, orderId string) (interfaces.EscrowSummary, error) {
	response, err := callWithRetryOnUnavailable(ctx, client.options, true, func(attempt context.Context) (*moneyv1.GetOrderEscrowResponse, error) {
		return client.service.GetOrderEscrow(attempt, &moneyv1.GetOrderEscrowRequest{OrderId: orderId})
	})
	if err != nil {
		return interfaces.EscrowSummary{}, err
	}
	return summarizeEscrow(response.GetEscrow()), nil
}

func summarizeEscrow(escrow *moneyv1.OrderEscrow) interfaces.EscrowSummary {
	summary := interfaces.EscrowSummary{
		EscrowId: escrow.GetEscrowId(), OrderId: escrow.GetOrderId(), Status: escrow.GetStatus(),
		HeldAmount:    money.Money{AmountMinor: escrow.GetHeldAmount().GetAmountMinor(), Currency: money.CurrencyCode(escrow.GetHeldAmount().GetCurrency())},
		PlatformFee:   money.Money{AmountMinor: escrow.GetPlatformFee().GetAmountMinor(), Currency: money.CurrencyCode(escrow.GetPlatformFee().GetCurrency())},
		SellerAmount:  money.Money{AmountMinor: escrow.GetSellerAmount().GetAmountMinor(), Currency: money.CurrencyCode(escrow.GetSellerAmount().GetCurrency())},
		RefundedMinor: escrow.GetRefundedAmount().GetAmountMinor(),
	}
	if escrow.AutoReleaseAt != nil {
		moment := escrow.AutoReleaseAt.AsTime()
		summary.AutoReleaseAt = &moment
	}
	if escrow.ReleasedAt != nil {
		moment := escrow.ReleasedAt.AsTime()
		summary.ReleasedAt = &moment
	}
	if escrow.RefundedAt != nil {
		moment := escrow.RefundedAt.AsTime()
		summary.RefundedAt = &moment
	}
	return summary
}
