package integrations

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	moneyv1 "zudomart/contracts/gen/go/zudomart/money/v1"
	"zudomart/modules/live/src/interfaces"
)

type MoneyClient struct {
	connection *grpc.ClientConn
	service    moneyv1.LiveMoneyServiceClient
}

func DialMoneyService(address string) (*MoneyClient, error) {
	connection, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial money service: %w", err)
	}
	return &MoneyClient{connection: connection, service: moneyv1.NewLiveMoneyServiceClient(connection)}, nil
}

func (client *MoneyClient) Close() error { return client.connection.Close() }

func (client *MoneyClient) ChargeGiftAndCreditCreator(ctx context.Context, request interfaces.ChargeGiftRequest) (interfaces.ChargedGift, error) {
	message := &moneyv1.ChargeGiftAndCreditCreatorRequest{
		SenderUserId: request.SenderUserId, ReceiverUserId: request.ReceiverUserId, HostUserId: request.HostUserId, LiveId: request.LiveId,
		GiftId: request.GiftId, Quantity: int32(request.Quantity), UnitPriceCoins: request.UnitPriceCoins, IdempotencyKey: request.IdempotencyKey,
	}
	if request.BattleId != "" {
		message.BattleId = &request.BattleId
	}
	if request.ComboId != "" {
		message.ComboId = &request.ComboId
	}
	response, err := client.service.ChargeGiftAndCreditCreator(ctx, message)
	if err != nil {
		return interfaces.ChargedGift{}, translateMoneyError(err)
	}
	transaction := response.GetGiftTransaction()
	return interfaces.ChargedGift{
		GiftTransactionId: transaction.GetGiftTransactionId(), CreditedUserId: transaction.GetCreditedUserId(), TotalCoins: transaction.GetTotalCoins(),
		PlatformFeeCoins: transaction.GetPlatformFeeCoins(), CreatorAmountCoins: transaction.GetCreatorAmountCoins(),
		Status: describeGiftStatus(transaction.GetStatus()), LedgerTransactionId: transaction.GetLedgerTransactionId(),
		SenderCoinBalance: response.GetSenderCoinBalance(), CreatedAt: transaction.GetCreatedAt().AsTime(), Replayed: response.GetReplayed(),
	}, nil
}

func (client *MoneyClient) GetCoinBalance(ctx context.Context, userId string) (int64, error) {
	response, err := client.service.GetCoinBalance(ctx, &moneyv1.GetCoinBalanceRequest{UserId: userId})
	if err != nil {
		return 0, translateMoneyError(err)
	}
	return response.GetCoins(), nil
}

func describeGiftStatus(value moneyv1.GiftTransactionStatus) string {
	switch value {
	case moneyv1.GiftTransactionStatus_GIFT_TRANSACTION_STATUS_HELD_FOR_REVIEW:
		return "heldForReview"
	case moneyv1.GiftTransactionStatus_GIFT_TRANSACTION_STATUS_REVERSED:
		return "reversed"
	default:
		return "committed"
	}
}

func translateMoneyError(err error) error {
	grpcStatus, isStatus := status.FromError(err)
	if !isStatus {
		return err
	}
	reason := ""
	for _, detail := range grpcStatus.Details() {
		if info, isInfo := detail.(*errdetails.ErrorInfo); isInfo {
			reason = info.GetReason()
		}
	}
	switch {
	case reason == "INSUFFICIENT_COINS":
		return interfaces.ErrInsufficientCoins
	case reason == "CANNOT_GIFT_SELF":
		return interfaces.ErrCannotGiftSelf
	case reason == "IDEMPOTENCY_KEY_REUSED":
		return interfaces.ErrIdempotencyKeyReused
	case reason == "BATTLE_ALREADY_SETTLED_DIFFERENTLY":
		return interfaces.ErrBattleSettledDifferently
	case grpcStatus.Code() == codes.InvalidArgument:
		return errors.Join(interfaces.ErrMoneyRequestInvalid, err)
	}
	return err
}

func (client *MoneyClient) GetBattleGiftTotals(ctx context.Context, battleId string) ([]interfaces.BattleGiftTotal, error) {
	response, err := client.service.GetBattleGiftTotals(ctx, &moneyv1.GetBattleGiftTotalsRequest{BattleId: battleId})
	if err != nil {
		return nil, translateMoneyError(err)
	}
	totals := make([]interfaces.BattleGiftTotal, 0, len(response.GetTotals()))
	for _, total := range response.GetTotals() {
		totals = append(totals, interfaces.BattleGiftTotal{ReceiverUserId: total.GetReceiverUserId(), GrossCoins: total.GetGrossCoins(), GiftCount: total.GetGiftCount()})
	}
	return totals, nil
}
