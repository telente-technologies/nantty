package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	battlerecord "zudomart/modules/live/internal/ent/battle"
	"zudomart/modules/live/internal/ent/battleparticipant"
	"zudomart/modules/live/internal/ent/guestslot"
)

const (
	minimumBattleSeconds = 60
	maximumBattleSeconds = 600
)

type CreateBattleInput struct {
	ParticipantUserIds []uuid.UUID
	DurationSeconds    int
	WinnerTakesAll     bool
	IdempotencyKey     string
}

func (application *LiveApplication) CreateLiveBattle(ctx context.Context, actor Actor, liveId uuid.UUID, input CreateBattleInput) error {
	if input.DurationSeconds < minimumBattleSeconds || input.DurationSeconds > maximumBattleSeconds {
		return apiError(400, "VALIDATION_FAILED", "Pick between 1 and 10 minutes.")
	}
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := application.lockLiveForStageChange(ctx, tx, liveId, &actor, true)
		if err != nil {
			return err
		}
		if replayed, err := tx.Battle.Query().Where(battlerecord.LiveID(liveId), battlerecord.IdempotencyKey(input.IdempotencyKey)).Exist(ctx); err != nil || replayed {
			return err
		}
		if occupied, err := application.findOccupyingBattle(ctx, tx, liveId); err != nil || occupied != nil {
			return orBattleInProgress(err)
		}
		onStage, err := tx.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.UserIDIn(input.ParticipantUserIds...),
			guestslot.StateIn(guestslot.StateOnStage, guestslot.StateReconnecting)).All(ctx)
		if err != nil {
			return err
		}
		if len(onStage) != len(input.ParticipantUserIds) {
			return errRecipientNotOnStage
		}
		return application.openBattle(ctx, tx, session, input)
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
	return errBattleInProgress
}

func (application *LiveApplication) openBattle(ctx context.Context, tx *ent.Tx, session *ent.LiveSession, input CreateBattleInput) error {
	participants, err := application.lookupParticipants(ctx, input.ParticipantUserIds...)
	if err != nil {
		return err
	}
	now := application.Now()
	needsConsent := input.WinnerTakesAll
	builder := tx.Battle.Create().SetLiveID(session.ID).SetHostID(session.HostID).SetDurationSeconds(input.DurationSeconds).
		SetWinnerTakesAll(input.WinnerTakesAll).SetIdempotencyKey(input.IdempotencyKey)
	hasGuestToAsk := false
	for _, identifier := range input.ParticipantUserIds {
		hasGuestToAsk = hasGuestToAsk || identifier != session.HostID
	}
	needsConsent = needsConsent && hasGuestToAsk
	if needsConsent {
		expires := now.Add(domain.ProposalAnswerWindowSeconds * time.Second)
		builder.SetProposalExpiresAt(expires).SetHostDecisionDeadlineAt(expires.Add(domain.HostDecisionWindowSeconds * time.Second))
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
	if err := application.emitBattleCreated(ctx, tx, battle); err != nil {
		return err
	}
	if needsConsent {
		return nil
	}
	_, err = application.startBattleCountdown(ctx, tx, battle, domain.AllParticipantsAccepted, input.WinnerTakesAll)
	return err
}

func (application *LiveApplication) emitBattleCreated(ctx context.Context, tx *ent.Tx, battle *ent.Battle) error {
	if battle.State == battlerecord.StatePending {
		return application.emitBattleLifecycle(ctx, tx, eventBattleCreated, battle)
	}
	return enqueueOutboxEventInTransaction(ctx, tx, eventBattleCreated, battle.LiveID.String(), application.Now(), map[string]any{
		"liveId": battle.LiveID.String(), "battleId": battle.ID.String(), "winnerTakesAll": battle.WinnerTakesAll, "durationSeconds": battle.DurationSeconds,
	})
}
