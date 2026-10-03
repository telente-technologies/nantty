package services

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/types"
)

const maximumLiveAlertRecipients = 1000

type liveStartedAudience struct {
	Host      types.UserSummary
	Recipient []string
	Truncated bool
}

func (service *LiveService) resolveLiveStartedAudience(ctx context.Context, hostId uuid.UUID, visibility string) liveStartedAudience {
	audience := liveStartedAudience{Recipient: []string{}}
	participants, err := service.lookupParticipants(ctx, hostId)
	if err != nil {
		service.Logger.Warn("host summary unavailable for live.started", slog.Any("error", err))
	}
	audience.Host = summarise(participants[hostId])
	if visibility == "subscribers" {
		return audience
	}
	recipients, truncated, err := service.Relations.ListLiveAlertRecipients(ctx, hostId, maximumLiveAlertRecipients)
	if err != nil {
		service.Logger.Warn("live alert recipients unavailable", slog.Any("error", err))
		return audience
	}
	for _, recipient := range recipients {
		audience.Recipient = append(audience.Recipient, recipient.String())
	}
	audience.Truncated = truncated
	return audience
}

func liveStartedEventData(session *ent.LiveSession, startedAt time.Time, audience liveStartedAudience) events.LiveStartedEventData {
	return events.LiveStartedEventData{
		LiveId: session.ID.String(), HostId: session.HostID.String(), Title: session.Title, Category: string(session.Category),
		Visibility: string(session.Visibility), NotifyAudience: events.NotifyAudienceForVisibility(string(session.Visibility)),
		CoverUrl: session.CoverURL, StartedAt: formatTime(startedAt), Host: audience.Host, HostName: audience.Host.Name, HostHandle: audience.Host.Username,
		IsShopping: session.Category == "shopping", NotifyUserIds: audience.Recipient, NotifyTruncated: audience.Truncated,
	}
}
