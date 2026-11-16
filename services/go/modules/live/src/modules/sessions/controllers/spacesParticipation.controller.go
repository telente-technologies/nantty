package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/spaceparticipant"
	"nantty/modules/live/src/integrations"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

type spaceJoinResponse struct {
	SpaceID    string `json:"spaceId"`
	Role       string `json:"role"`
	StageTitle string `json:"stageTitle,omitempty"`
	Token      string `json:"token"`
	URL        string `json:"url"`
	CanPublish bool   `json:"canPublish"`
	Listeners  int    `json:"listeners"`
}

func (c SpacesController) Join(w http.ResponseWriter, r *http.Request) {
	actor, ok := c.spaceActor(w, r)
	if !ok {
		return
	}
	id, err := utils.PathIdentifier(r, "spaceId")
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	row, err := c.Container.Client.Space.Get(r.Context(), id)
	if err != nil {
		c.responder().Error(w, r, utils.OrNotFound(err))
		return
	}
	if err = c.authorizeSpaceAudience(r.Context(), row, actor.UserId); err != nil {
		c.responder().Error(w, r, err)
		return
	}
	role, listeners, muted, err := c.joinSpace(r.Context(), id, actor.UserId)
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	participant, participantErr := c.Container.Client.SpaceParticipant.Query().Where(spaceparticipant.SpaceID(id), spaceparticipant.AccountID(actor.UserId), spaceparticipant.StateEQ(spaceparticipant.StateActive)).Only(r.Context())
	if participantErr != nil {
		c.responder().Error(w, r, participantErr)
		return
	}
	canPublish := role == spaceparticipant.RoleHost || (role == spaceparticipant.RoleSpeaker || role == spaceparticipant.RoleModerator) && !muted
	grant, err := c.Container.Tokens.IssueParticipantToken(integrations.MediaGrant{
		Room: row.LivekitRoom, Identity: actor.UserId.String(), Name: "Space participant", Role: string(role),
		CanPublish: canPublish, AudioOnly: true, TimeToLive: c.Container.Settings.MediaTokenTimeToLive,
	})
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	httpserver.WriteJsonResponse(w, http.StatusOK, spaceJoinResponse{SpaceID: id.String(), Role: string(role), StageTitle: participant.StageTitle, Token: grant, URL: c.Container.Settings.LiveKitPublicUrl, CanPublish: canPublish, Listeners: listeners})
}

func (c SpacesController) Leave(w http.ResponseWriter, r *http.Request) {
	actor, ok := c.spaceActor(w, r)
	if !ok {
		return
	}
	id, err := utils.PathIdentifier(r, "spaceId")
	if err == nil {
		err = c.leaveSpace(r.Context(), id, actor.UserId)
	}
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	httpserver.WriteNoContentResponse(w)
}

func (c SpacesController) SpeakerRequest(w http.ResponseWriter, r *http.Request) {
	actor, ok := c.spaceActor(w, r)
	if !ok {
		return
	}
	id, err := utils.PathIdentifier(r, "spaceId")
	if err == nil {
		var result *ent.SpaceSpeakerRequest
		result, err = c.requestSpeaker(r.Context(), id, actor.UserId)
		if err == nil {
			httpserver.WriteJsonResponse(w, http.StatusCreated, result)
			return
		}
	}
	c.responder().Error(w, r, err)
}

func (c SpacesController) DecideSpeakerRequest(w http.ResponseWriter, r *http.Request, approve bool) {
	actor, ok := c.spaceActor(w, r)
	if !ok {
		return
	}
	spaceID, err := utils.PathIdentifier(r, "spaceId")
	var requestID uuid.UUID
	if err == nil {
		requestID, err = utils.PathIdentifier(r, "requestId")
	}
	if err == nil {
		err = c.decideSpeakerRequest(r.Context(), spaceID, requestID, actor.UserId, approve)
	}
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	httpserver.WriteNoContentResponse(w)
}

func (c SpacesController) ApproveSpeakerRequest(w http.ResponseWriter, r *http.Request) {
	c.DecideSpeakerRequest(w, r, true)
}
func (c SpacesController) DeclineSpeakerRequest(w http.ResponseWriter, r *http.Request) {
	c.DecideSpeakerRequest(w, r, false)
}

func (c SpacesController) MuteSpeaker(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Muted *bool `json:"muted"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&body); err != nil || body.Muted == nil {
		c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "muted", Message: "must be provided"}}))
		return
	}
	actor, ok := c.spaceActor(w, r)
	if !ok {
		return
	}
	spaceID, err := utils.PathIdentifier(r, "spaceId")
	var userID uuid.UUID
	if err == nil {
		userID, err = utils.PathIdentifier(r, "userId")
	}
	if err == nil {
		err = c.muteSpeaker(r.Context(), spaceID, userID, actor.UserId, *body.Muted)
	}
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	httpserver.WriteNoContentResponse(w)
}

func (c SpacesController) RemoveSpeaker(w http.ResponseWriter, r *http.Request) {
	c.controlSpeaker(w, r, "remove")
}
func (c SpacesController) DemoteSpeaker(w http.ResponseWriter, r *http.Request) {
	c.controlSpeaker(w, r, "demote")
}

func (c SpacesController) controlSpeaker(w http.ResponseWriter, r *http.Request, action string) {
	actor, ok := c.spaceActor(w, r)
	if !ok {
		return
	}
	spaceID, err := utils.PathIdentifier(r, "spaceId")
	var userID uuid.UUID
	if err == nil {
		userID, err = utils.PathIdentifier(r, "userId")
	}
	if err == nil {
		err = c.controlSpaceParticipant(r.Context(), spaceID, userID, actor.UserId, action)
	}
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	httpserver.WriteNoContentResponse(w)
}
