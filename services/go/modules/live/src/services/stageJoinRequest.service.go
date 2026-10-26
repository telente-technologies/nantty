package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/types"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/guestslot"
	"nantty/modules/live/src/generated/ent/joinrequest"
)

func (service *LiveService) RequestToJoinStage(ctx context.Context, actor types.Actor, liveId uuid.UUID) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveForStageChange(ctx, tx, liveId, nil, false)
		if err != nil {
			return err
		}
		if session.HostID == actor.UserId {
			return nil
		}
		seated, err := tx.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.UserID(actor.UserId), guestslot.StateIn(occupyingSlotStates()...)).Exist(ctx)
		if err != nil || seated {
			return err
		}
		reserved, err := service.countReservedSeats(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if reserved >= MaximumStreamersOnStage {
			return liveerrors.StageFull
		}
		pending, err := tx.JoinRequest.Query().Where(joinrequest.LiveID(liveId), joinrequest.UserID(actor.UserId), joinrequest.StateEQ(joinrequest.StatePending)).Exist(ctx)
		if err != nil || pending {
			return err
		}
		if err := tx.JoinRequest.Create().SetLiveID(liveId).SetUserID(actor.UserId).Exec(ctx); err != nil {
			return err
		}
		return service.emitStageUpdated(ctx, tx, liveId)
	})
}

func (service *LiveService) DecideStageJoinRequest(ctx context.Context, actor types.Actor, liveId, requestId uuid.UUID, approve bool) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := service.lockLiveForStageChange(ctx, tx, liveId, &actor, true); err != nil {
			return err
		}
		request, err := tx.JoinRequest.Query().Where(joinrequest.ID(requestId), joinrequest.LiveID(liveId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return liveerrors.SlotNotFound
		}
		if err != nil {
			return err
		}
		if request.State != joinrequest.StatePending {
			return liveerrors.InvitationNoLongerOpen
		}
		now := service.Now()
		state := joinrequest.StateDeclined
		if approve {
			state = joinrequest.StateApproved
			reserved, err := service.countReservedSeats(ctx, tx, liveId)
			if err != nil {
				return err
			}
			if reserved >= MaximumStreamersOnStage {
				return liveerrors.StageFull
			}
			slot, err := tx.GuestSlot.Create().SetLiveID(liveId).SetUserID(request.UserID).SetExpiresAt(now.Add(InvitationLifetimeSeconds * time.Second)).Save(ctx)
			if err != nil {
				return err
			}
			if err := service.seatAcceptedGuest(ctx, tx, slot); err != nil {
				return err
			}
		}
		if err := request.Update().SetState(state).SetDecidedAt(now).Exec(ctx); err != nil {
			return err
		}
		return service.emitStageUpdated(ctx, tx, liveId)
	})
}
