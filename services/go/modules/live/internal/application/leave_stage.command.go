package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/guestslot"
)

func (application *LiveApplication) LeaveStageAsGuest(ctx context.Context, actor Actor, liveId uuid.UUID) error {
	var room string
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := application.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		room = session.LivekitRoom
		if session.HostID == actor.UserId {
			return unprocessable("HOST_CANNOT_LEAVE_STAGE", "End the live to leave as host.")
		}
		slot, err := application.findOccupyingSlot(ctx, tx, liveId, actor.UserId)
		if err != nil {
			return err
		}
		if slot.State == guestslot.StateInvited {
			return errNotOnStage
		}
		if slot, err = application.applySlotEvent(ctx, tx, slot, domain.GuestLeaves); err != nil {
			return err
		}
		if err := application.departFromBattle(ctx, tx, session, actor.UserId, false); err != nil {
			return err
		}
		if err := application.emitGuestChanged(ctx, tx, eventGuestLeft, slot, "left"); err != nil {
			return err
		}
		return application.emitStageUpdated(ctx, tx, liveId)
	})
	if err == nil {
		application.bestEffortMedia(ctx, "remove participant", application.Media.RemoveParticipant(ctx, room, actor.UserId.String()))
	}
	return err
}

func (application *LiveApplication) ReportGuestMediaConnection(ctx context.Context, actor Actor, liveId uuid.UUID, connected bool) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := application.lockLiveForStageChange(ctx, tx, liveId, nil, false); err != nil {
			return err
		}
		slot, err := application.findOccupyingSlot(ctx, tx, liveId, actor.UserId)
		if err != nil {
			return err
		}
		var event domain.GuestSlotEvent
		var emitted string
		switch {
		case connected && slot.State == guestslot.StateJoining:
			event, emitted = domain.GuestMediaConnects, eventGuestJoined
		case connected && slot.State == guestslot.StateReconnecting:
			event, emitted = domain.GuestReconnects, eventGuestJoined
		case !connected && slot.State == guestslot.StateOnStage:
			event, emitted = domain.GuestDisconnects, eventGuestReconnecting
		default:
			return nil
		}
		if slot, err = application.applySlotEvent(ctx, tx, slot, event); err != nil {
			return err
		}
		if err := application.emitGuestChanged(ctx, tx, emitted, slot, ""); err != nil {
			return err
		}
		return application.emitStageUpdated(ctx, tx, liveId)
	})
}
