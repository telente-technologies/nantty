package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/guestslot"
	"zudomart/modules/live/internal/ent/livesession"
	"zudomart/modules/live/internal/media"
)

type MediaTokenView struct {
	Url        string `json:"url"`
	Token      string `json:"token"`
	CanPublish bool   `json:"canPublish"`
	Role       string `json:"role"`
}

func (application *LiveApplication) IssueMediaToken(ctx context.Context, actor Actor, liveId uuid.UUID) (MediaTokenView, error) {
	session, err := application.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return MediaTokenView{}, errLiveNotFound
	}
	if err != nil {
		return MediaTokenView{}, err
	}
	if session.State == livesession.StateEnded {
		return MediaTokenView{}, errLiveNotActive
	}
	role, canPublish := "viewer", false
	if session.HostID == actor.UserId {
		role, canPublish = "host", true
	} else {
		seated, err := application.Client.GuestSlot.Query().Where(
			guestslot.LiveID(liveId), guestslot.UserID(actor.UserId),
			guestslot.StateIn(guestslot.State(domain.SlotJoining), guestslot.State(domain.SlotOnStage), guestslot.State(domain.SlotReconnecting)),
		).Exist(ctx)
		if err != nil {
			return MediaTokenView{}, err
		}
		if seated {
			role, canPublish = "guest", true
		}
	}
	participants, err := application.lookupParticipants(ctx, actor.UserId)
	if err != nil {
		return MediaTokenView{}, err
	}
	token, err := application.Tokens.IssueParticipantToken(media.MediaGrant{
		Room: session.LivekitRoom, Identity: actor.UserId.String(), Name: participants[actor.UserId].Name,
		CanPublish: canPublish, Role: role, TimeToLive: application.Settings.MediaTokenTimeToLive,
	})
	if err != nil {
		return MediaTokenView{}, err
	}
	return MediaTokenView{Url: application.Settings.LiveKitPublicUrl, Token: token, CanPublish: canPublish, Role: role}, nil
}
