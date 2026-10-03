package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	battlerecord "zudomart/modules/live/internal/ent/battle"
	"zudomart/modules/live/internal/ent/battleparticipant"
)

func (application *LiveApplication) RespondToWinnerTakesAllProposal(ctx context.Context, actor Actor, battleId uuid.UUID, accept bool) (uuid.UUID, error) {
	var liveId uuid.UUID
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		battle, err := application.lockBattle(ctx, tx, battleId)
		if err != nil {
			return err
		}
		liveId = battle.LiveID
		if battle.State != battlerecord.StatePending {
			return errBattleNotWaiting
		}
		participant, err := tx.BattleParticipant.Query().Where(battleparticipant.BattleID(battleId), battleparticipant.UserID(actor.UserId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errNotOnStage
		}
		if err != nil {
			return err
		}
		if participant.Consent != battleparticipant.ConsentPending {
			return errBattleAlreadyAnswered
		}
		consent := battleparticipant.ConsentDeclined
		if accept {
			consent = battleparticipant.ConsentAccepted
		}
		if err := participant.Update().SetConsent(consent).Exec(ctx); err != nil {
			return err
		}
		return application.evaluateProposal(ctx, tx, battle)
	})
	return liveId, err
}

func (application *LiveApplication) evaluateProposal(ctx context.Context, tx *ent.Tx, battle *ent.Battle) error {
	rows, err := application.loadParticipants(ctx, tx, battle.ID)
	if err != nil {
		return err
	}
	consents := make([]string, 0, len(rows))
	for _, row := range rows {
		consents = append(consents, string(row.Consent))
	}
	if domain.JudgeWinnerTakesAllConsents(consents) == domain.ConsentAllAccepted {
		_, err := application.startBattleCountdown(ctx, tx, battle, domain.AllParticipantsAccepted, true)
		return err
	}
	return application.emitStageUpdated(ctx, tx, battle.LiveID)
}

func (application *LiveApplication) CancelPendingBattle(ctx context.Context, actor Actor, battleId uuid.UUID) (uuid.UUID, error) {
	return application.decideAsHost(ctx, actor, battleId, func(tx *ent.Tx, battle *ent.Battle) error {
		return application.cancelBattle(ctx, tx, battle, domain.HostCancelsBattle, "hostCancelled")
	})
}

func (application *LiveApplication) StartPendingBattleWithoutWinnerTakesAll(ctx context.Context, actor Actor, battleId uuid.UUID) (uuid.UUID, error) {
	return application.decideAsHost(ctx, actor, battleId, func(tx *ent.Tx, battle *ent.Battle) error {
		rows, err := application.loadParticipants(ctx, tx, battleId)
		if err != nil {
			return err
		}
		if len(rows) < 2 {
			return errBattleNotWaiting
		}
		_, err = application.startBattleCountdown(ctx, tx, battle, domain.HostStartsWithoutRule, false)
		return err
	})
}

func (application *LiveApplication) decideAsHost(ctx context.Context, actor Actor, battleId uuid.UUID, decide func(*ent.Tx, *ent.Battle) error) (uuid.UUID, error) {
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
		if battle.State != battlerecord.StatePending {
			return errBattleNotWaiting
		}
		return decide(tx, battle)
	})
	return liveId, err
}
