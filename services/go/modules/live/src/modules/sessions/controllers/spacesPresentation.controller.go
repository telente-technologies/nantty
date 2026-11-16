package controllers

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
	"nantty/platform/httpserver"
)

type SpaceSummaryResponse struct {
	ID            string      `json:"id"`
	Title         string      `json:"title"`
	Description   string      `json:"description,omitempty"`
	State         space.State `json:"state"`
	ScheduledAt   *time.Time  `json:"scheduledAt,omitempty"`
	StartedAt     *time.Time  `json:"startedAt,omitempty"`
	ListenerCount int         `json:"listenerCount"`
	Visibility    string      `json:"visibility"`
	Host          spacePerson `json:"host"`
}

func (c SpacesController) PresentSpaceSummaries(ctx context.Context, rows []*ent.Space, viewer *types.Actor) ([]SpaceSummaryResponse, error) {
	accessible, err := filterAccessibleSpaceRows(ctx, rows, viewer, c.Container.Relations)
	if err != nil {
		return nil, err
	}
	if len(accessible) == 0 {
		return []SpaceSummaryResponse{}, nil
	}
	profileIDs := make([]uuid.UUID, 0, len(accessible))
	seen := make(map[uuid.UUID]struct{}, len(accessible))
	for _, row := range accessible {
		if _, ok := seen[row.HostID]; !ok {
			seen[row.HostID] = struct{}{}
			profileIDs = append(profileIDs, row.HostID)
		}
	}
	profiles := map[uuid.UUID]interfaces.Participant{}
	if c.Container.Directory != nil {
		profiles, err = c.Container.Directory.LookupParticipants(ctx, profileIDs)
		if err != nil {
			return nil, err
		}
	}
	views := make([]SpaceSummaryResponse, 0, len(accessible))
	for _, row := range accessible {
		views = append(views, SpaceSummaryResponse{
			ID: row.ID.String(), Title: row.Title, Description: row.Description, State: row.State,
			ScheduledAt: row.ScheduledAt, StartedAt: row.StartedAt, ListenerCount: row.Listeners, Visibility: spaceVisibility(row),
			Host: describeSpacePerson(row.HostID, "host", false, profiles),
		})
	}
	return views, nil
}

func filterAccessibleSpaceRows(ctx context.Context, rows []*ent.Space, viewer *types.Actor, relations SpaceDetailRelations) ([]*ent.Space, error) {
	accessible := make([]*ent.Space, 0, len(rows))
	if len(rows) == 0 {
		return accessible, nil
	}
	if relations == nil {
		return nil, httpserver.NewApiError(http.StatusServiceUnavailable, "SPACE_ACCESS_UNAVAILABLE", "Space access checks are temporarily unavailable.")
	}
	hostIDs := make([]uuid.UUID, 0, len(rows))
	seen := make(map[uuid.UUID]struct{}, len(rows))
	for _, row := range rows {
		if _, ok := seen[row.HostID]; !ok {
			seen[row.HostID] = struct{}{}
			hostIDs = append(hostIDs, row.HostID)
		}
	}
	private, err := relations.PrivateAccountsAmong(ctx, hostIDs)
	if err != nil {
		return nil, err
	}
	viewerID := uuid.Nil
	blocked, followed := map[uuid.UUID]bool{}, map[uuid.UUID]bool{}
	if viewer != nil {
		viewerID = viewer.UserId
		blocked, err = relations.BlockedEitherWay(ctx, viewerID, hostIDs)
		if err != nil {
			return nil, err
		}
		followed, err = relations.FollowedAmong(ctx, viewerID, hostIDs)
		if err != nil {
			return nil, err
		}
	}
	for _, row := range rows {
		if row.ModerationVisibility != "visible" {
			continue
		}
		isHost := viewer != nil && row.HostID == viewerID
		if services.IsInviteOnlySpace(row) {
			if viewer == nil || !services.SpaceHasInvite(row, viewerID) {
				continue
			}
			blocked, err := relations.BlockedEitherWay(ctx, viewerID, []uuid.UUID{row.HostID})
			if err != nil {
				return nil, err
			}
			if blocked[row.HostID] {
				continue
			}
			accessible = append(accessible, row)
			continue
		}
		if viewer == nil {
			if row.Visibility != space.VisibilityPublic || private[row.HostID] {
				continue
			}
		} else if !isHost {
			if blocked[row.HostID] || private[row.HostID] && !followed[row.HostID] {
				continue
			}
			switch row.Visibility {
			case space.VisibilityPublic:
			case space.VisibilityFollowers:
				if !followed[row.HostID] {
					continue
				}
			case space.VisibilitySubscribers:
				subscribed, err := relations.IsActiveSubscriber(ctx, viewerID, row.HostID)
				if err != nil {
					return nil, err
				}
				if !subscribed {
					continue
				}
			default:
				continue
			}
		}
		accessible = append(accessible, row)
	}
	return accessible, nil
}
