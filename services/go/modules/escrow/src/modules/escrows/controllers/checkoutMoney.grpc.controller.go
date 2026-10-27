package controllers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	commonv1 "nantty/contracts/gen/go/nantty/common/v1"
	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/modules/escrows"
	confirmorderreceipt "nantty/modules/escrow/src/modules/escrows/commands/confirmOrderReceipt"
	recordorderfulfilment "nantty/modules/escrow/src/modules/escrows/commands/recordOrderFulfilment"
	"nantty/modules/escrow/src/modules/escrows/services"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/platform/httpserver"
)

type CheckoutMoneyGrpcController struct {
	moneyv1.UnimplementedCheckoutMoneyServiceServer
	Application *escrows.Application
}

func (controller CheckoutMoneyGrpcController) RegisterCheckoutPayables(ctx context.Context, request *moneyv1.RegisterCheckoutPayablesRequest) (*moneyv1.RegisterCheckoutPayablesResponse, error) {
	if request.GetCheckoutId() == "" || request.GetBuyerUserId() == "" || len(request.GetOrders()) == 0 || len(request.GetOrders()) > 50 {
		return nil, status.Error(codes.InvalidArgument, "checkout_id, buyer_user_id and 1-50 orders are required")
	}
	payables := make([]paymentmodels.OrderPayable, 0, len(request.GetOrders()))
	for _, order := range request.GetOrders() {
		if order.GetOrderId() == "" || order.GetSellerUserId() == "" || order.GetStoreId() == "" || order.GetAmount() == nil {
			return nil, status.Error(codes.InvalidArgument, "every order needs an id, store, seller and amount")
		}
		mode := "escrow"
		if order.GetPaymentMode() == moneyv1.OrderPaymentMode_ORDER_PAYMENT_MODE_DIRECT {
			mode = "direct"
		}
		payables = append(payables, paymentmodels.OrderPayable{
			CheckoutId: request.GetCheckoutId(), OrderId: order.GetOrderId(), OrderReference: order.GetOrderReference(), BuyerUserId: request.GetBuyerUserId(),
			StoreId: order.GetStoreId(), SellerUserId: order.GetSellerUserId(), AmountMinor: order.GetAmount().GetAmountMinor(), Currency: order.GetAmount().GetCurrency(),
			ProductSummary: order.GetProductSummary(), PaymentMode: mode, StoreVerified: order.GetStoreVerified(),
		})
	}
	if err := controller.Application.Container.Payments.RegisterCheckoutPayables(ctx, payables); err != nil {
		return nil, convertApiErrorToStatus(err)
	}
	return &moneyv1.RegisterCheckoutPayablesResponse{RegisteredOrderCount: int32(len(payables))}, nil
}

var fulfilmentStages = map[moneyv1.FulfilmentStage]string{
	moneyv1.FulfilmentStage_FULFILMENT_STAGE_SHIPPED:   "shipped",
	moneyv1.FulfilmentStage_FULFILMENT_STAGE_DELIVERED: "delivered",
}

func (controller CheckoutMoneyGrpcController) RecordOrderFulfilment(ctx context.Context, request *moneyv1.RecordOrderFulfilmentRequest) (*moneyv1.RecordOrderFulfilmentResponse, error) {
	stage, known := fulfilmentStages[request.GetStage()]
	if !known || request.GetOrderId() == "" || request.GetOccurredAt() == nil {
		return nil, status.Error(codes.InvalidArgument, "order_id, a shipped or delivered stage and occurred_at are required")
	}
	fulfilment := services.OrderFulfilment{OrderId: request.GetOrderId(), Stage: stage, OccurredAt: request.GetOccurredAt().AsTime(),
		CourierName: request.GetCourierName(), TrackingNumber: request.GetTrackingNumber(), TrackingUrl: request.GetTrackingUrl()}
	if request.EstimatedDeliveryAt != nil {
		estimated := request.GetEstimatedDeliveryAt().AsTime()
		fulfilment.EstimatedDeliveryAt = &estimated
	}
	updated, err := recordorderfulfilment.Handler{Application: controller.Application}.Execute(ctx, recordorderfulfilment.Command{Fulfilment: fulfilment})
	if err != nil {
		return nil, convertApiErrorToStatus(err)
	}
	return &moneyv1.RecordOrderFulfilmentResponse{Escrow: ConvertEscrowToProto(updated)}, nil
}

