package controllers

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/generated/ent/spaceparticipant"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

func (c SpacesController) spaceActor(w http.ResponseWriter, r *http.Request) (types.Actor, bool) {
	actor, err := utils.ActorFrom(r)
	if err != nil {
		c.responder().Error(w, r, err)
		return actor, false
	}
	if !c.rateLimit(w, r, actor.UserId) {
		return actor, false
	}
	return actor, true
}

func (c SpacesController) authorizeSpaceAudience(ctx context.Context, row *ent.Space, userID uuid.UUID) error {
	if row.State != space.StateLive {
		return httpserver.NewApiError(http.StatusConflict, "SPACE_NOT_LIVE", "This Space is not accepting listeners.")
	}
	if services.IsInviteOnlySpace(row) && !services.SpaceHasInvite(row, userID) {
		return httpserver.ErrForbidden
	}
	moderator, err := c.isSpaceModerator(ctx, row, userID)
	if err != nil {
		return err
	}
	if moderator {
		return nil
	}
	blocked, err := c.Container.Relations.BlockedEitherWay(ctx, userID, []uuid.UUID{row.HostID})
	if err != nil {
		return err
	}
	if blocked[row.HostID] {
		return httpserver.ErrForbidden
	}
	private, err := c.Container.Relations.PrivateAccountsAmong(ctx, []uuid.UUID{row.HostID})
	if err != nil {
		return err
	}
	if private[row.HostID] && userID != row.HostID && !services.IsInviteOnlySpace(row) {
		following, err := c.Container.Relations.IsFollowing(ctx, userID, row.HostID)
		if err != nil {
			return err
		}
		if !following {
			return httpserver.ErrForbidden
		}
	}
	if row.Visibility == space.VisibilityFollowers {
		following, err := c.Container.Relations.IsFollowing(ctx, userID, row.HostID)
		if err != nil {
			return err
		}
		if !following {
			return httpserver.ErrForbidden
		}
	}
	if row.Visibility == space.VisibilitySubscribers {
		subscribed, err := c.Container.Relations.IsActiveSubscriber(ctx, userID, row.HostID)
		if err != nil {
			return err
		}
		if !subscribed {
			return httpserver.ErrForbidden
		}
	}
	return nil
}

func (c SpacesController) isSpaceModerator(ctx context.Context, row *ent.Space, userID uuid.UUID) (bool, error) {
	if row.HostID == userID {
		return true, nil
	}
	cohost, err := c.Container.Client.SpaceParticipant.Query().Where(
		spaceparticipant.SpaceID(row.ID), spaceparticipant.AccountID(userID),
		spaceparticipant.StateEQ(spaceparticipant.StateActive), spaceparticipant.RoleEQ(spaceparticipant.RoleModerator),
	).Exist(ctx)
	if err != nil || cohost {
		return cohost, err
	}
	defaults, err := c.Container.Client.LiveHostDefault.Get(ctx, row.HostID)
	if ent.IsNotFound(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	for _, raw := range defaults.ModeratorIds {
		if parsed, parseErr := uuid.Parse(raw); parseErr == nil && parsed == userID {
			return true, nil
		}
	}
	return false, nil
}

func (c SpacesController) requireSpaceModerator(ctx context.Context, row *ent.Space, actorID uuid.UUID) error {
	allowed, err := c.isSpaceModerator(ctx, row, actorID)
	if err != nil {
		return err
	}
	if !allowed {
		return httpserver.ErrForbidden
	}
	return nil
}

func (c SpacesController) currentSpace(ctx context.Context, id uuid.UUID) (*ent.Space, error) {
	row, err := c.Container.Client.Space.Get(ctx, id)
	if ent.IsNotFound(err) {
		return nil, httpserver.ErrNotFound
	}
	return row, err
}

func spaceTime(c SpacesController) time.Time {
	if c.Container.Now != nil {
		return c.Container.Now().UTC()
	}
	return time.Now().UTC()
}
