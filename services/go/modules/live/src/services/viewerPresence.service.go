package services

import (
	"context"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/livesession"
	"zudomart/modules/live/src/generated/ent/liveviewer"
)

func (service *LiveService) JoinLiveAsViewer(ctx context.Context, actor types.Actor, liveId uuid.UUID) error {
	return service.changeViewerPresence(ctx, actor.UserId, liveId, true)
}

func (service *LiveService) LeaveLiveAsViewer(ctx context.Context, actor types.Actor, liveId uuid.UUID) error {
	return service.changeViewerPresence(ctx, actor.UserId, liveId, false)
}

func (service *LiveService) changeViewerPresence(ctx context.Context, userId, liveId uuid.UUID, joining bool) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if joining && session.State != livesession.StateLive {
			return liveerrors.LiveNotActive
		}
		now := service.Now()
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
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveViewerCountChanged, liveId.String(), now, events.LiveViewerCountEventData{LiveId: liveId.String(), Viewers: count})
	})
}
