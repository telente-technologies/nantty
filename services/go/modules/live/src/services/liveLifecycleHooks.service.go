package services

import (
	"context"
	"log/slog"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/livesafetystate"
)

func liveAdsAllowed(session *ent.LiveSession) bool {
	allowed, _ := session.LiveAdSettings["allowAds"].(bool)
	return allowed
}

func (service *LiveService) ensureLiveAdTermsCurrent(session *ent.LiveSession) error {
	if !liveAdsAllowed(session) {
		return nil
	}
	if session.AcceptedLiveAdTermsVersion == nil {
		return liveerrors.LiveAdTermsRequired
	}
	if *session.AcceptedLiveAdTermsVersion != service.Settings.LiveAdTermsCurrentVersion {
		return liveerrors.LiveAdTermsOutdated
	}
	return nil
}

func (service *LiveService) afterLiveWentLive(ctx context.Context, session *ent.LiveSession) {
	if err := service.startRecordingWhenEnabled(ctx, session); err != nil {
		service.Logger.Warn("recording did not start", slog.String("liveId", session.ID.String()), slog.Any("error", err))
	}
}

func (service *LiveService) afterLiveEnded(ctx context.Context, session *ent.LiveSession) {
	if err := service.stopActiveRecordings(ctx, session.ID); err != nil {
		service.Logger.Warn("recording did not stop cleanly", slog.String("liveId", session.ID.String()), slog.Any("error", err))
	}
	if err := service.revokeAllStreamKeys(ctx, session.ID); err != nil {
		service.Logger.Warn("stream keys were not fully revoked", slog.String("liveId", session.ID.String()), slog.Any("error", err))
	}
	if state, err := service.Client.LiveSafetyState.Query().Where(livesafetystate.LiveID(session.ID)).Only(ctx); err == nil {
		service.StopSafetyCaptureForLive(ctx, state)
	}
}
