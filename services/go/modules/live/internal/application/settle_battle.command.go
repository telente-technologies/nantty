package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	battlerecord "zudomart/modules/live/internal/ent/battle"
	"zudomart/modules/live/internal/ports"
)

const settlementCallTimeout = 10 * time.Second

func (application *LiveApplication) SettleEndedBattlesForLive(ctx context.Context, liveId uuid.UUID) error {
	identifiers, err := application.Client.Battle.Query().Where(battlerecord.LiveID(liveId), battlerecord.StateEQ(battlerecord.StateEnded)).IDs(ctx)
	if err != nil {
		return err
	}
	return application.settleEach(ctx, identifiers)
}

func (application *LiveApplication) SettleDueBattles(ctx context.Context) error {
	identifiers, err := application.Client.Battle.Query().Where(battlerecord.StateEQ(battlerecord.StateEnded)).Order(ent.Asc(battlerecord.FieldEndsAt)).Limit(20).IDs(ctx)
	if err != nil {
		return err
	}
	return application.settleEach(ctx, identifiers)
}

func (application *LiveApplication) settleEach(ctx context.Context, identifiers []uuid.UUID) error {
	var firstFailure error
	for _, identifier := range identifiers {
		if err := application.SettleBattle(ctx, identifier); err != nil && firstFailure == nil {
			firstFailure = err
		}
	}
	return firstFailure
}

func (application *LiveApplication) SettleBattle(ctx context.Context, battleId uuid.UUID) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		battle, err := application.lockBattle(ctx, tx, battleId)
		if err != nil || battle.State != battlerecord.StateEnded {
			return err
		}
		rows, err := application.loadParticipants(ctx, tx, battleId)
		if err != nil {
			return err
		}
		request := buildSettlementRequest(battle, rows)
		callContext, cancel := context.WithTimeout(ctx, settlementCallTimeout)
		defer cancel()
		settlement, err := application.Money.SettleBattle(callContext, request)
		if err != nil {
			return err
		}
		next, err := domain.NextBattleState(domain.BattleState(battle.State), domain.SettlementCommitted)
		if err != nil {
			return err
		}
		stored := buildStoredSettlement(rows, settlement)
		saved, err := battle.Update().SetState(battlerecord.State(next)).SetSettledAt(settlement.SettledAt).SetSettlement(writeStoredSettlement(stored)).Save(ctx)
		if err != nil {
			return err
		}
		return application.announceSettlement(ctx, tx, saved, stored)
	})
}

func buildSettlementRequest(battle *ent.Battle, rows []*ent.BattleParticipant) ports.SettleBattleRequest {
	request := ports.SettleBattleRequest{BattleId: battle.ID.String(), LiveId: battle.LiveID.String(), HostUserId: battle.HostID.String(), Rule: ports.SettlementRuleKeepOwn}
	if len(battle.WinnerUserIds) == 1 {
		request.WinnerUserId = battle.WinnerUserIds[0]
		if battle.WinnerTakesAll {
			request.Rule = ports.SettlementRuleWinnerTA
		}
	}
	for _, row := range rows {
		outcome := ports.OutcomeActive
		switch {
		case row.RemovedByHost:
			outcome = ports.OutcomeRemovedByHost
		case string(row.State) == string(domain.ParticipantForfeited), string(row.State) == string(domain.ParticipantLeft):
			outcome = ports.OutcomeForfeited
		}
		request.Participants = append(request.Participants, ports.SettlementParticipant{UserId: row.UserID.String(), Outcome: outcome})
	}
	return request
}

func buildStoredSettlement(rows []*ent.BattleParticipant, settlement ports.BattleSettlement) StoredSettlement {
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
		stored.Transfers = append(stored.Transfers, BattleTransferView{FromUserId: transfer.FromUserId, ToUserId: transfer.ToUserId, Coins: transfer.Coins})
		moved[transfer.FromUserId] = true
	}
	for _, row := range rows {
		user := row.UserID.String()
		recipient := paidTo[user]
		if moved[user] || recipient == "" {
			recipient = user
		}
		stored.Payouts = append(stored.Payouts, BattlePayoutView{UserId: user, Score: row.Score, EarnedCoins: earned[user], PaidToUserId: recipient})
	}
	return stored
}

func (application *LiveApplication) announceSettlement(ctx context.Context, tx *ent.Tx, battle *ent.Battle, stored StoredSettlement) error {
	now := application.Now()
	liveId, battleId := battle.LiveID.String(), battle.ID.String()
	if len(stored.Transfers) > 0 {
		err := enqueueOutboxEventInTransaction(ctx, tx, eventBattleSettled, liveId, now, map[string]any{"liveId": liveId, "battleId": battleId, "transfers": stored.Transfers})
		if err != nil {
			return err
		}
	}
	if len(battle.WinnerUserIds) == 1 {
		view, err := application.presentBattle(ctx, tx.Client(), battle)
		if err != nil {
			return err
		}
		err = enqueueOutboxEventInTransaction(ctx, tx, eventBattleWinnerCelebrated, liveId, now, map[string]any{
			"liveId": liveId, "battleId": battleId, "winnerUserIds": battle.WinnerUserIds, "mvpGifter": view.MvpGifter, "animationAssetId": winnerCelebrationAnimationId,
		})
		if err != nil {
			return err
		}
	}
	return application.emitStageUpdated(ctx, tx, battle.LiveID)
}