func (controller CheckoutMoneyGrpcController) ConfirmOrderReceipt(ctx context.Context, request *moneyv1.ConfirmOrderReceiptRequest) (*moneyv1.ConfirmOrderReceiptResponse, error) {
	released, err := confirmorderreceipt.Handler{Application: controller.Application}.Execute(ctx, confirmorderreceipt.Command{OrderId: request.GetOrderId(), BuyerUserId: request.GetBuyerUserId()})
	if err != nil {
		return nil, convertApiErrorToStatus(err)
	}
	return &moneyv1.ConfirmOrderReceiptResponse{Escrow: ConvertEscrowToProto(released)}, nil
}

func (controller CheckoutMoneyGrpcController) GetOrderEscrow(ctx context.Context, request *moneyv1.GetOrderEscrowRequest) (*moneyv1.GetOrderEscrowResponse, error) {
	found, err := controller.Application.Container.Client(controller.Application.Container.Resources.Database).Escrow.Query().Where(escrow.OrderID(request.GetOrderId())).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, convertApiErrorToStatus(services.ErrEscrowNotFound)
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "internal error")
	}
	return &moneyv1.GetOrderEscrowResponse{Escrow: ConvertEscrowToProto(found)}, nil
}

func ConvertEscrowToProto(held *ent.Escrow) *moneyv1.OrderEscrow {
	money := func(amount int64) *commonv1.Money {
		return &commonv1.Money{AmountMinor: amount, Currency: held.Currency}
	}
	converted := &moneyv1.OrderEscrow{
		EscrowId: held.ID.String(), OrderId: held.OrderID, Status: string(held.Status), PaymentMode: moneyv1.OrderPaymentMode_ORDER_PAYMENT_MODE_ESCROW,
		HeldAmount: money(held.AmountMinor), PlatformFee: money(held.CommissionMinor), SellerAmount: money(held.SellerAmountMinor), RefundedAmount: money(held.RefundedMinor),
	}
	if held.PaymentMode == escrow.PaymentModeDirect {
		converted.PaymentMode = moneyv1.OrderPaymentMode_ORDER_PAYMENT_MODE_DIRECT
	}
	if held.AutoReleaseAt != nil {
		converted.AutoReleaseAt = timestamppb.New(*held.AutoReleaseAt)
	}
	if held.ReleasedAt != nil {
		converted.ReleasedAt = timestamppb.New(*held.ReleasedAt)
	}
	if held.RefundedAt != nil {
		converted.RefundedAt = timestamppb.New(*held.RefundedAt)
	}
	return converted
}

func convertApiErrorToStatus(err error) error {
	var apiError *httpserver.ApiError
	if !errors.As(err, &apiError) {
		return status.Error(codes.Internal, "internal error")
	}
	code := codes.FailedPrecondition
	switch apiError.Status {
	case http.StatusNotFound:
		code = codes.NotFound
	case http.StatusBadRequest:
		code = codes.InvalidArgument
	case http.StatusBadGateway, http.StatusServiceUnavailable:
		code = codes.Unavailable
	}
	detailed, detailError := status.New(code, apiError.Message).WithDetails(&errdetails.ErrorInfo{Reason: apiError.Code, Domain: "money.nantty.com", Metadata: encodeErrorDetails(apiError.Details)})
	if detailError != nil {
		return status.Error(code, apiError.Message)
	}
	return detailed.Err()
}

func encodeErrorDetails(details map[string]any) map[string]string {
	if len(details) == 0 {
		return nil
	}
	encoded, err := json.Marshal(details)
	if err != nil {
		return nil
	}
	return map[string]string{"details": string(encoded)}
}
