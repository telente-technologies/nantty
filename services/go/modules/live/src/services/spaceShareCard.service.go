package services

import (
	"context"

	"github.com/google/uuid"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/types"
)

func (service *LiveService) BuildSpaceShareCard(ctx context.Context, spaceID, viewerID uuid.UUID) (types.ShareCardView, error) {
	row, err := service.Client.Space.Get(ctx, spaceID)
	if ent.IsNotFound(err) || err == nil && row.ModerationVisibility != "visible" {
		return types.ShareCardView{Availability: "unavailable"}, nil
	}
	if err != nil {
		return types.ShareCardView{}, err
	}
	if viewerID == uuid.Nil {
		return types.ShareCardView{Availability: "unavailable"}, nil
	}
	if row.HostID != viewerID {
		if service.Relations == nil {
			return types.ShareCardView{Availability: "unavailable"}, nil
		}
		blocked, relationErr := service.Relations.BlockedEitherWay(ctx, viewerID, []uuid.UUID{row.HostID})
		if relationErr != nil {
			return types.ShareCardView{}, relationErr
		}
		if blocked[row.HostID] {
			return types.ShareCardView{Availability: "unavailable"}, nil
		}
	}
	if IsInviteOnlySpace(row) {
		if !SpaceHasInvite(row, viewerID) {
			return types.ShareCardView{Availability: "private"}, nil
		}
	} else if row.HostID != viewerID {
		hidden, relationErr := service.hostHiddenByPrivateAccount(ctx, row.HostID, viewerID)
		if relationErr != nil {
			return types.ShareCardView{}, relationErr
		}
		if hidden {
			return types.ShareCardView{Availability: "private"}, nil
		}
		switch row.Visibility {
		case space.VisibilityFollowers:
			following, relationErr := service.Relations.IsFollowing(ctx, viewerID, row.HostID)
			if relationErr != nil {
				return types.ShareCardView{}, relationErr
			}
			if !following {
				return types.ShareCardView{Availability: "private"}, nil
			}
		case space.VisibilitySubscribers:
			subscribed, relationErr := service.Relations.IsActiveSubscriber(ctx, viewerID, row.HostID)
			if relationErr != nil {
				return types.ShareCardView{}, relationErr
			}
			if !subscribed {
				return types.ShareCardView{Availability: "private"}, nil
			}
		}
	}
	profiles, err := service.lookupParticipants(ctx, row.HostID)
	if err != nil {
		return types.ShareCardView{}, err
	}
	host := summarise(profiles[row.HostID])
	status, live := "UPCOMING", false
	switch row.State {
	case space.StateLive:
		status, live = "LIVE", true
	case space.StateEnded, space.StateCancelled:
		status = "ENDED"
	}
	title, subtitle := row.Title, host.Name
	var viewers *int
	if live {
		count := row.Listeners
		viewers = &count
	}
	return types.ShareCardView{
		Availability: "available", Title: &title, Subtitle: &subtitle,
		IsLive: live, Status: status, ViewerCount: viewers, Host: &host,
	}, nil
}
