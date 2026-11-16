package controllers

import (
	"encoding/json"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
	"nantty/modules/live/src/events"
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
		Role      string `json:"role"`
		Title     string `json:"title"`
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
	role, validRole := NormalizeSpaceInviteRole(body.Role)
	if !validRole {
		c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "role", Message: "must be listener, speaker, or cohost"}}))
		return
	}
	title, validTitle := NormalizeSpaceStageTitle(body.Title)
	if !validTitle {
		c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "title", Message: "must be plain text with at most 60 characters"}}))
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
		if err == nil {
			metadata, invitation, created := services.AddSpaceInvitation(row, accountID, role, title, spaceTime(c))
			_, err = tx.Space.UpdateOneID(spaceID).SetMetadata(metadata).Save(r.Context())
			if err == nil && created {
				err = events.EnqueueOutboxEventInTransaction(r.Context(), tx, "space.invited", spaceID.String(), spaceTime(c), map[string]any{
					"spaceId": spaceID.String(), "invitationId": invitation.ID, "accountId": accountID.String(), "role": role, "title": title, "invitedBy": actor.UserId.String(),
				})
			}
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

func NormalizeSpaceInviteRole(role string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "", "listener":
		return "listener", true
	case "speaker":
		return "speaker", true
	case "cohost", "co-host", "moderator":
		return "moderator", true
	default:
		return "", false
	}
}

func NormalizeSpaceStageTitle(title string) (string, bool) {
	title = strings.TrimSpace(strings.ToValidUTF8(title, "�"))
	if utf8.RuneCountInString(title) > 60 {
		return "", false
	}
	for _, value := range title {
		if unicode.IsControl(value) {
			return "", false
		}
	}
	return title, true
}

func (c SpacesController) AcceptInvite(w http.ResponseWriter, r *http.Request) {
	c.respondToInvite(w, r, true)
}

func (c SpacesController) DeclineInvite(w http.ResponseWriter, r *http.Request) {
	c.respondToInvite(w, r, false)
}

func (c SpacesController) respondToInvite(w http.ResponseWriter, r *http.Request, accept bool) {
	actor, ok := c.spaceActor(w, r)
	if !ok {
		return
	}
	spaceID, err := utils.PathIdentifier(r, "spaceId")
	var invitationID uuid.UUID
	if err == nil {
		invitationID, err = utils.PathIdentifier(r, "invitationId")
	}
	var changed bool
	if err == nil {
		err = c.Container.RunInTransaction(r.Context(), func(tx *ent.Tx) error {
			row, queryErr := tx.Space.Query().Where(space.ID(spaceID)).ForUpdate().Only(r.Context())
			if ent.IsNotFound(queryErr) {
				return httpserver.ErrNotFound
			}
			if queryErr != nil {
				return queryErr
			}
			metadata, invitation, didChange, respondErr := services.RespondToSpaceInvitation(row, invitationID, actor.UserId, accept, spaceTime(c))
			if respondErr != nil {
				if respondErr.Error() == "SPACE_INVITATION_NOT_FOUND" {
					return httpserver.ErrNotFound
				}
				return httpserver.NewApiError(http.StatusConflict, "SPACE_INVITATION_CLOSED", "This Space invitation has already been answered.")
			}
			changed = didChange
			if didChange {
				if _, saveErr := tx.Space.UpdateOneID(spaceID).SetMetadata(metadata).Save(r.Context()); saveErr != nil {
					return saveErr
				}
				eventType := "space.inviteDeclined"
				if accept {
					eventType = "space.inviteAccepted"
				}
				return events.EnqueueOutboxEventInTransaction(r.Context(), tx, eventType, spaceID.String(), spaceTime(c), map[string]any{
					"spaceId": spaceID.String(), "invitationId": invitation.ID, "accountId": actor.UserId.String(), "role": invitation.Role, "title": invitation.Title,
				})
			}
			return nil
		})
	}
	if err != nil {
		c.responder().Error(w, r, utils.OrNotFound(err))
		return
	}
	_ = changed // The response intentionally stays 204 for idempotent repeated decisions.
	httpserver.WriteNoContentResponse(w)
}
