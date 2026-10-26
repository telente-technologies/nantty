package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/events"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
	"nantty/modules/live/src/generated/ent/battleparticipant"
)

func (service *LiveService) lockBattle(ctx context.Context, tx *ent.Tx, battleId uuid.UUID) (*ent.Battle, error) {
	battle, err := tx.Battle.Query().Where(battlerecord.ID(battleId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, liveerrors.BattleNotFound
	}
	return battle, err
}

func (service *LiveService) findOccupyingBattle(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) (*ent.Battle, error) {
	battle, err := tx.Battle.Query().Where(battlerecord.LiveID(liveId), battlerecord.StateIn(
		battlerecord.StatePending, battlerecord.StateCountdown, battlerecord.StateActive, battlerecord.StateEnded)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return battle, err
}

func (service *LiveService) loadParticipants(ctx context.Context, tx *ent.Tx, battleId uuid.UUID) ([]*ent.BattleParticipant, error) {
	return tx.BattleParticipant.Query().Where(battleparticipant.BattleID(battleId)).Order(ent.Asc(battleparticipant.FieldCreatedAt)).All(ctx)
}

func participantFacts(rows []*ent.BattleParticipant) []ParticipantFacts {
	facts := make([]ParticipantFacts, 0, len(rows))
	for _, row := range rows {
		facts = append(facts, ParticipantFacts{UserId: row.UserID.String(), State: ParticipantState(row.State), Score: row.Score, RemovedByHost: row.RemovedByHost})
	}
	return facts
}

func (service *LiveService) moveBattle(battle *ent.Battle, event BattleEvent) (*ent.BattleUpdateOne, error) {
	next, err := NextBattleState(BattleState(battle.State), event)
	if err != nil {
		return nil, liveerrors.Api(http.StatusConflict, "INVALID_BATTLE_TRANSITION", err.Error())
	}
	return battle.Update().SetState(battlerecord.State(next)), nil
}

func (service *LiveService) startBattleCountdown(ctx context.Context, tx *ent.Tx, battle *ent.Battle, event BattleEvent, winnerTakesAll bool) (*ent.Battle, error) {
	update, err := service.moveBattle(battle, event)
	if err != nil {
		return nil, err
	}
	now := service.Now()
	startsAt := now.Add(BattleCountdownSeconds * time.Second)
	started, err := update.SetWinnerTakesAll(winnerTakesAll).SetCountdownStartedAt(now).SetStartsAt(startsAt).
		SetEndsAt(startsAt.Add(time.Duration(battle.DurationSeconds) * time.Second)).ClearProposalExpiresAt().ClearHostDecisionDeadlineAt().Save(ctx)
	if err != nil {
		return nil, err
	}
	if err := tx.BattleParticipant.Update().Where(battleparticipant.BattleID(battle.ID), battleparticipant.ConsentEQ(battleparticipant.ConsentPending)).
		SetConsent(battleparticipant.ConsentAccepted).Exec(ctx); err != nil {
		return nil, err
	}
	return started, service.emitBattleLifecycle(ctx, tx, events.BattleStarted, started)
}

func (service *LiveService) emitBattleLifecycle(ctx context.Context, tx *ent.Tx, eventType string, battle *ent.Battle) error {
	view, err := service.presentBattle(ctx, tx.Client(), battle)
	if err != nil {
		return err
	}
	data := map[string]any{
		"liveId": battle.LiveID.String(), "battleId": battle.ID.String(), "battle": view, "winnerTakesAll": battle.WinnerTakesAll,
		"startsAt": view.StartsAt, "endsAt": view.EndsAt, "participants": view.Participants,
	}
	if err := events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, battle.LiveID.String(), service.Now(), data); err != nil {
		return err
	}
	return service.emitStageUpdated(ctx, tx, battle.LiveID)
}

func (service *LiveService) cancelBattle(ctx context.Context, tx *ent.Tx, battle *ent.Battle, event BattleEvent, reason string) error {
	update, err := service.moveBattle(battle, event)
	if err != nil {
		return err
	}
	if _, err := update.ClearProposalExpiresAt().ClearHostDecisionDeadlineAt().Save(ctx); err != nil {
		return err
	}
	err = events.EnqueueOutboxEventInTransaction(ctx, tx, events.BattleCancelled, battle.LiveID.String(), service.Now(), map[string]any{
		"liveId": battle.LiveID.String(), "battleId": battle.ID.String(), "reason": reason,
	})
	if err != nil {
		return err
	}
	return service.emitStageUpdated(ctx, tx, battle.LiveID)
}
