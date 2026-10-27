package controllers

import (
	"context"
	"errors"
	"log/slog"
	"strconv"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/modules/liveMoney/models"
	"nantty/modules/creators/src/modules/liveMoney/services"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

type LiveMoneyGrpcController struct {
	moneyv1.UnimplementedLiveMoneyServiceServer
	LiveMoney services.LiveMoney
	Logger    *slog.Logger
}

func (controller LiveMoneyGrpcController) ChargeGiftAndCreditCreator(ctx context.Context, request *moneyv1.ChargeGiftAndCreditCreatorRequest) (*moneyv1.ChargeGiftAndCreditCreatorResponse, error) {
	charged, err := controller.LiveMoney.ChargeGiftAndCreditCreator(ctx, services.ChargeGiftRequest{
		SenderUserId: request.GetSenderUserId(), ReceiverUserId: request.GetReceiverUserId(), HostUserId: request.GetHostUserId(),
		LiveId: request.GetLiveId(), GiftId: request.GetGiftId(), Quantity: int64(request.GetQuantity()), UnitPriceCoins: request.GetUnitPriceCoins(),
		BattleId: request.GetBattleId(), ComboId: request.GetComboId(), IdempotencyKey: request.GetIdempotencyKey(),
	})
	if err != nil {
		return nil, controller.convertError(ctx, err)
	}
	return &moneyv1.ChargeGiftAndCreditCreatorResponse{GiftTransaction: convertGiftTransaction(charged.Transaction), SenderCoinBalance: charged.SenderCoinBalance, Replayed: charged.Replayed}, nil
}

func (controller LiveMoneyGrpcController) ChargeSpaceCoinGift(ctx context.Context, request *moneyv1.ChargeSpaceCoinGiftRequest) (*moneyv1.ChargeSpaceCoinGiftResponse, error) {
	receipt, err := controller.LiveMoney.ChargeSpaceCoinGift(ctx, services.SpaceCoinGiftRequest{
		SenderUserID: request.GetSenderUserId(), SpaceID: request.GetSpaceId(),
		GiftID: request.GetGiftId(), Quantity: int64(request.GetQuantity()), IdempotencyKey: request.GetIdempotencyKey(),
	})
	if err != nil {
		return nil, controller.convertError(ctx, err)
	}
	return &moneyv1.ChargeSpaceCoinGiftResponse{
		GiftTransactionId: receipt.GiftTransactionID, LedgerTransactionId: receipt.LedgerEntryID,
		SenderUserId: receipt.SenderUserID, HostUserId: receipt.HostUserID, SpaceId: receipt.SpaceID, GiftId: receipt.GiftID,
		Quantity: int32(receipt.Quantity), UnitPriceCoins: receipt.UnitPriceCoins, TotalCoins: receipt.TotalCoins,
		PlatformFeeCoins: receipt.PlatformFeeCoins, CreatorAmountCoins: receipt.CreatorAmount,
		SenderCoinBalance: receipt.SenderBalance, Replayed: receipt.Replayed,
	}, nil
}

var participantOutcomes = map[moneyv1.BattleParticipantOutcome]models.ParticipantOutcome{
	moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_ACTIVE:          models.OutcomeActive,
	moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_FORFEITED:       models.OutcomeForfeited,
	moneyv1.BattleParticipantOutcome_BATTLE_PARTICIPANT_OUTCOME_REMOVED_BY_HOST: models.OutcomeRemovedByHost,
}

var settlementRules = map[moneyv1.BattleSettlementRule]string{
	moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_KEEP_OWN:         "keepOwn",
	moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_WINNER_TAKES_ALL: "winnerTakesAll",
}

func (controller LiveMoneyGrpcController) SettleBattle(ctx context.Context, request *moneyv1.SettleBattleRequest) (*moneyv1.SettleBattleResponse, error) {
	participants := make([]services.BattleParticipantRequest, 0, len(request.GetParticipants()))
	for _, participant := range request.GetParticipants() {
		outcome, known := participantOutcomes[participant.GetOutcome()]
		if !known {
			outcome = models.OutcomeActive
		}
		participants = append(participants, services.BattleParticipantRequest{UserId: participant.GetUserId(), Outcome: outcome})
	}
	settled, err := controller.LiveMoney.SettleBattle(ctx, services.SettleBattleRequest{
		BattleId: request.GetBattleId(), LiveId: request.GetLiveId(), HostUserId: request.GetHostUserId(),
		Rule: settlementRules[request.GetRule()], WinnerUserId: request.GetWinnerUserId(), Participants: participants,
	})
	if err != nil {
		return nil, controller.convertError(ctx, err)
	}
	settlement := &moneyv1.BattleSettlement{BattleId: settled.Settlement.BattleID, SettledAt: timestamppb.New(settled.Settlement.CreatedAt)}
	settlement.RuleApplied = moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_KEEP_OWN
	if string(settled.Settlement.RuleApplied) == "winnerTakesAll" {
		settlement.RuleApplied = moneyv1.BattleSettlementRule_BATTLE_SETTLEMENT_RULE_WINNER_TAKES_ALL
		winner := settled.Settlement.WinnerUserID
		settlement.WinnerUserId = &winner
	}
	if settled.Settlement.LedgerEntryID != nil {
		settlement.LedgerTransactionId = settled.Settlement.LedgerEntryID.String()
	}
	for _, payout := range settled.Payouts {
		settlement.Payouts = append(settlement.Payouts, &moneyv1.BattleParticipantPayout{UserId: payout.UserId, HoldingCoins: payout.HoldingCoins, CreditedUserId: payout.CreditedUserId})
	}
	for _, transfer := range settled.Transfers {
		settlement.Transfers = append(settlement.Transfers, &moneyv1.BattleCoinTransfer{FromUserId: transfer.FromUserId, ToUserId: transfer.ToUserId, Coins: transfer.Coins})
	}
	return &moneyv1.SettleBattleResponse{Settlement: settlement, Replayed: settled.Replayed}, nil
}

func (controller LiveMoneyGrpcController) GetBattleGiftTotals(ctx context.Context, request *moneyv1.GetBattleGiftTotalsRequest) (*moneyv1.GetBattleGiftTotalsResponse, error) {
	totals, err := controller.LiveMoney.ReadBattleGiftTotals(ctx, request.GetBattleId())
	if err != nil {
		return nil, controller.convertError(ctx, err)
	}
	response := &moneyv1.GetBattleGiftTotalsResponse{}
	for _, total := range totals {
		response.Totals = append(response.Totals, &moneyv1.BattleGiftTotal{ReceiverUserId: total.ReceiverUserId, GrossCoins: total.GrossCoins, GiftCount: total.GiftCount, ReachedAt: timestamppb.New(total.ReachedAt)})
	}
	return response, nil
}

func (controller LiveMoneyGrpcController) GetCoinBalance(ctx context.Context, request *moneyv1.GetCoinBalanceRequest) (*moneyv1.GetCoinBalanceResponse, error) {
	if request.GetUserId() == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}
	spendable, earned := ledgermodels.UserSpendableCoinsAccount(request.GetUserId()), ledgermodels.CreatorEarnedCoinsAccount(request.GetUserId())
	balances, err := controller.LiveMoney.Container.Ledger.ReadAccountBalances(ctx, controller.LiveMoney.Container.Resources.Database, []ledgermodels.AccountRef{spendable, earned})
	if err != nil {
		return nil, controller.convertError(ctx, err)
	}
	return &moneyv1.GetCoinBalanceResponse{Coins: balances[spendable.Key()], EarnedCoins: balances[earned.Key()]}, nil
}

