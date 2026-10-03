package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/guestslot"
	"zudomart/modules/live/internal/ent/joinrequest"
)

func (application *LiveApplication) RequestToJoinStage(ctx context.Context, actor Actor, liveId uuid.UUID) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := application.lockLiveForStageChange(ctx, tx, liveId, nil, false)
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
		reserved, err := application.countReservedSeats(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if reserved >= domain.MaximumStreamersOnStage {
			return errStageFull
		}
		pending, err := tx.JoinRequest.Query().Where(joinrequest.LiveID(liveId), joinrequest.UserID(actor.UserId), joinrequest.StateEQ(joinrequest.StatePending)).Exist(ctx)
		if err != nil || pending {
			return err
		}
		if err := tx.JoinRequest.Create().SetLiveID(liveId).SetUserID(actor.UserId).Exec(ctx); err != nil {
			return err
		}
		return application.emitStageUpdated(ctx, tx, liveId)
	})
}

func (application *LiveApplication) DecideStageJoinRequest(ctx context.Context, actor Actor, liveId, requestId uuid.UUID, approve bool) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := application.lockLiveForStageChange(ctx, tx, liveId, &actor, true); err != nil {
			return err
		}
		request, err := tx.JoinRequest.Query().Where(joinrequest.ID(requestId), joinrequest.LiveID(liveId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errSlotNotFound
		}
		if err != nil {
			return err
		}
		if request.State != joinrequest.StatePending {
			return errInvitationNoLongerOpen
		}
		now := application.Now()
		state := joinrequest.StateDeclined
		if approve {
			state = joinrequest.StateApproved
			reserved, err := application.countReservedSeats(ctx, tx, liveId)
			if err != nil {
				return err
			}
			if reserved >= domain.MaximumStreamersOnStage {
				return errStageFull
			}
			slot, err := tx.GuestSlot.Create().SetLiveID(liveId).SetUserID(request.UserID).SetExpiresAt(now.Add(domain.InvitationLifetimeSeconds * time.Second)).Save(ctx)
			if err != nil {
				return err
			}
			if err := application.seatAcceptedGuest(ctx, tx, slot); err != nil {
				return err
			}
		}
		if err := request.Update().SetState(state).SetDecidedAt(now).Exec(ctx); err != nil {
			return err
		}
		return application.emitStageUpdated(ctx, tx, liveId)
	})
}
