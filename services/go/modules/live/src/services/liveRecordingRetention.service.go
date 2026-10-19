package services

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/liverecording"
	"zudomart/modules/live/src/generated/ent/livesafetystate"
	"zudomart/modules/live/src/types"
)

const (
	LiveRecordingRetentionWindow    = 15 * 24 * time.Hour
	recordingRetentionPageSize      = 100
	recordingRetentionMaximumPerRun = 500
)

func (service *LiveService) PurgeUnrepostedLiveRecordingsPastRetention(ctx context.Context) (int, error) {
	now := service.Now()
	cutoff := now.Add(-LiveRecordingRetentionWindow)
	purged, scanned := 0, 0
	var after uuid.UUID
	for scanned < recordingRetentionMaximumPerRun {
		page, err := service.Client.LiveRecording.Query().
			Where(liverecording.RepostedAtIsNil(), liverecording.LegalHold(false), liverecording.CreatedAtLTE(cutoff), liverecording.IDGT(after)).
			Order(ent.Asc(liverecording.FieldID)).Limit(recordingRetentionPageSize).All(ctx)
		if err != nil || len(page) == 0 {
			return purged, err
		}
		scanned += len(page)
		after = page[len(page)-1].ID
		for _, recording := range page {
			due, err := service.liveRecordingIsPastRetention(ctx, recording, cutoff)
			if err != nil {
				return purged, err
			}
			if !due {
				continue
			}
			deleted, err := service.deleteUnrepostedLiveRecording(ctx, recording.ID)
			if err != nil {
				service.Logger.Warn("expired live recording could not be deleted", slog.String("recordingId", recording.ID.String()), slog.Any("error", err))
				continue
			}
			if deleted {
				purged++
			}
		}
		if len(page) < recordingRetentionPageSize {
			break
		}
	}
	return purged, nil
}

func (service *LiveService) liveRecordingIsPastRetention(ctx context.Context, recording *ent.LiveRecording, cutoff time.Time) (bool, error) {
	held, err := service.Client.LiveSafetyState.Query().Where(livesafetystate.LiveID(recording.LiveID), livesafetystate.HoldActive(true)).Exist(ctx)
	if err != nil || held {
		return false, err
	}
	endedAt, err := service.liveEndedAtForRecording(ctx, recording)
	if err != nil || endedAt == nil {
		return false, err
	}
	return !endedAt.After(cutoff), nil
}

func (service *LiveService) liveEndedAtForRecording(ctx context.Context, recording *ent.LiveRecording) (*time.Time, error) {
	session, err := service.Client.LiveSession.Get(ctx, recording.LiveID)
	if ent.IsNotFound(err) {
		if recording.CompletedAt != nil {
			return recording.CompletedAt, nil
		}
		return &recording.CreatedAt, nil
	}
	if err != nil {
		return nil, err
	}
	return session.EndedAt, nil
}

func (service *LiveService) deleteUnrepostedLiveRecording(ctx context.Context, recordingId uuid.UUID) (bool, error) {
	deleted := false
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.LiveRecording.Query().Where(liverecording.ID(recordingId), liverecording.RepostedAtIsNil(), liverecording.LegalHold(false)).
			ForUpdate(sql.WithLockAction(sql.SkipLocked)).Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		if err := service.RecordingStorage.DeleteObject(ctx, row.ObjectKey); err != nil {
			return err
		}
		deleted = true
		return tx.LiveRecording.DeleteOneID(row.ID).Exec(ctx)
	})
	return deleted && err == nil, err
}

func (service *LiveService) RepostLiveRecording(ctx context.Context, actor types.Actor, liveId, recordingId uuid.UUID) (types.RecordingView, error) {
	if _, err := service.requireHost(ctx, actor, liveId); err != nil {
		return types.RecordingView{}, err
	}
	row, err := service.Client.LiveRecording.Query().Where(liverecording.ID(recordingId), liverecording.LiveID(liveId)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.RecordingView{}, liveerrors.RecordingNotFound
	}
	if err != nil {
		return types.RecordingView{}, err
	}
	if row.State != liverecording.StateCompleted {
		return types.RecordingView{}, liveerrors.RecordingInProgress
	}
	if row.RepostedAt == nil {
		affected, err := service.Client.LiveRecording.Update().Where(liverecording.ID(row.ID), liverecording.RepostedAtIsNil()).SetRepostedAt(service.Now()).Save(ctx)
		if err != nil {
			return types.RecordingView{}, err
		}
		if affected == 0 {
			if exists, err := service.Client.LiveRecording.Query().Where(liverecording.ID(row.ID)).Exist(ctx); err != nil || !exists {
				return types.RecordingView{}, firstError(err, liveerrors.RecordingNotFound)
			}
		}
	}
	views, err := service.ListLiveRecordings(ctx, actor, liveId)
	for _, view := range views {
		if view.Id == recordingId.String() {
			return view, err
		}
	}
	return types.RecordingView{}, firstError(err, liveerrors.RecordingNotFound)
}

func (service *LiveService) SetLiveRecordingRepostFromPost(ctx context.Context, recordingId uuid.UUID, postId string) error {
	update := service.Client.LiveRecording.Update().Where(liverecording.ID(recordingId))
	if postId = strings.TrimSpace(postId); postId == "" {
		update.ClearRepostedAt().ClearRepostedPostID()
	} else {
		update.SetRepostedAt(service.Now()).SetRepostedPostID(postId)
	}
	affected, err := update.Save(ctx)
	if err == nil && affected == 0 {
		return liveerrors.RecordingNotFound
	}
	return err
}

func (service *LiveService) SetLiveRecordingLegalHold(ctx context.Context, liveId uuid.UUID, held bool) (int, error) {
	return service.Client.LiveRecording.Update().Where(liverecording.LiveID(liveId)).SetLegalHold(held).Save(ctx)
}

func liveRecordingDeletesAt(row *ent.LiveRecording, session *ent.LiveSession) *string {
	if row.RepostedAt != nil || row.LegalHold || session == nil || session.EndedAt == nil {
		return nil
	}
	deletesAt := formatTime(session.EndedAt.Add(LiveRecordingRetentionWindow))
	return &deletesAt
}

func firstError(errs ...error) error {
	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}
