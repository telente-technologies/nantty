package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/livesession"
	"zudomart/modules/live/internal/ent/liveviewer"
)

func (application *LiveApplication) JoinLiveAsViewer(ctx context.Context, actor Actor, liveId uuid.UUID) error {
	return application.changeViewerPresence(ctx, actor.UserId, liveId, true)
}

func (application *LiveApplication) LeaveLiveAsViewer(ctx context.Context, actor Actor, liveId uuid.UUID) error {
	return application.changeViewerPresence(ctx, actor.UserId, liveId, false)
}

func (application *LiveApplication) changeViewerPresence(ctx context.Context, userId, liveId uuid.UUID, joining bool) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := application.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if joining && session.State != livesession.StateLive {
			return errLiveNotActive
		}
		now := application.Now()
		if joining {
			err = tx.LiveViewer.Create().SetLiveID(liveId).SetUserID(userId).SetLastSeenAt(now).
				OnConflictColumns(liveviewer.FieldLiveID, liveviewer.FieldUserID).UpdateLastSeenAt().ClearLeftAt().Exec(ctx)
		} else {
			err = tx.LiveViewer.Update().Where(liveviewer.LiveID(liveId), liveviewer.UserID(userId), liveviewer.LeftAtIsNil()).SetLeftAt(now).Exec(ctx)
		}
		if err != nil {
			return err
		}
		count, err := tx.LiveViewer.Query().Where(liveviewer.LiveID(liveId), liveviewer.LeftAtIsNil()).Count(ctx)
		if err != nil || count == session.Viewers {
			return err
		}
		update := session.Update().SetViewers(count)
		if count > session.PeakViewers {
			update.SetPeakViewers(count)
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		return enqueueOutboxEventInTransaction(ctx, tx, eventLiveViewerCountChanged, liveId.String(), now, LiveViewerCountEventData{LiveId: liveId.String(), Viewers: count})
	})
}
