package controllers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"nantty/modules/live/src/container"
	"nantty/modules/live/src/errors"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/generated/ent/spaceparticipant"
	"nantty/modules/live/src/integrations"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

type SpacesController struct{ Container *container.Container }

func (c SpacesController) rateLimit(w http.ResponseWriter, r *http.Request, actorID uuid.UUID) bool {
	if spacesMutationLimiter.allow(actorID) {
		return true
	}
	w.Header().Set("Retry-After", "60")
	httpserver.WriteJsonResponse(w, http.StatusTooManyRequests, httpserver.NewApiError(http.StatusTooManyRequests, "RATE_LIMITED", "Too many Space actions. Please try again later."))
	return false
}

type spaceCreateRequest struct {
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	Visibility   string     `json:"visibility"`
	ScheduledAt  *time.Time `json:"scheduledAt"`
	GiftsEnabled *bool      `json:"giftsEnabled"`
}

func coinContributionsEnabled(preference *bool) bool {
	return preference != nil && *preference
}

func (c SpacesController) List(w http.ResponseWriter, r *http.Request) {
	var viewer *types.Actor
	if actor, actorErr := utils.ActorFrom(r); actorErr == nil {
		viewer = &actor
	}
	states := strings.Split(r.URL.Query().Get("state"), ",")
	if r.URL.Query().Get("state") == "" {
		states = []string{"live", "upcoming"}
	}
	stateValues := make([]space.State, 0, len(states))
	for _, state := range states {
		switch strings.TrimSpace(state) {
		case "live":
			stateValues = append(stateValues, space.StateLive)
		case "scheduled", "upcoming":
			stateValues = append(stateValues, space.StateScheduled)
		}
	}
	if len(stateValues) == 0 {
		httpserver.WriteJsonResponse(w, http.StatusOK, []spaceSummaryResponse{})
		return
	}
	rows, err := c.Container.Client.Space.Query().Where(space.StateIn(stateValues...), space.ModerationVisibilityEQ("visible")).Order(space.ByState(), space.ByScheduledAt()).Limit(100).All(r.Context())
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	views, err := c.presentSpaceSummaries(r.Context(), rows, viewer)
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	limit := 30
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		_, parsedLimit, parseErr := utils.PageParameters(r, 30, 100)
		if parseErr != nil {
			c.responder().Error(w, r, parseErr)
			return
		}
		limit = parsedLimit
	}
	if len(views) > limit {
		views = views[:limit]
	}
	httpserver.WriteJsonResponse(w, http.StatusOK, views)
}

func (c SpacesController) Create(w http.ResponseWriter, r *http.Request) {
	actor, err := utils.ActorFrom(r)
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	if !c.rateLimit(w, r, actor.UserId) {
		return
	}
	if err := c.ensureSpaceHostEligible(r.Context(), actor); err != nil {
		c.responder().Error(w, r, err)
		return
	}
	if err := services.NewLiveService(c.Container).EnsureHostCanGoLive(r.Context(), actor.UserId.String()); err != nil {
		c.responder().Error(w, r, err)
		return
	}
	var input spaceCreateRequest
	if err = json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&input); err != nil {
		c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "body", Message: "invalid JSON"}}))
		return
	}
	input.Title = strings.TrimSpace(input.Title)
	if input.Title == "" || len(input.Title) > 140 {
		c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "title", Message: "must contain 1 to 140 characters"}}))
		return
	}
	visibility := input.Visibility
	if visibility == "" {
		visibility = "public"
	}
	if visibility != "public" && visibility != "followers" && visibility != "subscribers" && visibility != "invite_only" {
		c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "visibility", Message: "unsupported audience policy"}}))
		return
	}
	profiles, profileErr := c.Container.Directory.LookupParticipants(r.Context(), []uuid.UUID{actor.UserId})
	if profileErr != nil {
		c.responder().Error(w, r, profileErr)
		return
	}
	room := "space_" + uuid.NewString()
	databaseVisibility := visibility
	metadata := map[string]any{}
	if visibility == "invite_only" {
		// Keep the DB enum backward-compatible while invite-only membership lives in
		// the already-available JSON metadata column and is checked server-side.
		databaseVisibility = "public"
		metadata["spaceAudiencePolicy"] = "invite_only"
		metadata["invitedAccountIds"] = []string{}
	}
	// Coin support is an explicit host opt-in. Older clients that omit the
	// preference must not silently enable money contributions.
	giftsEnabled := coinContributionsEnabled(input.GiftsEnabled)
	query := c.Container.Client.Space.Create().SetHostID(actor.UserId).SetTitle(input.Title).SetDescription(input.Description).SetVisibility(space.Visibility(databaseVisibility)).SetLivekitRoom(room).SetGiftsEnabled(giftsEnabled).SetMetadata(metadata)
	if input.ScheduledAt != nil {
		if !input.ScheduledAt.After(c.Container.Now()) {
			c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "scheduledAt", Message: "must be in the future"}}))
			return
		}
		query.SetScheduledAt(*input.ScheduledAt)
	} else {
		if err := c.Container.Media.EnsureRoom(r.Context(), room); err != nil {
			c.responder().Error(w, r, err)
			return
		}
		query.SetState(space.StateLive).SetStartedAt(c.Container.Now())
	}
	row, err := query.Save(r.Context())
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	httpserver.WriteJsonResponse(w, http.StatusCreated, spaceSummaryResponse{ID: row.ID.String(), Title: row.Title, Description: row.Description, State: row.State, ScheduledAt: row.ScheduledAt, StartedAt: row.StartedAt, Visibility: visibility, Host: describeSpacePerson(row.HostID, "host", false, profiles)})
}

