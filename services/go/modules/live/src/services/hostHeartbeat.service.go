package services

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/guestslot"
	"nantty/modules/live/src/generated/ent/livesession"
	"nantty/modules/live/src/types"
)

const HostHeartbeatTimeout = 60 * time.Second

func (service *LiveService) RecordHostHeartbeat(ctx context.Context, actor types.Actor, liveId uuid.UUID) (types.HostHeartbeatView, error) {
	var view types.HostHeartbeatView
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if session.HostID != actor.UserId {
			return liveerrors.NotLiveHost
		}
		view = types.HostHeartbeatView{LiveId: liveId.String(), Status: heartbeatStatus(session.State), TimeoutSeconds: int(HostHeartbeatTimeout.Seconds())}
		if session.State != livesession.StateLive && session.State != livesession.StateConnecting {
			return nil
		}
		leaseExpiresAt := service.Now().Add(HostHeartbeatTimeout)
		_, err = tx.GuestSlot.Update().Where(guestslot.LiveID(liveId), guestslot.UserID(actor.UserId), guestslot.RoleEQ(guestslot.RoleHost),
			guestslot.StateEQ(guestslot.StateOnStage)).SetStateDeadlineAt(leaseExpiresAt).Save(ctx)
		formatted := formatTime(leaseExpiresAt)
		view.LeaseExpiresAt = &formatted
		return err
	})
	return view, err
}

func heartbeatStatus(state livesession.State) string {
	switch state {
	case livesession.StateLive, livesession.StateConnecting:
		return "live"
	case livesession.StateEnded:
		return "ended"
	}
	return "upcoming"
}

func (service *LiveService) sweepSilentHosts(ctx context.Context) error {
	lapsed, err := service.Client.GuestSlot.Query().Where(guestslot.RoleEQ(guestslot.RoleHost), guestslot.StateEQ(guestslot.StateOnStage),
		guestslot.StateDeadlineAtLTE(service.Now())).Limit(timerBatchSize).All(ctx)
	if err != nil {
		return err
	}
	for _, slot := range lapsed {
		if err := service.endLiveBecauseHostWentSilent(ctx, slot.LiveID); err != nil {
			return err
		}
	}
	return nil
}

func (service *LiveService) endLiveBecauseHostWentSilent(ctx context.Context, liveId uuid.UUID) error {
	return service.endLive(ctx, liveId, func(session *ent.LiveSession) (bool, error) {
		lapsed, err := service.Client.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.UserID(session.HostID), guestslot.RoleEQ(guestslot.RoleHost),
			guestslot.StateEQ(guestslot.StateOnStage), guestslot.StateDeadlineAtLTE(service.Now())).Exist(ctx)
		if err == nil && lapsed {
			service.Logger.InfoContext(ctx, "ending live after host heartbeat timeout", slog.String("liveId", liveId.String()))
		}
		return lapsed, err
	})
}
