package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/livesession"
	"zudomart/modules/live/src/generated/ent/liveviewer"
	"zudomart/modules/live/src/types"
)

const maximumPresenceIdsPerChange = 500

func (service *LiveService) JoinLiveAsViewer(ctx context.Context, actor types.Actor, liveId uuid.UUID) error {
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return liveerrors.LiveNotFound
	}
	if err != nil {
		return err
	}
	if err := service.requireLiveAccess(ctx, session, actor.UserId); err != nil {
		return err
	}
	return service.changeViewerPresence(ctx, liveId, []uuid.UUID{actor.UserId}, nil, true)
}

func (service *LiveService) LeaveLiveAsViewer(ctx context.Context, actor types.Actor, liveId uuid.UUID) error {
	return service.changeViewerPresence(ctx, liveId, nil, []uuid.UUID{actor.UserId}, false)
}

func (service *LiveService) ApplyPresenceChange(ctx context.Context, liveId uuid.UUID, input types.PresenceChangeInput) error {
	if len(input.Joined)+len(input.Left) > maximumPresenceIdsPerChange {
		return liveerrors.Unprocessable("PRESENCE_BATCH_TOO_LARGE", "Send at most 500 presence changes per call.")
	}
	joined, err := parseDistinctIdentifiers(input.Joined)
	if err != nil {
		return err
	}
	left, err := parseDistinctIdentifiers(input.Left)
	if err != nil {
		return err
	}
	stillPresent := map[uuid.UUID]bool{}
	for _, userId := range joined {
		stillPresent[userId] = true
	}
	var departed []uuid.UUID
	for _, userId := range left {
		if !stillPresent[userId] {
			departed = append(departed, userId)
		}
	}
	return service.changeViewerPresence(ctx, liveId, joined, departed, false)
}

func parseDistinctIdentifiers(raw []string) ([]uuid.UUID, error) {
	seen := map[uuid.UUID]bool{}
	parsed := make([]uuid.UUID, 0, len(raw))
	for _, value := range raw {
		identifier, err := uuid.Parse(value)
		if err != nil {
			return nil, liveerrors.Unprocessable("PRESENCE_USER_INVALID", "Presence changes must contain valid user ids.")
		}
		if !seen[identifier] {
			seen[identifier] = true
			parsed = append(parsed, identifier)
		}
	}
	return parsed, nil
}

func (service *LiveService) changeViewerPresence(ctx context.Context, liveId uuid.UUID, joining, leaving []uuid.UUID, rejectWhenNotLive bool) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if session.State != livesession.StateLive && len(joining) > 0 {
			if rejectWhenNotLive {
				return liveerrors.LiveNotActive
			}
			joining = nil
		}
		now := service.Now()
		for _, userId := range joining {
			if userId == session.HostID {
				continue
			}
			err := tx.LiveViewer.Create().SetLiveID(liveId).SetUserID(userId).SetLastSeenAt(now).
				OnConflictColumns(liveviewer.FieldLiveID, liveviewer.FieldUserID).UpdateLastSeenAt().ClearLeftAt().Exec(ctx)
			if err != nil {
				return err
			}
		}
		if len(leaving) > 0 {
			if err := tx.LiveViewer.Update().Where(liveviewer.LiveID(liveId), liveviewer.UserIDIn(leaving...), liveviewer.LeftAtIsNil()).SetLeftAt(now).Exec(ctx); err != nil {
				return err
			}
		}
		return service.reconcileViewerCount(ctx, tx, session, now)
	})
}

func (service *LiveService) recountViewers(ctx context.Context, liveId uuid.UUID) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		return service.reconcileViewerCount(ctx, tx, session, service.Now())
	})
}

func (service *LiveService) reconcileViewerCount(ctx context.Context, tx *ent.Tx, session *ent.LiveSession, now time.Time) error {
	count, err := tx.LiveViewer.Query().Where(liveviewer.LiveID(session.ID), liveviewer.LeftAtIsNil()).Count(ctx)
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
	return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveViewerCountChanged, session.ID.String(), now, events.LiveViewerCountEventData{LiveId: session.ID.String(), Viewers: count})
}
