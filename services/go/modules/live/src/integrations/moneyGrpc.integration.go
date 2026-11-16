package integrations

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	"nantty/modules/live/src/interfaces"
)

type MoneyClient struct {
	connection *grpc.ClientConn
	service    moneyv1.LiveMoneyServiceClient
	options    InternalGrpcOptions
}

func NewMoneyClient(service moneyv1.LiveMoneyServiceClient, options InternalGrpcOptions) *MoneyClient {
	return &MoneyClient{service: service, options: options}
}

func DialMoneyService(options InternalGrpcOptions) (*MoneyClient, error) {
	connection, err := dialInternalGrpcService(options)
	if err != nil {
		return nil, fmt.Errorf("dial money service: %w", err)
	}
	return &MoneyClient{connection: connection, service: moneyv1.NewLiveMoneyServiceClient(connection), options: options}, nil
}

func (client *MoneyClient) Close() error {
	if client.connection == nil {
		return nil
	}
	return client.connection.Close()
}

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
	response, err := CallWithRetryOnUnavailable(ctx, client.options, request.IdempotencyKey != "", func(attempt context.Context) (*moneyv1.ChargeGiftAndCreditCreatorResponse, error) {
		return client.service.ChargeGiftAndCreditCreator(attempt, message)
	})
	if err != nil {
		return interfaces.ChargedGift{}, TranslateMoneyError(err)
	}
	transaction := response.GetGiftTransaction()
	return interfaces.ChargedGift{
		GiftTransactionId: transaction.GetGiftTransactionId(), CreditedUserId: transaction.GetCreditedUserId(), TotalCoins: transaction.GetTotalCoins(),
		PlatformFeeCoins: transaction.GetPlatformFeeCoins(), CreatorAmountCoins: transaction.GetCreatorAmountCoins(),
		Status: describeGiftStatus(transaction.GetStatus()), LedgerTransactionId: transaction.GetLedgerTransactionId(),
		SenderCoinBalance: response.GetSenderCoinBalance(), CreatedAt: transaction.GetCreatedAt().AsTime(), Replayed: response.GetReplayed(),
	}, nil
}

func (client *MoneyClient) ChargeSpaceCoinGift(ctx context.Context, request interfaces.ChargeSpaceCoinGiftRequest) (interfaces.SpaceCoinGiftReceipt, error) {
	message := &moneyv1.ChargeSpaceCoinGiftRequest{
		SenderUserId:   request.SenderUserId,
		SpaceId:        request.SpaceId,
		GiftId:         request.GiftId,
		Quantity:       int32(request.Quantity),
		IdempotencyKey: request.IdempotencyKey,
	}
	response, err := CallWithRetryOnUnavailable(ctx, client.options, request.IdempotencyKey != "", func(attempt context.Context) (*moneyv1.ChargeSpaceCoinGiftResponse, error) {
		return client.service.ChargeSpaceCoinGift(attempt, message)
	})
	if err != nil {
		return interfaces.SpaceCoinGiftReceipt{}, TranslateMoneyError(err)
	}
	return interfaces.SpaceCoinGiftReceipt{
		GiftTransactionId:   response.GetGiftTransactionId(),
		LedgerTransactionId: response.GetLedgerTransactionId(),
		SenderUserId:        response.GetSenderUserId(),
		HostUserId:          response.GetHostUserId(),
		SpaceId:             response.GetSpaceId(),
		GiftId:              response.GetGiftId(),
		Quantity:            int(response.GetQuantity()),
		UnitPriceCoins:      response.GetUnitPriceCoins(),
		TotalCoins:          response.GetTotalCoins(),
		PlatformFeeCoins:    response.GetPlatformFeeCoins(),
		CreatorAmountCoins:  response.GetCreatorAmountCoins(),
		SenderCoinBalance:   response.GetSenderCoinBalance(),
		Replayed:            response.GetReplayed(),
	}, nil
}

