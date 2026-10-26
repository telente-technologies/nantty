package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/types"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/guestslot"
)

func (service *LiveService) LeaveStageAsGuest(ctx context.Context, actor types.Actor, liveId uuid.UUID) error {
	var room string
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		room = session.LivekitRoom
		if session.HostID == actor.UserId {
			return liveerrors.Unprocessable("HOST_CANNOT_LEAVE_STAGE", "End the live to leave as host.")
		}
		slot, err := service.findOccupyingSlot(ctx, tx, liveId, actor.UserId)
		if err != nil {
			return err
		}
		if slot.State == guestslot.StateInvited {
			return liveerrors.NotOnStage
		}
		if slot, err = service.applySlotEvent(ctx, tx, slot, GuestLeaves); err != nil {
			return err
		}
		if err := service.departFromBattle(ctx, tx, session, actor.UserId, false); err != nil {
			return err
		}
		if err := service.emitGuestChanged(ctx, tx, events.GuestLeft, slot, "left"); err != nil {
			return err
		}
		return service.emitStageUpdated(ctx, tx, liveId)
	})
	if err == nil {
		service.bestEffortMedia(ctx, "remove participant", service.Media.RemoveParticipant(ctx, room, actor.UserId.String()))
	}
	return err
}

func (service *LiveService) ReportGuestMediaConnection(ctx context.Context, actor types.Actor, liveId uuid.UUID, connected bool) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := service.lockLiveForStageChange(ctx, tx, liveId, nil, false); err != nil {
			return err
		}
		slot, err := service.findOccupyingSlot(ctx, tx, liveId, actor.UserId)
		if err != nil {
			return err
		}
		var event GuestSlotEvent
		var emitted string
		switch {
		case connected && slot.State == guestslot.StateJoining:
			event, emitted = GuestMediaConnects, events.GuestJoined
		case connected && slot.State == guestslot.StateReconnecting:
			event, emitted = GuestReconnects, events.GuestJoined
		case !connected && slot.State == guestslot.StateOnStage:
			event, emitted = GuestDisconnects, events.GuestReconnecting
		default:
			return nil
		}
		if slot, err = service.applySlotEvent(ctx, tx, slot, event); err != nil {
			return err
		}
		if err := service.emitGuestChanged(ctx, tx, emitted, slot, ""); err != nil {
			return err
		}
		return service.emitStageUpdated(ctx, tx, liveId)
	})
}
