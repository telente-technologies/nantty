package services

import (
	"context"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/livesession"
)

func (service *LiveService) lockLiveSession(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) (*ent.LiveSession, error) {
	session, err := tx.LiveSession.Query().Where(livesession.ID(liveId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, liveerrors.LiveNotFound
	}
	return session, err
}

func (service *LiveService) StartLiveSession(ctx context.Context, actor types.Actor, liveId uuid.UUID) (types.LiveSessionView, error) {
	var started *ent.LiveSession
	preview, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return types.LiveSessionView{}, liveerrors.LiveNotFound
	}
	if err != nil {
		return types.LiveSessionView{}, err
	}
	if preview.State != livesession.StateLive {
		if err := service.EnsureHostCanGoLive(ctx, preview.HostID.String()); err != nil {
			return types.LiveSessionView{}, err
		}
	}
	audience := service.resolveLiveStartedAudience(ctx, preview.HostID, string(preview.Visibility))
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if session.HostID != actor.UserId {
			return liveerrors.NotLiveHost
		}
		if session.State == livesession.StateLive {
			started = session
			return nil
		}
		if session.State == livesession.StateEnded {
			return liveerrors.LiveNotActive
		}
		if err := service.ensureLiveAdTermsCurrent(session); err != nil {
			return err
		}
		now := service.Now()
		if started, err = session.Update().SetState(livesession.StateLive).SetStartedAt(now).Save(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveStarted, liveId.String(), now, liveStartedEventData(started, now, audience))
	})
	if err != nil {
		return types.LiveSessionView{}, err
	}
	service.afterLiveWentLive(ctx, started)
	return service.presentLiveSession(ctx, started)
}