func (client *MoneyClient) DonateSpaceCoins(ctx context.Context, request interfaces.DonateSpaceCoinsRequest) (interfaces.SpaceCoinDonationReceipt, error) {
	message := &moneyv1.DonateSpaceCoinsRequest{SenderUserId: request.SenderUserId, SpaceId: request.SpaceId, Coins: request.Coins, IdempotencyKey: request.IdempotencyKey}
	response, err := CallWithRetryOnUnavailable(ctx, client.options, request.IdempotencyKey != "", func(attempt context.Context) (*moneyv1.DonateSpaceCoinsResponse, error) {
		return client.service.DonateSpaceCoins(attempt, message)
	})
	if err != nil {
		return interfaces.SpaceCoinDonationReceipt{}, TranslateMoneyError(err)
	}
	return interfaces.SpaceCoinDonationReceipt{DonationId: response.GetDonationId(), LedgerTransactionId: response.GetLedgerTransactionId(),
		SenderUserId: response.GetSenderUserId(), HostUserId: response.GetHostUserId(), SpaceId: response.GetSpaceId(),
		TotalCoins: response.GetTotalCoins(), PlatformFeeCoins: response.GetPlatformFeeCoins(), CreatorAmountCoins: response.GetCreatorAmountCoins(),
		SenderCoinBalance: response.GetSenderCoinBalance(), Replayed: response.GetReplayed()}, nil
}

func (client *MoneyClient) ContributeBattleCoins(ctx context.Context, request interfaces.BattleCoinContributionRequest) (interfaces.BattleCoinContributionReceipt, error) {
	message := &moneyv1.ContributeBattleCoinsRequest{SenderUserId: request.SenderUserId, RecipientUserId: request.RecipientUserId,
		BattleId: request.BattleId, Coins: request.Coins, IdempotencyKey: request.IdempotencyKey}
	response, err := CallWithRetryOnUnavailable(ctx, client.options, request.IdempotencyKey != "", func(attempt context.Context) (*moneyv1.ContributeBattleCoinsResponse, error) {
		return client.service.ContributeBattleCoins(attempt, message)
	})
	if err != nil {
		return interfaces.BattleCoinContributionReceipt{}, TranslateMoneyError(err)
	}
	return interfaces.BattleCoinContributionReceipt{ContributionId: response.GetContributionId(), LedgerTransactionId: response.GetLedgerTransactionId(),
		SenderUserId: response.GetSenderUserId(), RecipientUserId: response.GetRecipientUserId(), BattleId: response.GetBattleId(), LiveId: response.GetLiveId(),
		TotalCoins: response.GetTotalCoins(), PlatformFeeCoins: response.GetPlatformFeeCoins(), HoldingCoins: response.GetHoldingCoins(),
		SenderCoinBalance: response.GetSenderCoinBalance(), Replayed: response.GetReplayed()}, nil
}

