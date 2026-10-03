package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/guestslot"
)

func (application *LiveApplication) RespondToStageInvitation(ctx context.Context, actor Actor, liveId, slotId uuid.UUID, accept bool) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := application.lockLiveForStageChange(ctx, tx, liveId, nil, false); err != nil {
			return err
		}
		slot, err := tx.GuestSlot.Query().Where(guestslot.ID(slotId), guestslot.LiveID(liveId), guestslot.UserID(actor.UserId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errSlotNotFound
		}
		if err != nil {
			return err
		}
		if slot.State != guestslot.StateInvited {
			return errInvitationNoLongerOpen
		}
		if !application.Now().Before(slot.ExpiresAt) {
			if _, err := application.applySlotEvent(ctx, tx, slot, domain.InvitationExpires); err != nil {
				return err
			}
			return errInvitationNoLongerOpen
		}
		if !accept {
			if slot, err = application.applySlotEvent(ctx, tx, slot, domain.GuestDeclines); err != nil {
				return err
			}
			return application.emitStageUpdated(ctx, tx, liveId)
		}
		return application.seatAcceptedGuest(ctx, tx, slot)
	})
}

func (application *LiveApplication) seatAcceptedGuest(ctx context.Context, tx *ent.Tx, slot *ent.GuestSlot) error {
	slot, err := application.applySlotEvent(ctx, tx, slot, domain.GuestAccepts)
	if err != nil {
		return err
	}
	if !application.Settings.GuestRequiresMediaConfirmation {
		if slot, err = application.applySlotEvent(ctx, tx, slot, domain.GuestMediaConnects); err != nil {
			return err
		}
		if err := application.emitGuestChanged(ctx, tx, eventGuestJoined, slot, ""); err != nil {
			return err
		}
	}
	return application.emitStageUpdated(ctx, tx, slot.LiveID)
}
