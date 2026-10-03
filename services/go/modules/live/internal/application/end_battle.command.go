package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	battlerecord "zudomart/modules/live/internal/ent/battle"
	"zudomart/modules/live/internal/ent/battleparticipant"
)

type FinalScore struct {
	UserId string `json:"userId"`
	Score  int64  `json:"score"`
}

func (application *LiveApplication) EndBattleEarlyAsHost(ctx context.Context, actor Actor, battleId uuid.UUID) (uuid.UUID, error) {
	var liveId uuid.UUID
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		battle, err := application.lockBattle(ctx, tx, battleId)
		if err != nil {
			return err
		}
		liveId = battle.LiveID
		if battle.HostID != actor.UserId {
			return errNotLiveHost
		}
		if battle.State != battlerecord.StateActive {
			return apiError(410, "BATTLE_NOT_ACTIVE", "This battle has already ended.")
		}
		return application.endBattleInTransaction(ctx, tx, battle, domain.HostEndsBattle, domain.EndedByHost)
	})
	if err == nil {
		application.settleEndedBattlesQuietly(ctx, liveId)
	}
	return liveId, err
}

func (application *LiveApplication) endBattleInTransaction(ctx context.Context, tx *ent.Tx, battle *ent.Battle, event domain.BattleEvent, reason domain.EndReason) error {
	update, err := application.moveBattle(battle, event)
	if err != nil {
		return err
	}
	now := application.Now()
	endsAt := now
	if battle.EndsAt != nil && battle.EndsAt.Before(now) {
		endsAt = *battle.EndsAt
	}
	if battle.StartsAt != nil && endsAt.Before(*battle.StartsAt) {
		endsAt = *battle.StartsAt
	}
	rows, err := application.loadParticipants(ctx, tx, battle.ID)
	if err != nil {
		return err
	}
	scoreByReceiver, err := application.settleableScores(ctx, tx, battle, rows)
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
	outcome := domain.DecideBattleOutcome(facts, battle.WinnerTakesAll)
	ended, err := update.SetEndsAt(endsAt).SetEndReason(battlerecord.EndReason(reason)).SetWinnerUserIds(outcome.WinnerUserIds).SetIsTie(outcome.IsTie).Save(ctx)
	if err != nil {
		return err
	}
	err = enqueueOutboxEventInTransaction(ctx, tx, eventBattleEnded, battle.LiveID.String(), now, map[string]any{
		"liveId": battle.LiveID.String(), "battleId": battle.ID.String(), "endReason": string(reason), "finalScores": finalScores,
		"winnerUserIds": outcome.WinnerUserIds, "isTie": outcome.IsTie,
	})
	if err != nil {
		return err
	}
	_ = ended
	return application.emitStageUpdated(ctx, tx, battle.LiveID)
}

func (application *LiveApplication) departFromBattle(ctx context.Context, tx *ent.Tx, session *ent.LiveSession, userId uuid.UUID, removedByHost bool) error {
	battle, err := application.findOccupyingBattle(ctx, tx, session.ID)
	if err != nil || battle == nil || battle.State == battlerecord.StateEnded {
		return err
	}
	rows, err := application.loadParticipants(ctx, tx, battle.ID)
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
		if !domain.ApplyParticipantDeparture(facts, userId.String(), removedByHost) {
			return nil
		}
		err := row.Update().SetState(battleparticipant.State(facts[index].State)).SetRemovedByHost(facts[index].RemovedByHost).Exec(ctx)
		if err != nil {
			return err
		}
		break
	}
	if battle.State != battlerecord.StatePending && domain.CountActiveParticipants(facts) < 2 {
		return application.endBattleInTransaction(ctx, tx, battle, domain.TooFewParticipants, domain.EndedByForfeit)
	}
	return nil
}

func (application *LiveApplication) settleEndedBattlesQuietly(ctx context.Context, liveId uuid.UUID) {
	if err := application.SettleEndedBattlesForLive(ctx, liveId); err != nil {
		application.bestEffortMedia(ctx, "settle battle (worker will retry)", err)
	}
}

func (application *LiveApplication) settleableScores(ctx context.Context, tx *ent.Tx, battle *ent.Battle, rows []*ent.BattleParticipant) (map[uuid.UUID]int64, error) {
	scores := map[uuid.UUID]int64{}
	callContext, cancel := context.WithTimeout(ctx, settlementCallTimeout)
	defer cancel()
	totals, err := application.Money.GetBattleGiftTotals(callContext, battle.ID.String())
	if err != nil {
		application.Logger.WarnContext(ctx, "money battle totals unavailable, using local counters", "error", err)
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
