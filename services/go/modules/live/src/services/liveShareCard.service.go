package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/livesession"
	"nantty/modules/live/src/types"
)

func (service *LiveService) BuildLiveShareCard(ctx context.Context, liveId, viewerId uuid.UUID) (types.ShareCardView, error) {
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return types.ShareCardView{Availability: "unavailable"}, nil
	}
	if err != nil {
		return types.ShareCardView{}, err
	}
	decision, err := service.DecideLiveAccess(ctx, session, viewerId)
	if err != nil {
		return types.ShareCardView{}, err
	}
	if !decision.Allowed {
		if decision.Reason == "followersOnly" || decision.Reason == "subscribersOnly" {
			return types.ShareCardView{Availability: "private"}, nil
		}
		return types.ShareCardView{Availability: "unavailable"}, nil
	}
	participants, err := service.lookupParticipants(ctx, session.HostID)
	if err != nil {
		return types.ShareCardView{}, err
	}
	host := summarise(participants[session.HostID])
	status := "ENDED"
	var viewers *int
	isLive := session.State == livesession.StateLive
	if isLive {
		status = "LIVE"
		count := session.Viewers
		viewers = &count
	} else if session.State != livesession.StateEnded {
		status = "UPCOMING"
	}
	title, subtitle := session.Title, host.Name
	return types.ShareCardView{
		Availability: "available", Title: &title, Subtitle: &subtitle, ImageUrl: session.CoverURL, IsLive: isLive, Status: status, ViewerCount: viewers, Host: &host,
	}, nil
}

func (service *LiveService) GetLiveAdEligibility(ctx context.Context, liveId uuid.UUID) (types.LiveAdEligibilityView, error) {
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return types.LiveAdEligibilityView{Reason: "notFound", Placements: []string{}}, nil
	}
	if err != nil {
		return types.LiveAdEligibilityView{}, err
	}
	view := types.LiveAdEligibilityView{Placements: []string{}, Sponsorship: session.SponsorshipLine}
	switch {
	case session.State != livesession.StateLive:
		view.Reason = "notLive"
	case !liveAdsAllowed(session):
		view.Reason = "adsNotAllowed"
	default:
		if termsErr := service.ensureLiveAdTermsCurrent(session); termsErr != nil {
			view.Reason = "termsNotCurrent"
			return view, nil
		}
		view.Eligible = true
		view.Placements, view.Maximum, view.MinInterval, view.Indicator = readAdPlacementSettings(session.LiveAdSettings)
	}
	return view, nil
}

func readAdPlacementSettings(settings map[string]any) (placements []string, maximum, interval int, indicator bool) {
	placements = []string{}
	if listed, ok := settings["placements"].([]any); ok {
		for _, item := range listed {
			if name, isText := item.(string); isText {
				placements = append(placements, name)
			}
		}
	}
	if value, ok := settings["maxInterruptions"].(float64); ok {
		maximum = int(value)
	}
	if value, ok := settings["minIntervalMinutes"].(float64); ok {
		interval = int(value)
	}
	indicator, _ = settings["showAdIndicator"].(bool)
	return placements, maximum, interval, indicator
}
