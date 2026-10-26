package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/types"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/guestslot"
	"nantty/modules/live/src/generated/ent/livesession"
)

func (service *LiveService) lockLiveForStageChange(ctx context.Context, tx *ent.Tx, liveId uuid.UUID, actor *types.Actor, hostOnly bool) (*ent.LiveSession, error) {
	session, err := service.lockLiveSession(ctx, tx, liveId)
	if err != nil {
		return nil, err
	}
	if session.State != livesession.StateLive {
		return nil, liveerrors.LiveNotActive
	}
	if hostOnly && actor != nil && session.HostID != actor.UserId {
		return nil, liveerrors.NotLiveHost
	}
	return session, nil
}

func (service *LiveService) countReservedSeats(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) (int, error) {
	return tx.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.StateIn(occupyingSlotStates()...)).Count(ctx)
}

func (service *LiveService) findOccupyingSlot(ctx context.Context, tx *ent.Tx, liveId, userId uuid.UUID) (*ent.GuestSlot, error) {
	slot, err := tx.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.UserID(userId), guestslot.StateIn(occupyingSlotStates()...)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, liveerrors.NotOnStage
	}
	return slot, err
}

func (service *LiveService) applySlotEvent(ctx context.Context, tx *ent.Tx, slot *ent.GuestSlot, event GuestSlotEvent) (*ent.GuestSlot, error) {
	next, err := NextGuestSlotState(GuestSlotState(slot.State), event)
	if err != nil {
		return nil, liveerrors.Api(http.StatusConflict, "INVALID_SLOT_TRANSITION", err.Error())
	}
	now := service.Now()
	update := slot.Update().SetState(guestslot.State(next))
	switch next {
	case SlotJoining:
		update.SetStateDeadlineAt(now.Add(JoiningTimeoutSeconds * time.Second))
	case SlotReconnecting:
		update.SetStateDeadlineAt(now.Add(ReconnectGraceSeconds * time.Second))
	case SlotOnStage:
		update.ClearStateDeadlineAt()
		if slot.JoinedAt == nil {
			update.SetJoinedAt(now)
		}
	case SlotLeft, SlotRemoved, SlotFailed:
		update.ClearStateDeadlineAt().SetLeftAt(now)
	default:
		update.ClearStateDeadlineAt()
	}
	return update.Save(ctx)
}

func (service *LiveService) emitStageUpdated(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) error {
	snapshot, err := service.buildStageView(ctx, tx.Client(), liveId, nil)
	if err != nil {
		return err
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, events.StageUpdated, liveId.String(), service.Now(), snapshot)
}

func (service *LiveService) emitGuestChanged(ctx context.Context, tx *ent.Tx, eventType string, slot *ent.GuestSlot, reason string) error {
	return events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, slot.LiveID.String(), service.Now(), events.GuestChangedEventData{
		LiveId: slot.LiveID.String(), SlotId: slot.ID.String(), UserId: slot.UserID.String(), State: string(slot.State),
		AudioMuted: slot.AudioMutedByHost || slot.AudioMutedBySelf, VideoMuted: slot.VideoMutedByHost || slot.VideoMutedBySelf, Reason: reason,
	})
}

func eventTypeForDeparture(state guestslot.State) string {
	if state == guestslot.StateRemoved {
		return events.GuestRemoved
	}
	return events.GuestLeft
}
