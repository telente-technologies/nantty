package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/types"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
	"nantty/modules/live/src/generated/ent/battleparticipant"
	"nantty/modules/live/src/generated/ent/guestslot"
)

const (
	minimumBattleSeconds = 60
	maximumBattleSeconds = 600
)

func (service *LiveService) CreateLiveBattle(ctx context.Context, actor types.Actor, liveId uuid.UUID, input types.CreateBattleInput) error {
	if input.DurationSeconds < minimumBattleSeconds || input.DurationSeconds > maximumBattleSeconds {
		return liveerrors.Api(400, "VALIDATION_FAILED", "Pick between 1 and 10 minutes.")
	}
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveForStageChange(ctx, tx, liveId, &actor, true)
		if err != nil {
			return err
		}
		if replayed, err := tx.Battle.Query().Where(battlerecord.LiveID(liveId), battlerecord.IdempotencyKey(input.IdempotencyKey)).Exist(ctx); err != nil || replayed {
			return err
		}
		if occupied, err := service.findOccupyingBattle(ctx, tx, liveId); err != nil || occupied != nil {
			return orBattleInProgress(err)
		}
		onStage, err := tx.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.UserIDIn(input.ParticipantUserIds...),
			guestslot.StateIn(guestslot.StateOnStage, guestslot.StateReconnecting)).All(ctx)
		if err != nil {
			return err
		}
		if len(onStage) != len(input.ParticipantUserIds) {
			return liveerrors.RecipientNotOnStage
		}
		return service.openBattle(ctx, tx, session, input)
	})
	if err != nil {
		return err
	}
	return nil
}

func orBattleInProgress(err error) error {
	if err != nil {
		return err
	}
	return liveerrors.BattleInProgress
}

func (service *LiveService) openBattle(ctx context.Context, tx *ent.Tx, session *ent.LiveSession, input types.CreateBattleInput) error {
	participants, err := service.lookupParticipants(ctx, input.ParticipantUserIds...)
	if err != nil {
		return err
	}
	now := service.Now()
	needsConsent := input.WinnerTakesAll
	builder := tx.Battle.Create().SetLiveID(session.ID).SetHostID(session.HostID).SetDurationSeconds(input.DurationSeconds).
		SetWinnerTakesAll(input.WinnerTakesAll).SetIdempotencyKey(input.IdempotencyKey)
	hasGuestToAsk := false
	for _, identifier := range input.ParticipantUserIds {
		hasGuestToAsk = hasGuestToAsk || identifier != session.HostID
	}
	needsConsent = needsConsent && hasGuestToAsk
	if needsConsent {
		expires := now.Add(ProposalAnswerWindowSeconds * time.Second)
		builder.SetProposalExpiresAt(expires).SetHostDecisionDeadlineAt(expires.Add(HostDecisionWindowSeconds * time.Second))
	}
	battle, err := builder.Save(ctx)
	if err != nil {
		return err
	}
	for _, identifier := range input.ParticipantUserIds {
		consent := "accepted"
		if needsConsent && identifier != session.HostID {
			consent = "pending"
		}
		isMember := participants[identifier].IsCreatorProgramMember || (identifier == session.HostID && session.HostIsCreator)
		err := tx.BattleParticipant.Create().SetBattleID(battle.ID).SetUserID(identifier).SetConsent(battleparticipant.Consent(consent)).SetIsCreatorProgramMember(isMember).Exec(ctx)
		if err != nil {
			return err
		}
	}
	if err := service.emitBattleCreated(ctx, tx, battle); err != nil {
		return err
	}
	if needsConsent {
		return nil
	}
	_, err = service.startBattleCountdown(ctx, tx, battle, AllParticipantsAccepted, input.WinnerTakesAll)
	return err
}

func (service *LiveService) emitBattleCreated(ctx context.Context, tx *ent.Tx, battle *ent.Battle) error {
	if battle.State == battlerecord.StatePending {
		return service.emitBattleLifecycle(ctx, tx, events.BattleCreated, battle)
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, events.BattleCreated, battle.LiveID.String(), service.Now(), map[string]any{
		"liveId": battle.LiveID.String(), "battleId": battle.ID.String(), "winnerTakesAll": battle.WinnerTakesAll, "durationSeconds": battle.DurationSeconds,
	})
}
