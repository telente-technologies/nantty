package application

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/guestslot"
	"zudomart/modules/live/internal/ent/livesession"
)

func (application *LiveApplication) lockLiveForStageChange(ctx context.Context, tx *ent.Tx, liveId uuid.UUID, actor *Actor, hostOnly bool) (*ent.LiveSession, error) {
	session, err := application.lockLiveSession(ctx, tx, liveId)
	if err != nil {
		return nil, err
	}
	if session.State != livesession.StateLive {
		return nil, errLiveNotActive
	}
	if hostOnly && actor != nil && session.HostID != actor.UserId {
		return nil, errNotLiveHost
	}
	return session, nil
}

func (application *LiveApplication) countReservedSeats(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) (int, error) {
	return tx.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.StateIn(occupyingSlotStates()...)).Count(ctx)
}

func (application *LiveApplication) findOccupyingSlot(ctx context.Context, tx *ent.Tx, liveId, userId uuid.UUID) (*ent.GuestSlot, error) {
	slot, err := tx.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.UserID(userId), guestslot.StateIn(occupyingSlotStates()...)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, errNotOnStage
	}
	return slot, err
}

func (application *LiveApplication) applySlotEvent(ctx context.Context, tx *ent.Tx, slot *ent.GuestSlot, event domain.GuestSlotEvent) (*ent.GuestSlot, error) {
	next, err := domain.NextGuestSlotState(domain.GuestSlotState(slot.State), event)
	if err != nil {
		return nil, apiError(http.StatusConflict, "INVALID_SLOT_TRANSITION", err.Error())
	}
	now := application.Now()
	update := slot.Update().SetState(guestslot.State(next)).ClearStateDeadlineAt()
	switch next {
	case domain.SlotJoining:
		update.SetStateDeadlineAt(now.Add(domain.JoiningTimeoutSeconds * time.Second))
	case domain.SlotReconnecting:
		update.SetStateDeadlineAt(now.Add(domain.ReconnectGraceSeconds * time.Second))
	case domain.SlotOnStage:
		if slot.JoinedAt == nil {
			update.SetJoinedAt(now)
		}
	case domain.SlotLeft, domain.SlotRemoved, domain.SlotFailed:
		update.SetLeftAt(now)
	}
	return update.Save(ctx)
}

func (application *LiveApplication) emitStageUpdated(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) error {
	snapshot, err := application.buildStageView(ctx, tx.Client(), liveId, nil)
	if err != nil {
		return err
	}
	return enqueueOutboxEventInTransaction(ctx, tx, eventStageUpdated, liveId.String(), application.Now(), snapshot)
}

func (application *LiveApplication) emitGuestChanged(ctx context.Context, tx *ent.Tx, eventType string, slot *ent.GuestSlot, reason string) error {
	return enqueueOutboxEventInTransaction(ctx, tx, eventType, slot.LiveID.String(), application.Now(), GuestChangedEventData{
		LiveId: slot.LiveID.String(), SlotId: slot.ID.String(), UserId: slot.UserID.String(), State: string(slot.State),
		AudioMuted: slot.AudioMutedByHost || slot.AudioMutedBySelf, VideoMuted: slot.VideoMutedByHost || slot.VideoMutedBySelf, Reason: reason,
	})
}

func eventTypeForDeparture(state guestslot.State) string {
	if state == guestslot.StateRemoved {
		return eventGuestRemoved
	}
	return eventGuestLeft
}
