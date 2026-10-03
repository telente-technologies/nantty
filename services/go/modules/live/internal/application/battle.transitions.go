package application

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	battlerecord "zudomart/modules/live/internal/ent/battle"
	"zudomart/modules/live/internal/ent/battleparticipant"
)

func (application *LiveApplication) lockBattle(ctx context.Context, tx *ent.Tx, battleId uuid.UUID) (*ent.Battle, error) {
	battle, err := tx.Battle.Query().Where(battlerecord.ID(battleId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, errBattleNotFound
	}
	return battle, err
}

func (application *LiveApplication) findOccupyingBattle(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) (*ent.Battle, error) {
	battle, err := tx.Battle.Query().Where(battlerecord.LiveID(liveId), battlerecord.StateIn(
		battlerecord.StatePending, battlerecord.StateCountdown, battlerecord.StateActive, battlerecord.StateEnded)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return battle, err
}

func (application *LiveApplication) loadParticipants(ctx context.Context, tx *ent.Tx, battleId uuid.UUID) ([]*ent.BattleParticipant, error) {
	return tx.BattleParticipant.Query().Where(battleparticipant.BattleID(battleId)).Order(ent.Asc(battleparticipant.FieldCreatedAt)).All(ctx)
}

func participantFacts(rows []*ent.BattleParticipant) []domain.ParticipantFacts {
	facts := make([]domain.ParticipantFacts, 0, len(rows))
	for _, row := range rows {
		facts = append(facts, domain.ParticipantFacts{UserId: row.UserID.String(), State: domain.ParticipantState(row.State), Score: row.Score, RemovedByHost: row.RemovedByHost})
	}
	return facts
}

func (application *LiveApplication) moveBattle(battle *ent.Battle, event domain.BattleEvent) (*ent.BattleUpdateOne, error) {
	next, err := domain.NextBattleState(domain.BattleState(battle.State), event)
	if err != nil {
		return nil, apiError(http.StatusConflict, "INVALID_BATTLE_TRANSITION", err.Error())
	}
	return battle.Update().SetState(battlerecord.State(next)), nil
}

func (application *LiveApplication) startBattleCountdown(ctx context.Context, tx *ent.Tx, battle *ent.Battle, event domain.BattleEvent, winnerTakesAll bool) (*ent.Battle, error) {
	update, err := application.moveBattle(battle, event)
	if err != nil {
		return nil, err
	}
	now := application.Now()
	startsAt := now.Add(domain.BattleCountdownSeconds * time.Second)
	started, err := update.SetWinnerTakesAll(winnerTakesAll).SetCountdownStartedAt(now).SetStartsAt(startsAt).
		SetEndsAt(startsAt.Add(time.Duration(battle.DurationSeconds) * time.Second)).ClearProposalExpiresAt().ClearHostDecisionDeadlineAt().Save(ctx)
	if err != nil {
		return nil, err
	}
	if err := tx.BattleParticipant.Update().Where(battleparticipant.BattleID(battle.ID), battleparticipant.ConsentEQ(battleparticipant.ConsentPending)).
		SetConsent(battleparticipant.ConsentAccepted).Exec(ctx); err != nil {
		return nil, err
	}
	return started, application.emitBattleLifecycle(ctx, tx, eventBattleStarted, started)
}

func (application *LiveApplication) emitBattleLifecycle(ctx context.Context, tx *ent.Tx, eventType string, battle *ent.Battle) error {
	view, err := application.presentBattle(ctx, tx.Client(), battle)
	if err != nil {
		return err
	}
	data := map[string]any{
		"liveId": battle.LiveID.String(), "battleId": battle.ID.String(), "battle": view, "winnerTakesAll": battle.WinnerTakesAll,
		"startsAt": view.StartsAt, "endsAt": view.EndsAt, "participants": view.Participants,
	}
	if err := enqueueOutboxEventInTransaction(ctx, tx, eventType, battle.LiveID.String(), application.Now(), data); err != nil {
		return err
	}
	return application.emitStageUpdated(ctx, tx, battle.LiveID)
}

func (application *LiveApplication) cancelBattle(ctx context.Context, tx *ent.Tx, battle *ent.Battle, event domain.BattleEvent, reason string) error {
	update, err := application.moveBattle(battle, event)
	if err != nil {
		return err
	}
	if _, err := update.ClearProposalExpiresAt().ClearHostDecisionDeadlineAt().Save(ctx); err != nil {
		return err
	}
	err = enqueueOutboxEventInTransaction(ctx, tx, eventBattleCancelled, battle.LiveID.String(), application.Now(), map[string]any{
		"liveId": battle.LiveID.String(), "battleId": battle.ID.String(), "reason": reason,
	})
	if err != nil {
		return err
	}
	return application.emitStageUpdated(ctx, tx, battle.LiveID)
}
