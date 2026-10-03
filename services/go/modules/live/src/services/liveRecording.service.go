package services

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/google/uuid"

	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/liverecording"
	"zudomart/modules/live/src/generated/ent/livesession"
	"zudomart/modules/live/src/integrations"
	"zudomart/modules/live/src/types"
)

func (service *LiveService) SetRecordingEnabled(ctx context.Context, actor types.Actor, liveId uuid.UUID, enabled bool) (types.RoomSettingsView, error) {
	session, err := service.requireHost(ctx, actor, liveId)
	if err != nil {
		return types.RoomSettingsView{}, err
	}
	if session.State == livesession.StateEnded {
		return types.RoomSettingsView{}, liveerrors.LiveNotActive
	}
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := ensureRoomSettingsRow(ctx, tx, liveId)
		if err != nil {
			return err
		}
		return row.Update().SetRecordEnabled(enabled).Exec(ctx)
	})
	if err != nil {
		return types.RoomSettingsView{}, err
	}
	if enabled {
		if err := service.startRecordingWhenEnabled(ctx, session); errors.Is(err, integrations.ErrRecordingUnavailable) {
			return types.RoomSettingsView{}, liveerrors.RecordingNotReady
		} else if err != nil {
			return types.RoomSettingsView{}, err
		}
	} else if err := service.stopActiveRecordings(ctx, liveId); err != nil {
		return types.RoomSettingsView{}, err
	}
	return service.GetRoomSettings(ctx, actor, liveId)
}

func (service *LiveService) startRecordingWhenEnabled(ctx context.Context, session *ent.LiveSession) error {
	settings, err := service.loadRoomSettings(ctx, session.ID)
	if err != nil || !settings.RecordEnabled || session.State != livesession.StateLive {
		return err
	}
	active, err := service.Client.LiveRecording.Query().Where(liverecording.LiveID(session.ID), liverecording.StateEQ(liverecording.StateRecording)).Exist(ctx)
	if err != nil || active {
		return err
	}
	recordingId := uuid.New()
	objectKey := "recordings/" + session.ID.String() + "/" + recordingId.String() + ".mp4"
	egressId, err := service.Recorder.StartRoomRecording(ctx, session.LivekitRoom, objectKey)
	if err != nil {
		return err
	}
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.LiveRecording.Create().SetID(recordingId).SetLiveID(session.ID).SetEgressID(egressId).SetObjectKey(objectKey).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveRecordingStarted, session.ID.String(), service.Now(), events.LiveRecordingEventData{
			LiveId: session.ID.String(), RecordingId: recordingId.String(),
		})
	})
}

func (service *LiveService) stopActiveRecordings(ctx context.Context, liveId uuid.UUID) error {
	rows, err := service.Client.LiveRecording.Query().Where(liverecording.LiveID(liveId), liverecording.StateEQ(liverecording.StateRecording)).All(ctx)
	if err != nil {
		return err
	}
	var failures []error
	for _, row := range rows {
		failures = append(failures, service.Recorder.StopRecording(ctx, row.EgressID))
	}
	return errors.Join(failures...)
}

func (service *LiveService) ListLiveRecordings(ctx context.Context, actor types.Actor, liveId uuid.UUID) ([]types.RecordingView, error) {
	if _, err := service.requireHost(ctx, actor, liveId); err != nil {
		return nil, err
	}
	rows, err := service.Client.LiveRecording.Query().Where(liverecording.LiveID(liveId)).Order(ent.Desc(liverecording.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]types.RecordingView, 0, len(rows))
	for _, row := range rows {
		view := types.RecordingView{
			Id: row.ID.String(), LiveId: liveId.String(), State: string(row.State), DurationSeconds: row.DurationSeconds, SizeBytes: row.SizeBytes,
			CreatedAt: formatTime(row.CreatedAt), CompletedAt: formatOptionalTime(row.CompletedAt),
		}
		if row.State == liverecording.StateCompleted {
			url, err := service.RecordingStorage.PresignDownload(ctx, row.ObjectKey, service.Settings.RecordingDownloadTimeToLive)
			if err != nil {
				service.Logger.Warn("recording link could not be signed", slog.String("recordingId", row.ID.String()), slog.Any("error", err))
			} else {
				view.PlaybackUrl = &url
			}
		}
		views = append(views, view)
	}
	return views, nil
}

type EgressOutcome struct {
	EgressId      string
	Succeeded     bool
	DurationNanos int64
	SizeBytes     int64
	FailureReason string
}

func (service *LiveService) RecordEgressOutcome(ctx context.Context, outcome EgressOutcome) error {
	row, err := service.Client.LiveRecording.Query().Where(liverecording.EgressID(outcome.EgressId)).Only(ctx)
	if ent.IsNotFound(err) || (err == nil && row.State != liverecording.StateRecording) {
		return nil
	}
	if err != nil {
		return err
	}
	now := service.Now()
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.LiveRecording.UpdateOneID(row.ID).SetCompletedAt(now)
		eventType, data := events.LiveRecordingDone, events.LiveRecordingEventData{LiveId: row.LiveID.String(), RecordingId: row.ID.String()}
		if outcome.Succeeded {
			seconds := int64(time.Duration(outcome.DurationNanos) / time.Second)
			update.SetState(liverecording.StateCompleted).SetDurationSeconds(seconds).SetSizeBytes(outcome.SizeBytes)
			data.DurationSeconds, data.SizeBytes = seconds, outcome.SizeBytes
		} else {
			reason := truncateText(outcome.FailureReason, 200)
			update.SetState(liverecording.StateFailed).SetFailureReason(reason)
			eventType, data.Reason = events.LiveRecordingFailed, reason
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, row.LiveID.String(), now, data)
	})
}

func truncateText(text string, limit int) string {
	runes := []rune(text)
	if len(runes) <= limit {
		return text
	}
	return string(runes[:limit])
}
