package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/livesession"
)

func (application *LiveApplication) lockLiveSession(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) (*ent.LiveSession, error) {
	session, err := tx.LiveSession.Query().Where(livesession.ID(liveId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, errLiveNotFound
	}
	return session, err
}

func (application *LiveApplication) StartLiveSession(ctx context.Context, actor Actor, liveId uuid.UUID) (LiveSessionView, error) {
	var started *ent.LiveSession
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := application.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if session.HostID != actor.UserId {
			return errNotLiveHost
		}
		if session.State == livesession.StateLive {
			started = session
			return nil
		}
		if session.State == livesession.StateEnded {
			return errLiveNotActive
		}
		now := application.Now()
		if started, err = session.Update().SetState(livesession.StateLive).SetStartedAt(now).Save(ctx); err != nil {
			return err
		}
		return enqueueOutboxEventInTransaction(ctx, tx, eventLiveStarted, liveId.String(), now, LiveStartedEventData{
			LiveId: liveId.String(), HostId: session.HostID.String(), Title: session.Title, Category: string(session.Category),
		})
	})
	if err != nil {
		return LiveSessionView{}, err
	}
	return application.presentLiveSession(ctx, started)
}
