package services

import (
	"context"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/guestslot"
)

func (service *LiveService) RespondToStageInvitation(ctx context.Context, actor types.Actor, liveId, slotId uuid.UUID, accept bool) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := service.lockLiveForStageChange(ctx, tx, liveId, nil, false); err != nil {
			return err
		}
		slot, err := tx.GuestSlot.Query().Where(guestslot.ID(slotId), guestslot.LiveID(liveId), guestslot.UserID(actor.UserId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return liveerrors.SlotNotFound
		}
		if err != nil {
			return err
		}
		if slot.State != guestslot.StateInvited {
			return liveerrors.InvitationNoLongerOpen
		}
		if !service.Now().Before(slot.ExpiresAt) {
			if _, err := service.applySlotEvent(ctx, tx, slot, InvitationExpires); err != nil {
				return err
			}
			return liveerrors.InvitationNoLongerOpen
		}
		if !accept {
			if _, err = service.applySlotEvent(ctx, tx, slot, GuestDeclines); err != nil {
				return err
			}
			return service.emitStageUpdated(ctx, tx, liveId)
		}
		return service.seatAcceptedGuest(ctx, tx, slot)
	})
}

func (service *LiveService) seatAcceptedGuest(ctx context.Context, tx *ent.Tx, slot *ent.GuestSlot) error {
	slot, err := service.applySlotEvent(ctx, tx, slot, GuestAccepts)
	if err != nil {
		return err
	}
	if !service.Settings.GuestRequiresMediaConfirmation {
		if slot, err = service.applySlotEvent(ctx, tx, slot, GuestMediaConnects); err != nil {
			return err
		}
		if err := service.emitGuestChanged(ctx, tx, events.GuestJoined, slot, ""); err != nil {
			return err
		}
	}
	return service.emitStageUpdated(ctx, tx, slot.LiveID)
}
