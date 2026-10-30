package controllers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"github.com/google/uuid"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/modules/sessions/announcements"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
	"net/http"
)

// AttachAnnouncement records the ordinary social post used for all room comments.
func (c SpacesController) AttachAnnouncement(w http.ResponseWriter, r *http.Request) {
	actor, err := utils.ActorFrom(r)
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	if !c.rateLimit(w, r, actor.UserId) {
		return
	}
	id, err := utils.PathIdentifier(r, "spaceId")
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	var input struct {
		PostID string `json:"postId"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&input); err != nil {
		c.responder().Error(w, r, httpserver.NewApiError(422, "INVALID_POST", "Choose an announcement post."))
		return
	}
	if _, err := uuid.Parse(input.PostID); err != nil {
		c.responder().Error(w, r, httpserver.NewApiError(422, "INVALID_POST", "Choose an announcement post."))
		return
	}
	err = c.Container.RunInTransaction(r.Context(), func(tx *ent.Tx) error {
		row, err := tx.Space.Query().Where(space.ID(id)).ForUpdate().Only(r.Context())
		if err != nil {
			return err
		}
		if row.HostID != actor.UserId {
			return httpserver.ErrForbidden
		}
		existing, _ := row.Metadata["announcementPostId"].(string)
		replay, bindingErr := announcements.Binding(existing, input.PostID)
		if bindingErr != nil {
			return httpserver.NewApiError(409, "ANNOUNCEMENT_ALREADY_BOUND", "This Space already has an announcement. Use its existing comment thread.")
		}
		if replay {
			return nil
		}
		lookup, ok := c.Container.Relations.(interface {
			LookupSpaceAnnouncement(context.Context, uuid.UUID) (announcements.Post, error)
		})
		if !ok {
			return httpserver.NewApiError(503, "ANNOUNCEMENT_VERIFICATION_UNAVAILABLE", "Announcement verification is temporarily unavailable.")
		}
		post, err := lookup.LookupSpaceAnnouncement(r.Context(), uuid.MustParse(input.PostID))
		if errors.Is(err, sql.ErrNoRows) {
			return httpserver.NewApiError(422, "INVALID_POST", "Choose your public announcement post for this Space.")
		}
		if err != nil {
			return err
		}
		if err := announcements.Validate(post, actor.UserId.String(), id.String()); err != nil {
			return httpserver.NewApiError(422, "INVALID_POST", "Choose your public announcement post for this Space.")
		}
		metadata := row.Metadata
		if metadata == nil {
			metadata = map[string]any{}
		}
		metadata["announcementPostId"] = input.PostID
		return row.Update().SetMetadata(metadata).Exec(r.Context())
	})
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	httpserver.WriteJsonResponse(w, http.StatusOK, map[string]string{"postId": input.PostID})
}
