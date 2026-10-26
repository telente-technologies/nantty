package controllers

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/generated/ent/spaceparticipant"
	"nantty/modules/live/src/generated/ent/spacespeakerrequest"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/types"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

type spaceDetailsResponse struct {
	ID                     string                     `json:"id"`
	Title                  string                     `json:"title"`
	Description            string                     `json:"description,omitempty"`
	State                  space.State                `json:"state"`
	ScheduledAt            *time.Time                 `json:"scheduledAt,omitempty"`
	StartedAt              *time.Time                 `json:"startedAt,omitempty"`
	ListenerCount          int                        `json:"listenerCount"`
	Host                   spacePerson                `json:"host"`
	Speakers               []spacePerson              `json:"speakers"`
	ViewerRole             *string                    `json:"viewerRole,omitempty"`
	ViewerJoined           *bool                      `json:"viewerJoined,omitempty"`
	SpeakerRequestState    *spacespeakerrequest.State `json:"speakerRequestState,omitempty"`
	PendingSpeakerRequests []pendingSpaceRequest      `json:"pendingSpeakerRequests,omitempty"`
}

type spacePerson struct {
	ID        string  `json:"id"`
	Name      *string `json:"name,omitempty"`
	Username  *string `json:"username,omitempty"`
	AvatarURL *string `json:"avatarUrl,omitempty"`
	Role      string  `json:"role"`
	Muted     bool    `json:"muted,omitempty"`
}

type pendingSpaceRequest struct {
	ID   string      `json:"id"`
	User spacePerson `json:"user"`
}

type spaceDetailRelations interface {
	BlockedEitherWay(ctx context.Context, userID uuid.UUID, others []uuid.UUID) (map[uuid.UUID]bool, error)
	IsFollowing(ctx context.Context, followerID, followeeID uuid.UUID) (bool, error)
	FollowedAmong(ctx context.Context, followerID uuid.UUID, candidates []uuid.UUID) (map[uuid.UUID]bool, error)
	IsActiveSubscriber(ctx context.Context, subscriberID, creatorID uuid.UUID) (bool, error)
	PrivateAccountsAmong(ctx context.Context, userIDs []uuid.UUID) (map[uuid.UUID]bool, error)
}

func (c SpacesController) Detail(w http.ResponseWriter, r *http.Request) {
	id, err := utils.PathIdentifier(r, "spaceId")
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	row, err := c.Container.Client.Space.Get(r.Context(), id)
	if ent.IsNotFound(err) || err == nil && row.ModerationVisibility != "visible" {
		err = httpserver.ErrNotFound
	}
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	var viewer *types.Actor
	if actor, actorErr := utils.ActorFrom(r); actorErr == nil {
		viewer = &actor
	}
	if err = c.authorizeSpaceDetails(r.Context(), row, viewer); err != nil {
		c.responder().Error(w, r, err)
		return
	}

	active, err := c.Container.Client.SpaceParticipant.Query().Where(
		spaceparticipant.SpaceID(id), spaceparticipant.StateEQ(spaceparticipant.StateActive),
	).All(r.Context())
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	profileIDs := []uuid.UUID{row.HostID}
	var viewerParticipant *ent.SpaceParticipant
	var moderator bool
	for _, participant := range active {
		if participant.Role == spaceparticipant.RoleSpeaker {
			profileIDs = append(profileIDs, participant.AccountID)
		}
		if viewer != nil && participant.AccountID == viewer.UserId {
			viewerParticipant = participant
		}
	}
	if viewer != nil {
		moderator, err = c.isSpaceModerator(r.Context(), row, viewer.UserId)
		if err != nil {
			c.responder().Error(w, r, err)
			return
		}
	}

	var pending []*ent.SpaceSpeakerRequest
	if viewer != nil && moderator {
		pending, err = c.Container.Client.SpaceSpeakerRequest.Query().Where(
			spacespeakerrequest.SpaceID(id), spacespeakerrequest.StateEQ(spacespeakerrequest.StatePending), spacespeakerrequest.ExpiresAtGT(spaceTime(c)),
		).Order(ent.Desc(spacespeakerrequest.FieldCreatedAt)).Limit(50).All(r.Context())
		if err != nil {
			c.responder().Error(w, r, err)
			return
		}
		for _, request := range pending {
			profileIDs = append(profileIDs, request.AccountID)
		}
	}
	profiles := map[uuid.UUID]interfaces.Participant{}
	if c.Container.Directory != nil {
		profiles, err = c.Container.Directory.LookupParticipants(r.Context(), profileIDs)
		if err != nil {
			c.responder().Error(w, r, err)
			return
		}
	}
	response := spaceDetailsResponse{
		ID: id.String(), Title: row.Title, Description: row.Description, State: row.State,
		ScheduledAt: row.ScheduledAt, StartedAt: row.StartedAt, ListenerCount: row.Listeners,
		Host: describeSpacePerson(row.HostID, "host", false, profiles), Speakers: make([]spacePerson, 0),
	}
	for _, participant := range active {
		if participant.Role == spaceparticipant.RoleSpeaker {
			response.Speakers = append(response.Speakers, describeSpacePerson(participant.AccountID, "speaker", participant.MutedByHost, profiles))
		}
	}
	if viewer != nil {
		joined := viewerParticipant != nil
		role := "listener"
		if viewer.UserId == row.HostID {
			role = "host"
		} else if moderator {
			role = "moderator"
		} else if viewerParticipant != nil && viewerParticipant.Role == spaceparticipant.RoleSpeaker {
			role = "speaker"
		}
		response.ViewerRole, response.ViewerJoined = &role, &joined
		request, queryErr := c.Container.Client.SpaceSpeakerRequest.Query().Where(
			spacespeakerrequest.SpaceID(id), spacespeakerrequest.AccountID(viewer.UserId),
		).Order(ent.Desc(spacespeakerrequest.FieldCreatedAt)).First(r.Context())
		if queryErr != nil && !ent.IsNotFound(queryErr) {
			c.responder().Error(w, r, queryErr)
			return
		}
		if queryErr == nil && (request.State != spacespeakerrequest.StatePending || request.ExpiresAt.After(spaceTime(c))) {
			response.SpeakerRequestState = &request.State
		}
	}
	for _, request := range pending {
		response.PendingSpeakerRequests = append(response.PendingSpeakerRequests, pendingSpaceRequest{
			ID: request.ID.String(), User: describeSpacePerson(request.AccountID, "listener", false, profiles),
		})
	}
	httpserver.WriteJsonResponse(w, http.StatusOK, response)
}

