package controllers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"nantty/modules/live/src/container"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/integrations"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

type SpacesController struct{ Container *container.Container }

type spaceCreateRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Visibility  string     `json:"visibility"`
	ScheduledAt *time.Time `json:"scheduledAt"`
}

func (c SpacesController) List(w http.ResponseWriter, r *http.Request) {
	states := strings.Split(r.URL.Query().Get("state"), ",")
	if r.URL.Query().Get("state") == "" {
		states = []string{"live", "scheduled"}
	}
	stateValues := make([]space.State, 0, len(states))
	for _, state := range states {
		if state == "live" || state == "scheduled" {
			stateValues = append(stateValues, space.State(state))
		}
	}
	rows, err := c.Container.Client.Space.Query().Where(space.StateIn(stateValues...), space.VisibilityEQ(space.VisibilityPublic), space.ModerationVisibilityEQ("visible")).Order(space.ByState(), space.ByScheduledAt()).Limit(50).All(r.Context())
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	httpserver.WriteJsonResponse(w, http.StatusOK, rows)
}

func (c SpacesController) Create(w http.ResponseWriter, r *http.Request) {
	actor, err := utils.ActorFrom(r)
	if err != nil {
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
	if visibility != "public" && visibility != "followers" && visibility != "subscribers" {
		c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "visibility", Message: "unsupported audience policy"}}))
		return
	}
	room := "space_" + uuid.NewString()
	query := c.Container.Client.Space.Create().SetHostID(actor.UserId).SetTitle(input.Title).SetDescription(input.Description).SetVisibility(space.Visibility(visibility)).SetLivekitRoom(room)
	if input.ScheduledAt != nil {
		if !input.ScheduledAt.After(c.Container.Now()) {
			c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "scheduledAt", Message: "must be in the future"}}))
			return
		}
		query.SetScheduledAt(*input.ScheduledAt)
	}
	row, err := query.Save(r.Context())
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	httpserver.WriteJsonResponse(w, http.StatusCreated, row)
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
			if err == nil && (!spaceHostAuthorized(row.HostID, actor.UserId) || row.State != space.StateLive) {
				err = httpserver.ErrForbidden
			}
			if err == nil {
				token, issueErr := c.Container.Tokens.IssueParticipantToken(integrations.MediaGrant{
					Room: row.LivekitRoom, Identity: actor.UserId.String(), Name: "Host", CanPublish: true,
					AudioOnly: true, Role: "space_host", TimeToLive: c.Container.Settings.MediaTokenTimeToLive,
				})
				err = issueErr
				if err == nil {
					httpserver.WriteJsonResponse(w, http.StatusOK, map[string]any{"url": c.Container.Settings.LiveKitPublicUrl, "token": token, "canPublish": true, "role": "host"})
					return
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
