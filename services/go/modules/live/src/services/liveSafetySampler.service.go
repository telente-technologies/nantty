package services

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/livesafetystate"
	"zudomart/modules/live/src/generated/ent/livesession"
)

const (
	captureStartingMarker = "starting"
	listedObjectsPerCall  = 200
	staleCaptureClaim     = 2 * time.Minute
)

func (service *LiveService) RunLiveSafetySamplerUntilContextDone(ctx context.Context) {
	settings := service.Settings.Safety
	if !settings.SamplerEnabled || service.Jobs == nil || service.SafetyCapture == nil || service.SafetyObjects == nil {
		return
	}
	ticker := time.NewTicker(settings.SweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := service.SweepLiveSafetySampling(ctx); err != nil && ctx.Err() == nil {
				service.Logger.WarnContext(ctx, "live safety sampling sweep failed", slog.Any("error", err))
			}
		}
	}
}

func (service *LiveService) SweepLiveSafetySampling(ctx context.Context) error {
	lives, err := service.Client.LiveSession.Query().Where(livesession.StateEQ(livesession.StateLive)).Limit(service.Settings.Safety.MaximumLivesPerSweep).All(ctx)
	if err != nil {
		return err
	}
	identifiers := make([]uuid.UUID, 0, len(lives))
	for _, live := range lives {
		identifiers = append(identifiers, live.ID)
	}
	states, err := service.safetyStatesByLive(ctx, identifiers)
	if err != nil {
		return err
	}
	for _, live := range lives {
		state, err := service.ensureSafetyState(ctx, live, states[live.ID])
		if err != nil {
			service.Logger.WarnContext(ctx, "live safety state unavailable", slog.String("liveId", live.ID.String()), slog.Any("error", err))
			continue
		}
		service.ensureSafetyCapture(ctx, live, state)
		if service.sampleLatestFrame(ctx, live, state) {
			service.queueNewAudioSegments(ctx, live, state)
		}
	}
	return service.stopCaptureForEndedLives(ctx)
}

