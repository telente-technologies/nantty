package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
)

type HostSummary struct {
	UserSummary
	Followers int `json:"followers"`
	Following int `json:"following"`
}

type MediaConnection struct {
	LivekitUrl string `json:"livekitUrl"`
}

type LiveSessionView struct {
	Id                         string          `json:"id"`
	Host                       HostSummary     `json:"host"`
	Title                      string          `json:"title"`
	Category                   string          `json:"category"`
	State                      string          `json:"state"`
	Status                     string          `json:"status"`
	Visibility                 string          `json:"visibility"`
	Viewers                    int             `json:"viewers"`
	PeakViewers                int             `json:"peakViewers"`
	StartedAt                  *string         `json:"startedAt"`
	EndedAt                    *string         `json:"endedAt"`
	CoverUrl                   *string         `json:"coverUrl"`
	PlaybackUrl                *string         `json:"playbackUrl"`
	Media                      MediaConnection `json:"media"`
	GiftsEnabled               bool            `json:"giftsEnabled"`
	HostIsCreator              bool            `json:"hostIsCreator"`
	IsFollowingHost            bool            `json:"isFollowingHost"`
	Products                   []any           `json:"products"`
	PinnedProductId            *string         `json:"pinnedProductId"`
	LiveAdSettings             map[string]any  `json:"liveAdSettings"`
	AcceptedLiveAdTermsVersion *string         `json:"acceptedLiveAdTermsVersion"`
	SponsorshipLine            *string         `json:"sponsorshipLine"`
	TopSupporterUserId         *string         `json:"topSupporterUserId"`
}

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

func (application *LiveApplication) presentLiveSession(ctx context.Context, session *ent.LiveSession) (LiveSessionView, error) {
	participants, err := application.lookupParticipants(ctx, session.HostID)
	if err != nil {
		return LiveSessionView{}, err
	}
	status := "live"
	if session.State == "ended" {
		status = "ended"
	}
	return LiveSessionView{
		Id: session.ID.String(), Host: HostSummary{UserSummary: summarise(participants[session.HostID])},
		Title: session.Title, Category: string(session.Category), State: string(session.State), Status: status, Visibility: string(session.Visibility),
		Viewers: session.Viewers, PeakViewers: session.PeakViewers, StartedAt: formatOptionalTime(session.StartedAt), EndedAt: formatOptionalTime(session.EndedAt),
		CoverUrl: session.CoverURL, Media: MediaConnection{LivekitUrl: application.Settings.LiveKitPublicUrl},
		GiftsEnabled: session.GiftsEnabled, HostIsCreator: session.HostIsCreator, Products: []any{},
		PinnedProductId: formatOptionalUuid(session.PinnedProductID), LiveAdSettings: session.LiveAdSettings,
		AcceptedLiveAdTermsVersion: session.AcceptedLiveAdTermsVersion, SponsorshipLine: session.SponsorshipLine,
		TopSupporterUserId: formatOptionalUuid(session.TopSupporterUserID),
	}, nil
}

func (application *LiveApplication) GetLiveSession(ctx context.Context, liveId uuid.UUID) (LiveSessionView, error) {
	session, err := application.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return LiveSessionView{}, errLiveNotFound
	}
	if err != nil {
		return LiveSessionView{}, err
	}
	return application.presentLiveSession(ctx, session)
}
