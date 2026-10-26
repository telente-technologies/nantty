package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/types"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
	"nantty/modules/live/src/generated/ent/battleparticipant"
)

type FinalScore struct {
	UserId string `json:"userId"`
	Score  int64  `json:"score"`
}

func (service *LiveService) EndBattleEarlyAsHost(ctx context.Context, actor types.Actor, battleId uuid.UUID) (uuid.UUID, error) {
	var liveId uuid.UUID
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		battle, err := service.lockBattle(ctx, tx, battleId)
		if err != nil {
			return err
		}
		liveId = battle.LiveID
		if battle.HostID != actor.UserId {
			return liveerrors.NotLiveHost
		}
		if battle.State != battlerecord.StateActive {
			return liveerrors.Api(410, "BATTLE_NOT_ACTIVE", "This battle has already ended.")
		}
		return service.endBattleInTransaction(ctx, tx, battle, HostEndsBattle, EndedByHost)
	})
	if err == nil {
		service.settleEndedBattlesQuietly(ctx, liveId)
	}
	return liveId, err
}

func (service *LiveService) endBattleInTransaction(ctx context.Context, tx *ent.Tx, battle *ent.Battle, event BattleEvent, reason EndReason) error {
	update, err := service.moveBattle(battle, event)
	if err != nil {
		return err
	}
	now := service.Now()
	endsAt := now
	if battle.EndsAt != nil && battle.EndsAt.Before(now) {
		endsAt = *battle.EndsAt
	}
	if battle.StartsAt != nil && endsAt.Before(*battle.StartsAt) {
		endsAt = *battle.StartsAt
	}
	rows, err := service.loadParticipants(ctx, tx, battle.ID)
	if err != nil {
		return err
	}
	scoreByReceiver, err := service.settleableScores(ctx, tx, battle, rows)
	if err != nil {
		return err
	}
	facts := participantFacts(rows)
	finalScores := make([]FinalScore, 0, len(rows))
	for index, row := range rows {
		score := scoreByReceiver[row.UserID]
		if err := tx.BattleParticipant.UpdateOneID(row.ID).SetScore(score).Exec(ctx); err != nil {
			return err
		}
		facts[index].Score = score
		finalScores = append(finalScores, FinalScore{UserId: row.UserID.String(), Score: score})
	}
	outcome := DecideBattleOutcome(facts, battle.WinnerTakesAll)
	ended, err := update.SetEndsAt(endsAt).SetEndReason(battlerecord.EndReason(reason)).SetWinnerUserIds(outcome.WinnerUserIds).SetIsTie(outcome.IsTie).Save(ctx)
	if err != nil {
		return err
	}
	err = events.EnqueueOutboxEventInTransaction(ctx, tx, events.BattleEnded, battle.LiveID.String(), now, map[string]any{
		"liveId": battle.LiveID.String(), "battleId": battle.ID.String(), "endReason": string(reason), "finalScores": finalScores,
		"winnerUserIds": outcome.WinnerUserIds, "isTie": outcome.IsTie,
	})
	if err != nil {
		return err
	}
	_ = ended
	return service.emitStageUpdated(ctx, tx, battle.LiveID)
}

func (service *LiveService) departFromBattle(ctx context.Context, tx *ent.Tx, session *ent.LiveSession, userId uuid.UUID, removedByHost bool) error {
	battle, err := service.findOccupyingBattle(ctx, tx, session.ID)
	if err != nil || battle == nil || battle.State == battlerecord.StateEnded {
		return err
	}
	rows, err := service.loadParticipants(ctx, tx, battle.ID)
	if err != nil {
		return err
	}
	facts := participantFacts(rows)
	for index, row := range rows {
		if row.UserID != userId {
			continue
		}
		if battle.State == battlerecord.StatePending {
			return row.Update().SetConsent(battleparticipant.ConsentDeclined).Exec(ctx)
		}
		if !ApplyParticipantDeparture(facts, userId.String(), removedByHost) {
			return nil
		}
		err := row.Update().SetState(battleparticipant.State(facts[index].State)).SetRemovedByHost(facts[index].RemovedByHost).Exec(ctx)
		if err != nil {
			return err
		}
		break
	}
	if battle.State != battlerecord.StatePending && CountActiveParticipants(facts) < 2 {
		return service.endBattleInTransaction(ctx, tx, battle, TooFewParticipants, EndedByForfeit)
	}
	return nil
}

func (service *LiveService) settleEndedBattlesQuietly(ctx context.Context, liveId uuid.UUID) {
	if err := service.SettleEndedBattlesForLive(ctx, liveId); err != nil {
		service.bestEffortMedia(ctx, "settle battle (worker will retry)", err)
	}
}

func (service *LiveService) settleableScores(ctx context.Context, tx *ent.Tx, battle *ent.Battle, rows []*ent.BattleParticipant) (map[uuid.UUID]int64, error) {
	scores := map[uuid.UUID]int64{}
	callContext, cancel := context.WithTimeout(ctx, settlementCallTimeout)
	defer cancel()
	totals, err := service.Money.GetBattleGiftTotals(callContext, battle.ID.String())
	if err != nil {
		service.Logger.WarnContext(ctx, "money battle totals unavailable, using local counters", "error", err)
		for _, row := range rows {
			scores[row.UserID] = row.Score
		}
		return scores, nil
	}
	for _, total := range totals {
		if receiver, parseErr := uuid.Parse(total.ReceiverUserId); parseErr == nil {
			scores[receiver] = total.GrossCoins
		}
	}
	return scores, nil
}
