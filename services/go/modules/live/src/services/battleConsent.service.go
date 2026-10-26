package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/types"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
	"nantty/modules/live/src/generated/ent/battleparticipant"
)

func (service *LiveService) RespondToWinnerTakesAllProposal(ctx context.Context, actor types.Actor, battleId uuid.UUID, accept bool) (uuid.UUID, error) {
	var liveId uuid.UUID
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		battle, err := service.lockBattle(ctx, tx, battleId)
		if err != nil {
			return err
		}
		liveId = battle.LiveID
		if battle.State != battlerecord.StatePending {
			return liveerrors.BattleNotWaiting
		}
		participant, err := tx.BattleParticipant.Query().Where(battleparticipant.BattleID(battleId), battleparticipant.UserID(actor.UserId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return liveerrors.NotOnStage
		}
		if err != nil {
			return err
		}
		if participant.Consent != battleparticipant.ConsentPending {
			return liveerrors.BattleAlreadyAnswered
		}
		consent := battleparticipant.ConsentDeclined
		if accept {
			consent = battleparticipant.ConsentAccepted
		}
		if err := participant.Update().SetConsent(consent).Exec(ctx); err != nil {
			return err
		}
		return service.evaluateProposal(ctx, tx, battle)
	})
	return liveId, err
}

func (service *LiveService) evaluateProposal(ctx context.Context, tx *ent.Tx, battle *ent.Battle) error {
	rows, err := service.loadParticipants(ctx, tx, battle.ID)
	if err != nil {
		return err
	}
	consents := make([]string, 0, len(rows))
	for _, row := range rows {
		consents = append(consents, string(row.Consent))
	}
	if JudgeWinnerTakesAllConsents(consents) == ConsentAllAccepted {
		_, err := service.startBattleCountdown(ctx, tx, battle, AllParticipantsAccepted, true)
		return err
	}
	return service.emitStageUpdated(ctx, tx, battle.LiveID)
}

func (service *LiveService) CancelPendingBattle(ctx context.Context, actor types.Actor, battleId uuid.UUID) (uuid.UUID, error) {
	return service.decideAsHost(ctx, actor, battleId, func(tx *ent.Tx, battle *ent.Battle) error {
		return service.cancelBattle(ctx, tx, battle, HostCancelsBattle, "hostCancelled")
	})
}

func (service *LiveService) StartPendingBattleWithoutWinnerTakesAll(ctx context.Context, actor types.Actor, battleId uuid.UUID) (uuid.UUID, error) {
	return service.decideAsHost(ctx, actor, battleId, func(tx *ent.Tx, battle *ent.Battle) error {
		rows, err := service.loadParticipants(ctx, tx, battleId)
		if err != nil {
			return err
		}
		if len(rows) < 2 {
			return liveerrors.BattleNotWaiting
		}
		_, err = service.startBattleCountdown(ctx, tx, battle, HostStartsWithoutRule, false)
		return err
	})
}

func (service *LiveService) decideAsHost(ctx context.Context, actor types.Actor, battleId uuid.UUID, decide func(*ent.Tx, *ent.Battle) error) (uuid.UUID, error) {
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
		if battle.State != battlerecord.StatePending {
			return liveerrors.BattleNotWaiting
		}
		return decide(tx, battle)
	})
	return liveId, err
}
