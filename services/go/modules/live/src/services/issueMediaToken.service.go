package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/integrations"
	"nantty/modules/live/src/types"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/guestslot"
	"nantty/modules/live/src/generated/ent/livesafetystate"
	"nantty/modules/live/src/generated/ent/livesession"
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
	if canPublish {
		service.bestEffortMedia(ctx, "ensure room", service.Media.EnsureRoom(ctx, session.LivekitRoom))
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
