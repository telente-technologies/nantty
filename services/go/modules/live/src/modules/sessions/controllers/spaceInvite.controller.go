package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

func (c SpacesController) Invite(w http.ResponseWriter, r *http.Request) {
	actor, ok := c.spaceActor(w, r)
	if !ok {
		return
	}
	spaceID, err := utils.PathIdentifier(r, "spaceId")
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	var body struct {
		AccountID string `json:"accountId"`
	}
	if err = json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&body); err != nil {
		c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "accountId", Message: "must be a valid account id"}}))
		return
	}
	accountID, err := uuid.Parse(body.AccountID)
	if err != nil || accountID == uuid.Nil || accountID == actor.UserId {
		c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "accountId", Message: "must be another valid account id"}}))
		return
	}
	if c.Container.Directory == nil {
		c.responder().Error(w, r, httpserver.NewApiError(http.StatusServiceUnavailable, "SPACE_INVITES_UNAVAILABLE", "Invites are temporarily unavailable."))
		return
	}
	profiles, err := c.Container.Directory.LookupParticipants(r.Context(), []uuid.UUID{accountID})
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	if _, exists := profiles[accountID]; !exists {
		c.responder().Error(w, r, httpserver.ErrNotFound)
		return
	}
	tx, err := c.Container.Client.Tx(r.Context())
	if err == nil {
		var row *ent.Space
		row, err = tx.Space.Query().Where(space.ID(spaceID)).ForUpdate().Only(r.Context())
		if err == nil && row.HostID != actor.UserId {
			err = httpserver.ErrForbidden
		}
		if err == nil && !services.IsInviteOnlySpace(row) {
			err = httpserver.NewApiError(http.StatusConflict, "SPACE_NOT_PRIVATE", "Invites are only used for invite-only Spaces.")
		}
		if err == nil {
			_, err = tx.Space.UpdateOneID(spaceID).SetMetadata(services.AddSpaceInvite(row, accountID)).Save(r.Context())
		}
		if err != nil {
			_ = tx.Rollback()
		} else {
			err = tx.Commit()
		}
	}
	if err != nil {
		c.responder().Error(w, r, utils.OrNotFound(err))
		return
	}
	httpserver.WriteNoContentResponse(w)
}
