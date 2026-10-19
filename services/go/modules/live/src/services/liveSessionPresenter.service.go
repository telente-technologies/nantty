package services

import (
	"context"
	"time"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
)

func formatTime(moment time.Time) string { return moment.UTC().Format(time.RFC3339Nano) }

func formatOptionalTime(moment *time.Time) *string {
	if moment == nil {
		return nil
	}
	formatted := formatTime(*moment)
	return &formatted
}

func formatOptionalUuid(identifier *uuid.UUID) *string {
	if identifier == nil {
		return nil
	}
	formatted := identifier.String()
	return &formatted
}

func (service *LiveService) presentLiveSession(ctx context.Context, session *ent.LiveSession) (types.LiveSessionView, error) {
	participants, err := service.lookupParticipants(ctx, session.HostID)
	if err != nil {
		return types.LiveSessionView{}, err
	}
	followers, following, err := service.Relations.FollowCounts(ctx, session.HostID)
	if err != nil {
		service.Logger.WarnContext(ctx, "host follow counts unavailable", "error", err)
	}
	status := "upcoming"
	switch session.State {
	case "live", "connecting":
		status = "live"
	case "ended":
		status = "ended"
	}
	return types.LiveSessionView{
		Id: session.ID.String(), Host: types.HostSummary{UserSummary: summarise(participants[session.HostID]), Followers: followers, Following: following},
		Title: session.Title, Category: string(session.Category), State: string(session.State), Status: status, Visibility: string(session.Visibility),
		Viewers: session.Viewers, PeakViewers: session.PeakViewers, StartedAt: formatOptionalTime(session.StartedAt), EndedAt: formatOptionalTime(session.EndedAt),
		ScheduledAt: formatOptionalTime(session.ScheduledAt), CoverUrl: session.CoverURL, Media: types.MediaConnection{LivekitUrl: service.Settings.LiveKitPublicUrl},
		GiftsEnabled: session.GiftsEnabled, HostIsCreator: session.HostIsCreator, StoreId: formatOptionalUuid(session.StoreID), Products: []any{},
		PinnedProductId: formatOptionalUuid(session.PinnedProductID), LiveAdSettings: session.LiveAdSettings,
		AcceptedLiveAdTermsVersion: session.AcceptedLiveAdTermsVersion, SponsorshipLine: session.SponsorshipLine,
		TopSupporterUserId: formatOptionalUuid(session.TopSupporterUserID),
	}, nil
}

func (service *LiveService) GetLiveSession(ctx context.Context, liveId uuid.UUID, viewer uuid.UUID) (types.LiveSessionView, error) {
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return types.LiveSessionView{}, liveerrors.LiveNotFound
	}
	if err != nil {
		return types.LiveSessionView{}, err
	}
	decision, err := service.DecideLiveAccess(ctx, session, viewer)
	if err != nil {
		return types.LiveSessionView{}, err
	}
	if decision.Reason == "privateAccount" || decision.Reason == "blocked" {
		return types.LiveSessionView{}, liveerrors.LiveNotAccessible
	}
	view, err := service.presentLiveSession(ctx, session)
	if err != nil {
		return view, err
	}
	view.Access = types.LiveAccessView{Allowed: decision.Allowed, Reason: decision.Reason}
	if !decision.Allowed {
		return lockedLiveView(view), nil
	}
	if session.State != "ended" {
		view.Safety = service.LiveSafetyViewFor(ctx, session, viewer)
		view.HostRanking = service.hostRankingFor(ctx, session)
	}
	return view, nil
}

// lockedLiveView keeps only what a "Follow / Subscribe to watch" screen needs; no media, playback or commerce details.
func lockedLiveView(view types.LiveSessionView) types.LiveSessionView {
	view.PlaybackUrl, view.Media = nil, types.MediaConnection{}
	view.StoreId, view.Products, view.PinnedProductId, view.LiveAdSettings, view.SponsorshipLine, view.TopSupporterUserId = nil, []any{}, nil, nil, nil, nil
	view.AcceptedLiveAdTermsVersion, view.GiftsEnabled = nil, false
	return view
}

func (service *LiveService) GetLiveSafety(ctx context.Context, liveId uuid.UUID, viewer uuid.UUID) (*types.LiveSafetyView, error) {
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return nil, liveerrors.LiveNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := service.requireLiveAccess(ctx, session, viewer); err != nil {
		return nil, err
	}
	return service.LiveSafetyViewFor(ctx, session, viewer), nil
}
