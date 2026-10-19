package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/livesession"
	"zudomart/modules/live/src/types"
)

func (service *LiveService) CurrentLiveOfHostForViewer(ctx context.Context, hostId uuid.UUID, viewer uuid.UUID) (types.HostLiveStatusView, error) {
	session, err := service.Client.LiveSession.Query().
		Where(livesession.HostID(hostId), livesession.StateEQ(livesession.StateLive), livesession.ModerationVisibilityIn("visible", "restricted")).
		Order(ent.Desc(livesession.FieldStartedAt)).First(ctx)
	if ent.IsNotFound(err) {
		return types.HostLiveStatusView{}, nil
	}
	if err != nil {
		return types.HostLiveStatusView{}, err
	}
	if viewer == uuid.Nil {
		hidden, err := service.hostHiddenByPrivateAccount(ctx, hostId, viewer)
		if err != nil {
			return types.HostLiveStatusView{}, err
		}
		if hidden || session.Visibility != livesession.VisibilityPublic {
			return types.HostLiveStatusView{}, nil
		}
	} else {
		decision, err := service.DecideLiveAccess(ctx, session, viewer)
		if err != nil {
			return types.HostLiveStatusView{}, err
		}
		if !decision.Allowed {
			return types.HostLiveStatusView{}, nil
		}
	}
	liveStreamId := session.ID.String()
	return types.HostLiveStatusView{LiveStreamId: &liveStreamId, StartedAt: formatOptionalTime(session.StartedAt)}, nil
}
