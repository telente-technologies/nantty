package controllers

import (
	"context"
	"errors"
	"log/slog"
	"regexp"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	commonv1 "nantty/contracts/gen/go/zudomart/common/v1"
	moneyv1 "nantty/contracts/gen/go/zudomart/money/v1"
	"nantty/modules/wallet/src/modules/adBalances/dtos"
	"nantty/modules/wallet/src/modules/adBalances/services"
	"nantty/platform/httpserver"
)

var grpcIdempotencyKeyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{8,128}$`)

type AdsMoneyGrpcController struct {
	moneyv1.UnimplementedAdsMoneyServiceServer
	Balances services.AdBalances
	Logger   *slog.Logger
}

func (controller AdsMoneyGrpcController) DebitWalletForBoost(ctx context.Context, request *moneyv1.DebitWalletForBoostRequest) (*moneyv1.DebitWalletForBoostResponse, error) {
	body, err := convertBoostRequest(request.GetUserId(), request.GetAmount(), request.GetIdempotencyKey(), "", false)
	if err != nil {
		return nil, err
	}
	result, err := controller.Balances.DebitForBoost(ctx, body)
	if err != nil {
		return nil, controller.convertError(ctx, err)
	}
	return &moneyv1.DebitWalletForBoostResponse{LedgerTransactionId: result.LedgerTransactionId, BalanceAfter: convertMoney(result.BalanceAfter), DebitedAt: timestamppb.Now(), Replayed: result.Replayed}, nil
}

func (controller AdsMoneyGrpcController) RefundBoostRemainder(ctx context.Context, request *moneyv1.RefundBoostRemainderRequest) (*moneyv1.RefundBoostRemainderResponse, error) {
	body, err := convertBoostRequest(request.GetUserId(), request.GetAmount(), request.GetIdempotencyKey(), request.GetDebitIdempotencyKey(), true)
	if err != nil {
		return nil, err
	}
	result, err := controller.Balances.RefundBoostRemainder(ctx, body)
	if err != nil {
		return nil, controller.convertError(ctx, err)
	}
	return &moneyv1.RefundBoostRemainderResponse{LedgerTransactionId: result.LedgerTransactionId, BalanceAfter: convertMoney(result.BalanceAfter), Replayed: result.Replayed}, nil
}

func convertBoostRequest(userId string, amount *commonv1.Money, idempotencyKey, debitIdempotencyKey string, refund bool) (dtos.BoostDebitRequestDto, error) {
	valid := userId != "" && len(userId) <= 80 && amount != nil && amount.GetAmountMinor() > 0 && amount.GetAmountMinor() <= 10_000_000_000 &&
		amount.GetCurrency() == "NGN" && grpcIdempotencyKeyPattern.MatchString(idempotencyKey) && (!refund || grpcIdempotencyKeyPattern.MatchString(debitIdempotencyKey))
	if !valid {
		return dtos.BoostDebitRequestDto{}, statusWithReason(codes.InvalidArgument, "VALIDATION_FAILED", "The boost money request is invalid.")
	}
	return dtos.BoostDebitRequestDto{UserId: userId, Amount: dtos.MoneyDto{AmountMinor: amount.GetAmountMinor(), Currency: amount.GetCurrency()}, IdempotencyKey: idempotencyKey, DebitIdempotencyKey: debitIdempotencyKey}, nil
}

func convertMoney(value dtos.MoneyDto) *commonv1.Money {
	return &commonv1.Money{AmountMinor: value.AmountMinor, Currency: value.Currency}
}

func (controller AdsMoneyGrpcController) convertError(ctx context.Context, err error) error {
	switch {
	case errors.Is(err, services.ErrInsufficientFunds):
		return statusWithReason(codes.FailedPrecondition, "INSUFFICIENT_FUNDS", "The ad balance is too low.")
	case errors.Is(err, services.ErrIdempotencyKeyReused):
		return statusWithReason(codes.AlreadyExists, "IDEMPOTENCY_KEY_REUSED", "This key was used for a different request.")
	case errors.Is(err, services.ErrRefundAboveDebit):
		return statusWithReason(codes.InvalidArgument, "VALIDATION_FAILED", "The refund is larger than what is left of the debit.")
	}
	var apiError *httpserver.ApiError
	if errors.As(err, &apiError) {
		return statusWithReason(codes.FailedPrecondition, apiError.Code, apiError.Message)
	}
	controller.Logger.ErrorContext(ctx, "ads money call failed", slog.Any("error", err))
	return status.Error(codes.Internal, "internal error")
}

func statusWithReason(code codes.Code, reason, message string) error {
	described, err := status.New(code, message).WithDetails(&errdetails.ErrorInfo{Reason: reason, Domain: "money.zudomart.com"})
	if err != nil {
		return status.Error(code, message)
	}
	return described.Err()
}