func spaceVisibility(row *ent.Space) string {
	if services.IsInviteOnlySpace(row) {
		return "invite_only"
	}
	return string(row.Visibility)
}

func (c SpacesController) transition(w http.ResponseWriter, r *http.Request, target string) {
	var row *ent.Space
	actor, err := utils.ActorFrom(r)
	if err == nil {
		var id uuid.UUID
		id, err = utils.PathIdentifier(r, "spaceId")
		if err == nil {
			row, err = c.Container.Client.Space.Get(r.Context(), id)
			if err == nil && !spaceHostAuthorized(row.HostID, actor.UserId) {
				err = httpserver.ErrForbidden
			}
			if err == nil && target == "live" {
				err = c.ensureSpaceHostEligible(r.Context(), actor)
				if err == nil {
					err = services.NewLiveService(c.Container).EnsureHostCanGoLive(r.Context(), actor.UserId.String())
				}
			}
			if err == nil {
				if string(row.State) == target {
					httpserver.WriteJsonResponse(w, http.StatusOK, row)
					return
				}
				if !spaceTransitionAllowed(string(row.State), target) {
					err = httpserver.NewApiError(http.StatusConflict, "SPACE_STATE_CONFLICT", "This Space cannot make that state transition.")
				} else {
					update := c.Container.Client.Space.UpdateOneID(id).SetState(space.State(target))
					now := c.Container.Now()
					if target == "live" {
						update.SetStartedAt(now)
						if err = c.Container.Media.EnsureRoom(r.Context(), row.LivekitRoom); err != nil {
							c.responder().Error(w, r, err)
							return
						}
					} else {
						update.SetEndedAt(now)
						_ = c.Container.Media.DeleteRoom(r.Context(), row.LivekitRoom)
					}
					row, err = update.Save(r.Context())
				}
			}
		}
	}
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	httpserver.WriteJsonResponse(w, http.StatusOK, row)
}

func spaceHostAuthorized(hostID, actorID uuid.UUID) bool { return hostID == actorID }

func spaceHostIsCreator(actor types.Actor) bool { return actor.HasRole("creator") }

func (c SpacesController) ensureSpaceHostEligible(ctx context.Context, actor types.Actor) error {
	if !spaceHostIsCreator(actor) {
		return errors.CreatorProgramNeeded
	}
	if c.Container.Directory == nil {
		return errors.CreatorProgramNeeded
	}
	participants, err := c.Container.Directory.LookupParticipants(ctx, []uuid.UUID{actor.UserId})
	if err != nil {
		return err
	}
	participant, ok := participants[actor.UserId]
	if !ok || !participant.IsCreatorProgramMember {
		return errors.CreatorProgramNeeded
	}
	return nil
}

func spaceTransitionAllowed(current, target string) bool {
	return target == "live" && current == "scheduled" || target == "ended" && current == "live" || target == "cancelled" && current == "scheduled"
}

func (c SpacesController) Start(w http.ResponseWriter, r *http.Request) { c.transition(w, r, "live") }
func (c SpacesController) End(w http.ResponseWriter, r *http.Request)   { c.transition(w, r, "ended") }
func (c SpacesController) Cancel(w http.ResponseWriter, r *http.Request) {
	c.transition(w, r, "cancelled")
}

func (c SpacesController) MediaToken(w http.ResponseWriter, r *http.Request) {
	actor, err := utils.ActorFrom(r)
	if err == nil {
		var id uuid.UUID
		id, err = utils.PathIdentifier(r, "spaceId")
		if err == nil {
			var row *ent.Space
			row, err = c.Container.Client.Space.Get(r.Context(), id)
			if err == nil {
				err = c.authorizeSpaceAudience(r.Context(), row, actor.UserId)
			}
			if err == nil {
				var participant *ent.SpaceParticipant
				participant, err = c.Container.Client.SpaceParticipant.Query().Where(spaceparticipant.SpaceID(id), spaceparticipant.AccountID(actor.UserId), spaceparticipant.StateEQ(spaceparticipant.StateActive)).Only(r.Context())
				if ent.IsNotFound(err) {
					err = httpserver.ErrForbidden
				}
				if err == nil {
					canPublish := participant.Role == spaceparticipant.RoleHost || (participant.Role == spaceparticipant.RoleSpeaker || participant.Role == spaceparticipant.RoleModerator) && !participant.MutedByHost
					token, issueErr := c.Container.Tokens.IssueParticipantToken(integrations.MediaGrant{
						Room: row.LivekitRoom, Identity: actor.UserId.String(), Name: "Space participant", CanPublish: canPublish,
						AudioOnly: true, Role: string(participant.Role), TimeToLive: c.Container.Settings.MediaTokenTimeToLive,
					})
					err = issueErr
					if err == nil {
						httpserver.WriteJsonResponse(w, http.StatusOK, map[string]any{"url": c.Container.Settings.LiveKitPublicUrl, "token": token, "canPublish": canPublish, "role": participant.Role, "stageTitle": participant.StageTitle})
						return
					}
				}
			}
		}
	}
	if err != nil {
		c.responder().Error(w, r, err)
	}
}

func (c SpacesController) responder() utils.Responder {
	return utils.Responder{Logger: c.Container.Logger}
}