func (client *MoneyClient) GetCoinBalance(ctx context.Context, userId string) (int64, error) {
	response, err := CallWithRetryOnUnavailable(ctx, client.options, true, func(attempt context.Context) (*moneyv1.GetCoinBalanceResponse, error) {
		return client.service.GetCoinBalance(attempt, &moneyv1.GetCoinBalanceRequest{UserId: userId})
	})
	if err != nil {
		return 0, TranslateMoneyError(err)
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

func TranslateMoneyError(err error) error {
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
	case reason == "INVALID_DONATION_AMOUNT":
		var minimum, maximum int64
		for _, detail := range grpcStatus.Details() {
			if info, isInfo := detail.(*errdetails.ErrorInfo); isInfo {
				minimum, _ = strconv.ParseInt(info.GetMetadata()["minimumCoins"], 10, 64)
				maximum, _ = strconv.ParseInt(info.GetMetadata()["maximumCoins"], 10, 64)
			}
		}
		return &interfaces.DonationAmountPolicyError{MinimumCoins: minimum, MaximumCoins: maximum}
	case reason == "CANNOT_DONATE_TO_SELF":
		return interfaces.ErrCannotGiftSelf
	case reason == "CANNOT_CONTRIBUTE_TO_SELF":
		return interfaces.ErrCannotGiftSelf
	case reason == "IDEMPOTENCY_KEY_REUSED":
		return interfaces.ErrIdempotencyKeyReused
	case reason == "BATTLE_NOT_ACTIVE":
		return interfaces.ErrBattleNotActive
	case reason == "BATTLE_PARTICIPANT_INACTIVE":
		return interfaces.ErrBattleParticipantInactive
	case reason == "RECIPIENT_CANNOT_RECEIVE_COINS":
		return interfaces.ErrBattleRecipientIneligible
	case reason == "INVALID_BATTLE_CONTRIBUTION_AMOUNT":
		var minimum, maximum int64
		for _, detail := range grpcStatus.Details() {
			if info, isInfo := detail.(*errdetails.ErrorInfo); isInfo {
				minimum, _ = strconv.ParseInt(info.GetMetadata()["minimumCoins"], 10, 64)
				maximum, _ = strconv.ParseInt(info.GetMetadata()["maximumCoins"], 10, 64)
			}
		}
		return &interfaces.BattleContributionAmountPolicyError{MinimumCoins: minimum, MaximumCoins: maximum}
	case reason == "SPACE_DONATIONS_DISABLED":
		return interfaces.ErrSpaceDonationsDisabled
	case reason == "SPACE_DONATION_BLOCKED":
		return interfaces.ErrSpaceDonationBlocked
	case reason == "SPACE_DONATION_UNAVAILABLE":
		return interfaces.ErrSpaceDonationUnavailable
	case reason == "CANNOT_GIFT_SELF":
		return interfaces.ErrCannotGiftSelf
	case reason == "RECIPIENT_CANNOT_RECEIVE_GIFTS":
		return interfaces.ErrRecipientCannotReceiveGifts
	case reason == "LIVE_COIN_SUPPORT_DISABLED":
		return interfaces.ErrLiveCoinSupportDisabled
	case reason == "LIVE_NOT_ACTIVE":
		return interfaces.ErrLiveNotActive
	case reason == "IDEMPOTENCY_KEY_REUSED":
		return interfaces.ErrIdempotencyKeyReused
	case reason == "BATTLE_ALREADY_SETTLED_DIFFERENTLY":
		return interfaces.ErrBattleSettledDifferently
	case reason == "SPACE_GIFTS_DISABLED":
		return interfaces.ErrSpaceGiftsDisabled
	case reason == "SPACE_GIFT_UNAVAILABLE" || reason == "SPACE_NOT_FOUND":
		return interfaces.ErrSpaceGiftUnavailable
	case reason == "SPACE_HOST_NOT_CREATOR":
		return interfaces.ErrSpaceHostNotCreator
	case reason == "SPACE_GIFT_BLOCKED":
		return interfaces.ErrSpaceGiftBlocked
	case reason == "SPACE_NOT_FOUND":
		return interfaces.ErrSpaceGiftUnavailable
	case grpcStatus.Code() == codes.InvalidArgument:
		return errors.Join(interfaces.ErrMoneyRequestInvalid, err)
	}
	return err
}

func (client *MoneyClient) GetBattleGiftTotals(ctx context.Context, battleId string) ([]interfaces.BattleGiftTotal, error) {
	response, err := CallWithRetryOnUnavailable(ctx, client.options, true, func(attempt context.Context) (*moneyv1.GetBattleGiftTotalsResponse, error) {
		return client.service.GetBattleGiftTotals(attempt, &moneyv1.GetBattleGiftTotalsRequest{BattleId: battleId})
	})
	if err != nil {
		return nil, TranslateMoneyError(err)
	}
	totals := make([]interfaces.BattleGiftTotal, 0, len(response.GetTotals()))
	for _, total := range response.GetTotals() {
		totals = append(totals, interfaces.BattleGiftTotal{ReceiverUserId: total.GetReceiverUserId(), GrossCoins: total.GetGrossCoins(), GiftCount: total.GetGiftCount()})
	}
	return totals, nil
}