func (controller LiveMoneyGrpcController) convertError(ctx context.Context, err error) error {
	var failure *services.LiveMoneyError
	switch {
	case errors.As(err, &failure):
		code := codes.InvalidArgument
		if failure.Precondition {
			code = codes.FailedPrecondition
		}
		information := &errdetails.ErrorInfo{Reason: failure.Reason, Domain: "money.nantty.com", Metadata: map[string]string{}}
		if failure.CoinBalance != nil {
			information.Metadata["coinBalance"] = strconv.FormatInt(*failure.CoinBalance, 10)
		}
		return withErrorInfo(code, failure.Message, information)
	case errors.Is(err, services.ErrIdempotencyKeyReused):
		return withErrorInfo(codes.AlreadyExists, "This idempotency key was used with a different request.", &errdetails.ErrorInfo{Reason: "IDEMPOTENCY_KEY_REUSED", Domain: "money.nantty.com"})
	}
	controller.Logger.ErrorContext(ctx, "live money request failed", slog.Any("error", err))
	return status.Error(codes.Internal, "internal error")
}

func withErrorInfo(code codes.Code, message string, information *errdetails.ErrorInfo) error {
	detailed, err := status.New(code, message).WithDetails(information)
	if err != nil {
		return status.Error(code, message)
	}
	return detailed.Err()
}

func convertGiftTransaction(gift *ent.GiftTransaction) *moneyv1.GiftTransaction {
	converted := &moneyv1.GiftTransaction{
		GiftTransactionId: gift.ID.String(), SenderUserId: gift.SenderUserID, ReceiverUserId: gift.ReceiverUserID, CreditedUserId: gift.CreditedUserID,
		LiveId: gift.LiveID, GiftId: gift.GiftID, Quantity: int32(gift.Quantity), UnitPriceCoins: gift.UnitPriceCoins, TotalCoins: gift.TotalCoins,
		PlatformFeeCoins: gift.PlatformFeeCoins, CreatorAmountCoins: gift.CreatorAmountCoins, CreatorShareBps: int32(gift.CreatorShareBps),
		Status: moneyv1.GiftTransactionStatus_GIFT_TRANSACTION_STATUS_COMMITTED, LedgerTransactionId: gift.LedgerEntryID.String(), CreatedAt: timestamppb.New(gift.CreatedAt),
	}
	if gift.BattleID != "" {
		battleId := gift.BattleID
		converted.BattleId = &battleId
	}
	if gift.ComboID != "" {
		comboId := gift.ComboID
		converted.ComboId = &comboId
	}
	return converted
}
