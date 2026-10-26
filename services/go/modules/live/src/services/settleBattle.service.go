package services

import (
	"context"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/types"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
)

const settlementCallTimeout = 10 * time.Second

func (service *LiveService) SettleEndedBattlesForLive(ctx context.Context, liveId uuid.UUID) error {
	identifiers, err := service.Client.Battle.Query().Where(battlerecord.LiveID(liveId), battlerecord.StateEQ(battlerecord.StateEnded)).IDs(ctx)
	if err != nil {
		return err
	}
	return service.settleEach(ctx, identifiers)
}

func (service *LiveService) SettleDueBattles(ctx context.Context) error {
	identifiers, err := service.Client.Battle.Query().Where(battlerecord.StateEQ(battlerecord.StateEnded)).Order(ent.Asc(battlerecord.FieldEndsAt)).Limit(20).IDs(ctx)
	if err != nil {
		return err
	}
	return service.settleEach(ctx, identifiers)
}

func (service *LiveService) settleEach(ctx context.Context, identifiers []uuid.UUID) error {
	var firstFailure error
	for _, identifier := range identifiers {
		if err := service.SettleBattle(ctx, identifier); err != nil && firstFailure == nil {
			firstFailure = err
		}
	}
	return firstFailure
}

func (service *LiveService) SettleBattle(ctx context.Context, battleId uuid.UUID) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		battle, err := service.lockBattle(ctx, tx, battleId)
		if err != nil || battle.State != battlerecord.StateEnded {
			return err
		}
		rows, err := service.loadParticipants(ctx, tx, battleId)
		if err != nil {
			return err
		}
		request := buildSettlementRequest(battle, rows)
		callContext, cancel := context.WithTimeout(ctx, settlementCallTimeout)
		defer cancel()
		settlement, err := service.Money.SettleBattle(callContext, request)
		if err != nil {
			return err
		}
		next, err := NextBattleState(BattleState(battle.State), SettlementCommitted)
		if err != nil {
			return err
		}
		stored := buildStoredSettlement(rows, settlement)
		saved, err := battle.Update().SetState(battlerecord.State(next)).SetSettledAt(settlement.SettledAt).SetSettlement(writeStoredSettlement(stored)).Save(ctx)
		if err != nil {
			return err
		}
		return service.announceSettlement(ctx, tx, saved, stored)
	})
}

func buildSettlementRequest(battle *ent.Battle, rows []*ent.BattleParticipant) interfaces.SettleBattleRequest {
	request := interfaces.SettleBattleRequest{BattleId: battle.ID.String(), LiveId: battle.LiveID.String(), HostUserId: battle.HostID.String(), Rule: interfaces.SettlementRuleKeepOwn}
	if len(battle.WinnerUserIds) == 1 {
		request.WinnerUserId = battle.WinnerUserIds[0]
		if battle.WinnerTakesAll {
			request.Rule = interfaces.SettlementRuleWinnerTA
		}
	}
	for _, row := range rows {
		outcome := interfaces.OutcomeActive
		switch {
		case row.RemovedByHost:
			outcome = interfaces.OutcomeRemovedByHost
		case string(row.State) == string(ParticipantForfeited), string(row.State) == string(ParticipantLeft):
			outcome = interfaces.OutcomeForfeited
		}
		request.Participants = append(request.Participants, interfaces.SettlementParticipant{UserId: row.UserID.String(), Outcome: outcome})
	}
	return request
}

func buildStoredSettlement(rows []*ent.BattleParticipant, settlement interfaces.BattleSettlement) StoredSettlement {
	stored := StoredSettlement{RuleApplied: settlement.RuleApplied, LedgerTransactionId: settlement.LedgerTransactionId}
	earned := map[string]int64{}
	for _, payout := range settlement.Payouts {
		earned[payout.CreditedUserId] += payout.HoldingCoins
	}
	paidTo := map[string]string{}
	for _, payout := range settlement.Payouts {
		paidTo[payout.UserId] = payout.CreditedUserId
	}
	moved := map[string]bool{}
	for _, transfer := range settlement.Transfers {
		stored.Transfers = append(stored.Transfers, types.BattleTransferView{FromUserId: transfer.FromUserId, ToUserId: transfer.ToUserId, Coins: transfer.Coins})
		moved[transfer.FromUserId] = true
	}
	for _, row := range rows {
		user := row.UserID.String()
		recipient := paidTo[user]
		if moved[user] || recipient == "" {
			recipient = user
		}
		stored.Payouts = append(stored.Payouts, types.BattlePayoutView{UserId: user, Score: row.Score, EarnedCoins: earned[user], PaidToUserId: recipient})
	}
	return stored
}

func (service *LiveService) announceSettlement(ctx context.Context, tx *ent.Tx, battle *ent.Battle, stored StoredSettlement) error {
	now := service.Now()
	liveId, battleId := battle.LiveID.String(), battle.ID.String()
	if len(stored.Transfers) > 0 {
		err := events.EnqueueOutboxEventInTransaction(ctx, tx, events.BattleSettled, liveId, now, map[string]any{"liveId": liveId, "battleId": battleId, "transfers": stored.Transfers})
		if err != nil {
			return err
		}
	}
	if len(battle.WinnerUserIds) == 1 {
		view, err := service.presentBattle(ctx, tx.Client(), battle)
		if err != nil {
			return err
		}
		err = events.EnqueueOutboxEventInTransaction(ctx, tx, events.BattleWinnerCelebrated, liveId, now, map[string]any{
			"liveId": liveId, "battleId": battleId, "winnerUserIds": battle.WinnerUserIds, "mvpGifter": view.MvpGifter, "animationAssetId": events.WinnerCelebrationAnimationId,
		})
		if err != nil {
			return err
		}
	}
	return service.emitStageUpdated(ctx, tx, battle.LiveID)
}