func (service *LiveService) safetyStatesByLive(ctx context.Context, liveIds []uuid.UUID) (map[uuid.UUID]*ent.LiveSafetyState, error) {
	rows, err := service.Client.LiveSafetyState.Query().Where(livesafetystate.LiveIDIn(liveIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	byLive := make(map[uuid.UUID]*ent.LiveSafetyState, len(rows))
	for _, row := range rows {
		byLive[row.LiveID] = row
	}
	return byLive, nil
}

func (service *LiveService) ensureSafetyState(ctx context.Context, live *ent.LiveSession, state *ent.LiveSafetyState) (*ent.LiveSafetyState, error) {
	if state != nil {
		return state, nil
	}
	now := service.Now()
	err := service.Client.LiveSafetyState.Create().SetLiveID(live.ID).SetHostID(live.HostID).SetCreatedAt(now).SetUpdatedAt(now).OnConflictColumns(livesafetystate.FieldLiveID).DoNothing().Exec(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return nil, err
	}
	return service.Client.LiveSafetyState.Query().Where(livesafetystate.LiveID(live.ID)).Only(ctx)
}

func (service *LiveService) ensureSafetyCapture(ctx context.Context, live *ent.LiveSession, state *ent.LiveSafetyState) {
	settings := service.Settings.Safety
	if (state.FrameEgressID == captureStartingMarker || state.AudioEgressID == captureStartingMarker) && service.Now().Sub(state.UpdatedAt) > staleCaptureClaim {
		service.releaseStaleCaptureClaims(ctx, state)
	}
	if state.FrameEgressID == "" && service.claimCaptureSlot(ctx, state.ID, livesafetystate.FieldFrameEgressID) {
		egressId, err := service.SafetyCapture.StartFrameCapture(ctx, live.LivekitRoom, FramePrefixForLive(settings, live.ID.String())+"frame", settings.BoostedFrameInterval, settings.FrameWidth)
		service.storeCaptureId(ctx, state, livesafetystate.FieldFrameEgressID, egressId, err)
	}
	if settings.AudioEnabled && state.AudioEgressID == "" && service.claimCaptureSlot(ctx, state.ID, livesafetystate.FieldAudioEgressID) {
		egressId, err := service.SafetyCapture.StartAudioCapture(ctx, live.LivekitRoom, AudioPrefixForLive(settings, live.ID.String()), settings.AudioSegmentDuration)
		service.storeCaptureId(ctx, state, livesafetystate.FieldAudioEgressID, egressId, err)
	}
}

func (service *LiveService) claimCaptureSlot(ctx context.Context, stateId uuid.UUID, column string) bool {
	update := service.Client.LiveSafetyState.Update().Where(livesafetystate.ID(stateId))
	if column == livesafetystate.FieldFrameEgressID {
		update.Where(livesafetystate.FrameEgressID("")).SetFrameEgressID(captureStartingMarker)
	} else {
		update.Where(livesafetystate.AudioEgressID("")).SetAudioEgressID(captureStartingMarker)
	}
	claimed, err := update.Save(ctx)
	return err == nil && claimed == 1
}

func (service *LiveService) storeCaptureId(ctx context.Context, state *ent.LiveSafetyState, column, egressId string, startErr error) {
	if startErr != nil {
		service.Logger.WarnContext(ctx, "live safety capture did not start", slog.String("liveId", state.LiveID.String()), slog.String("capture", column), slog.Any("error", startErr))
		egressId = ""
	}
	update := service.Client.LiveSafetyState.UpdateOneID(state.ID)
	if column == livesafetystate.FieldFrameEgressID {
		update.SetFrameEgressID(egressId)
		state.FrameEgressID = egressId
	} else {
		update.SetAudioEgressID(egressId)
		state.AudioEgressID = egressId
	}
	if err := update.Exec(ctx); err != nil {
		service.Logger.WarnContext(ctx, "live safety capture id not stored", slog.Any("error", err))
	}
}

func (service *LiveService) sampleLatestFrame(ctx context.Context, live *ent.LiveSession, state *ent.LiveSafetyState) bool {
	settings, now := service.Settings.Safety, service.Now()
	interval, boosted := FrameIntervalForLive(settings, state, now)
	if state.FrameEgressID == "" || state.FrameEgressID == captureStartingMarker || !IsFrameSampleDue(state.LastFrameEnqueuedAt, now, interval) {
		return false
	}
	claimed, err := service.Client.LiveSafetyState.Update().Where(livesafetystate.ID(state.ID), livesafetystate.Or(livesafetystate.LastFrameEnqueuedAtIsNil(), livesafetystate.LastFrameEnqueuedAtLTE(now.Add(-interval)))).
		SetLastFrameEnqueuedAt(now).Save(ctx)
	if err != nil || claimed == 0 {
		return false
	}
	objects, err := service.SafetyObjects.ListObjectsAfter(ctx, FramePrefixForLive(settings, live.ID.String()), state.LastFrameKey, listedObjectsPerCall)
	if err != nil || len(objects) == 0 {
		return true
	}
	update := service.Client.LiveSafetyState.UpdateOneID(state.ID).SetLastFrameKey(LastKey(objects))
	newest, found := NewestSafetyObject(objects, ".jpeg", ".jpg", ".png")
	if found && now.Sub(newest.LastModified) <= settings.MaximumFrameStaleness {
		if err := service.Jobs.EnqueueJob(ctx, settings.FramesQueue, BuildLiveFrameJob(live.ID.String(), live.HostID.String(), settings.FramesBucket, newest, boosted, state.HoldActive)); err != nil {
			service.Logger.WarnContext(ctx, "live frame job not enqueued", slog.String("liveId", live.ID.String()), slog.Any("error", err))
			return true
		}
	}
	if err := update.Exec(ctx); err != nil {
		service.Logger.WarnContext(ctx, "live frame cursor not stored", slog.Any("error", err))
	}
	return true
}

func (service *LiveService) queueNewAudioSegments(ctx context.Context, live *ent.LiveSession, state *ent.LiveSafetyState) {
	settings := service.Settings.Safety
	if !settings.AudioEnabled || state.AudioEgressID == "" || state.AudioEgressID == captureStartingMarker {
		return
	}
	objects, err := service.SafetyObjects.ListObjectsAfter(ctx, AudioPrefixForLive(settings, live.ID.String()), state.LastAudioKey, listedObjectsPerCall)
	if err != nil || len(objects) == 0 {
		return
	}
	claimed, err := service.Client.LiveSafetyState.Update().Where(livesafetystate.ID(state.ID), livesafetystate.LastAudioKey(state.LastAudioKey)).SetLastAudioKey(LastKey(objects)).Save(ctx)
	if err != nil || claimed == 0 {
		return
	}
	for _, segment := range AudioSegmentsToTranscribe(objects) {
		if err := service.Jobs.EnqueueJob(ctx, settings.AudioQueue, BuildLiveAudioJob(live.ID.String(), live.HostID.String(), settings.FramesBucket, segment)); err != nil {
			service.Logger.WarnContext(ctx, "live audio job not enqueued", slog.String("liveId", live.ID.String()), slog.Any("error", err))
		}
	}
}

func (service *LiveService) stopCaptureForEndedLives(ctx context.Context) error {
	rows, err := service.Client.LiveSafetyState.Query().Where(livesafetystate.Or(livesafetystate.FrameEgressIDNEQ(""), livesafetystate.AudioEgressIDNEQ(""))).Limit(200).All(ctx)
	if err != nil || len(rows) == 0 {
		return err
	}
	liveIds := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		liveIds = append(liveIds, row.LiveID)
	}
	endedIds, err := service.Client.LiveSession.Query().Where(livesession.IDIn(liveIds...), livesession.StateEQ(livesession.StateEnded)).IDs(ctx)
	if err != nil {
		return err
	}
	ended := make(map[uuid.UUID]bool, len(endedIds))
	for _, identifier := range endedIds {
		ended[identifier] = true
	}
	for _, row := range rows {
		if ended[row.LiveID] {
			service.StopSafetyCaptureForLive(ctx, row)
		}
	}
	return nil
}

func (service *LiveService) StopSafetyCaptureForLive(ctx context.Context, state *ent.LiveSafetyState) {
	for _, egressId := range []string{state.FrameEgressID, state.AudioEgressID} {
		if egressId != "" && egressId != captureStartingMarker && service.SafetyCapture != nil {
			service.bestEffortMedia(ctx, "stop safety capture", service.SafetyCapture.StopCapture(ctx, egressId))
		}
	}
	if err := service.Client.LiveSafetyState.UpdateOneID(state.ID).SetFrameEgressID("").SetAudioEgressID("").Exec(ctx); err != nil {
		service.Logger.WarnContext(ctx, "live safety capture ids not cleared", slog.Any("error", err))
	}
}

func (service *LiveService) releaseStaleCaptureClaims(ctx context.Context, state *ent.LiveSafetyState) {
	update := service.Client.LiveSafetyState.UpdateOneID(state.ID)
	if state.FrameEgressID == captureStartingMarker {
		update.SetFrameEgressID("")
		state.FrameEgressID = ""
	}
	if state.AudioEgressID == captureStartingMarker {
		update.SetAudioEgressID("")
		state.AudioEgressID = ""
	}
	if err := update.Exec(ctx); err != nil {
		service.Logger.WarnContext(ctx, "stale live safety capture claim not released", slog.Any("error", err))
	}
}