func (c SpacesController) authorizeSpaceDetails(ctx context.Context, row *ent.Space, viewer *types.Actor) error {
	return authorizeSpaceDetails(ctx, row, viewer, c.Container.Relations)
}

func authorizeSpaceDetails(ctx context.Context, row *ent.Space, viewer *types.Actor, relations spaceDetailRelations) error {
	if row.ModerationVisibility != "visible" {
		return httpserver.ErrNotFound
	}
	if relations == nil {
		return httpserver.NewApiError(http.StatusServiceUnavailable, "SPACE_ACCESS_UNAVAILABLE", "Space access checks are temporarily unavailable.")
	}
	viewerID := uuid.Nil
	if viewer != nil {
		viewerID = viewer.UserId
	}
	if viewerID != row.HostID {
		private, err := relations.PrivateAccountsAmong(ctx, []uuid.UUID{row.HostID})
		if err != nil {
			return err
		}
		if private[row.HostID] {
			if viewer == nil {
				return httpserver.ErrNotFound
			}
			following, err := relations.IsFollowing(ctx, viewerID, row.HostID)
			if err != nil {
				return err
			}
			if !following {
				return httpserver.ErrNotFound
			}
		}
	}
	if viewer == nil {
		if row.Visibility != space.VisibilityPublic {
			return httpserver.ErrNotFound
		}
		return nil
	}
	if viewerID != row.HostID {
		blocked, err := relations.BlockedEitherWay(ctx, viewerID, []uuid.UUID{row.HostID})
		if err != nil {
			return err
		}
		if blocked[row.HostID] {
			return httpserver.ErrNotFound
		}
	}
	switch row.Visibility {
	case space.VisibilityPublic:
		return nil
	case space.VisibilityFollowers:
		following, err := relations.IsFollowing(ctx, viewerID, row.HostID)
		if err != nil {
			return err
		}
		if following {
			return nil
		}
	case space.VisibilitySubscribers:
		subscribed, err := relations.IsActiveSubscriber(ctx, viewerID, row.HostID)
		if err != nil {
			return err
		}
		if subscribed {
			return nil
		}
	}
	return httpserver.ErrNotFound
}

func describeSpacePerson(id uuid.UUID, role string, muted bool, profiles map[uuid.UUID]interfaces.Participant) spacePerson {
	person := spacePerson{ID: id.String(), Role: role, Muted: muted}
	if profile, ok := profiles[id]; ok {
		if profile.Name != "" {
			person.Name = &profile.Name
		}
		if profile.Username != "" {
			person.Username = &profile.Username
		}
		person.AvatarURL = profile.AvatarUrl
	}
	return person
}
