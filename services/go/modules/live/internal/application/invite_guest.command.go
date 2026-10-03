package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/guestslot"
)

func (application *LiveApplication) InviteGuestToStage(ctx context.Context, actor Actor, liveId, guestUserId uuid.UUID) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := application.lockLiveForStageChange(ctx, tx, liveId, &actor, true)
		if err != nil {
			return err
		}
		if guestUserId == session.HostID {
			return unprocessable("CANNOT_INVITE_HOST", "The host is already on stage.")
		}
		existing, err := tx.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.UserID(guestUserId), guestslot.StateIn(occupyingSlotStates()...)).Exist(ctx)
		if err != nil || existing {
			return err
		}
		reserved, err := application.countReservedSeats(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if reserved >= domain.MaximumStreamersOnStage {
			return errStageFull
		}
		now := application.Now()
		slot, err := tx.GuestSlot.Create().SetLiveID(liveId).SetUserID(guestUserId).
			SetExpiresAt(now.Add(domain.InvitationLifetimeSeconds * time.Second)).Save(ctx)
		if err != nil {
			return err
		}
		participants, err := application.lookupParticipants(ctx, session.HostID)
		if err != nil {
			return err
		}
		err = enqueueOutboxEventInTransaction(ctx, tx, eventGuestInvited, liveId.String(), now, GuestInvitedEventData{
			LiveId: liveId.String(), UserId: guestUserId.String(), SlotId: slot.ID.String(), ExpiresAt: formatTime(slot.ExpiresAt),
			Live: InvitedLive{Id: liveId.String(), Title: session.Title, Host: summarise(participants[session.HostID])},
		})
		if err != nil {
			return err
		}
		return application.emitStageUpdated(ctx, tx, liveId)
	})
}

func (application *LiveApplication) CancelGuestInvitation(ctx context.Context, actor Actor, liveId, slotId uuid.UUID) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := application.lockLiveForStageChange(ctx, tx, liveId, &actor, true); err != nil {
			return err
		}
		slot, err := tx.GuestSlot.Query().Where(guestslot.ID(slotId), guestslot.LiveID(liveId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errSlotNotFound
		}
		if err != nil {
			return err
		}
		if slot, err = application.applySlotEvent(ctx, tx, slot, domain.HostCancelsInvitation); err != nil {
			return err
		}
		return application.emitStageUpdated(ctx, tx, liveId)
	})
}
