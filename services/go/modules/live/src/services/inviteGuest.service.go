package services

import (
	"context"
	"time"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/guestslot"
)

func (service *LiveService) InviteGuestToStage(ctx context.Context, actor types.Actor, liveId, guestUserId uuid.UUID) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveForStageChange(ctx, tx, liveId, &actor, true)
		if err != nil {
			return err
		}
		if guestUserId == session.HostID {
			return liveerrors.Unprocessable("CANNOT_INVITE_HOST", "The host is already on stage.")
		}
		existing, err := tx.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.UserID(guestUserId), guestslot.StateIn(occupyingSlotStates()...)).Exist(ctx)
		if err != nil || existing {
			return err
		}
		reserved, err := service.countReservedSeats(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if reserved >= MaximumStreamersOnStage {
			return liveerrors.StageFull
		}
		now := service.Now()
		slot, err := tx.GuestSlot.Create().SetLiveID(liveId).SetUserID(guestUserId).
			SetExpiresAt(now.Add(InvitationLifetimeSeconds * time.Second)).Save(ctx)
		if err != nil {
			return err
		}
		participants, err := service.lookupParticipants(ctx, session.HostID)
		if err != nil {
			return err
		}
		err = events.EnqueueOutboxEventInTransaction(ctx, tx, events.GuestInvited, liveId.String(), now, events.GuestInvitedEventData{
			LiveId: liveId.String(), UserId: guestUserId.String(), SlotId: slot.ID.String(), ExpiresAt: formatTime(slot.ExpiresAt),
			Live: events.InvitedLive{Id: liveId.String(), Title: session.Title, Host: summarise(participants[session.HostID])},
		})
		if err != nil {
			return err
		}
		return service.emitStageUpdated(ctx, tx, liveId)
	})
}

func (service *LiveService) CancelGuestInvitation(ctx context.Context, actor types.Actor, liveId, slotId uuid.UUID) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := service.lockLiveForStageChange(ctx, tx, liveId, &actor, true); err != nil {
			return err
		}
		slot, err := tx.GuestSlot.Query().Where(guestslot.ID(slotId), guestslot.LiveID(liveId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return liveerrors.SlotNotFound
		}
		if err != nil {
			return err
		}
		if _, err = service.applySlotEvent(ctx, tx, slot, HostCancelsInvitation); err != nil {
			return err
		}
		return service.emitStageUpdated(ctx, tx, liveId)
	})
}
