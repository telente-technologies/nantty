package services

import (
	"context"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/integrations"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/guestslot"
	"zudomart/modules/live/src/generated/ent/livesafetystate"
	"zudomart/modules/live/src/generated/ent/livesession"
)

func (service *LiveService) IssueMediaToken(ctx context.Context, actor types.Actor, liveId uuid.UUID) (types.MediaTokenView, error) {
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return types.MediaTokenView{}, liveerrors.LiveNotFound
	}
	if err != nil {
		return types.MediaTokenView{}, err
	}
	if session.State == livesession.StateEnded {
		return types.MediaTokenView{}, liveerrors.LiveNotActive
	}
	role, canPublish := "viewer", false
	if session.HostID == actor.UserId {
		role, canPublish = "host", true
	} else {
		seated, err := service.Client.GuestSlot.Query().Where(
			guestslot.LiveID(liveId), guestslot.UserID(actor.UserId),
			guestslot.StateIn(guestslot.State(SlotJoining), guestslot.State(SlotOnStage), guestslot.State(SlotReconnecting)),
		).Exist(ctx)
		if err != nil {
			return types.MediaTokenView{}, err
		}
		if seated {
			role, canPublish = "guest", true
		} else if err := service.requireLiveAccess(ctx, session, actor.UserId); err != nil {
			return types.MediaTokenView{}, err
		}
	}
	if canPublish {
		held, err := service.Client.LiveSafetyState.Query().Where(livesafetystate.LiveID(liveId), livesafetystate.HoldActive(true)).Exist(ctx)
		if err != nil {
			return types.MediaTokenView{}, err
		}
		canPublish = !held
	}
	participants, err := service.lookupParticipants(ctx, actor.UserId)
	if err != nil {
		return types.MediaTokenView{}, err
	}
	token, err := service.Tokens.IssueParticipantToken(integrations.MediaGrant{
		Room: session.LivekitRoom, Identity: actor.UserId.String(), Name: participants[actor.UserId].Name,
		CanPublish: canPublish, Role: role, TimeToLive: service.Settings.MediaTokenTimeToLive,
	})
	if err != nil {
		return types.MediaTokenView{}, err
	}
	return types.MediaTokenView{Url: service.Settings.LiveKitPublicUrl, Token: token, CanPublish: canPublish, Role: role}, nil
}
