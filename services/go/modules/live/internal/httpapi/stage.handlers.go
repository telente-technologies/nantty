package httpapi

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/application"
	"zudomart/platform/httpserver"
)

func (routes LiveRoutes) respondWithStage(writer http.ResponseWriter, request *http.Request, actor application.Actor, liveId uuid.UUID, extra *application.MediaTokenView) {
	stage, err := routes.Application.GetLiveStage(request.Context(), liveId, &actor.UserId)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	if extra == nil {
		httpserver.WriteJsonResponse(writer, http.StatusOK, stage)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, struct {
		application.LiveStageView
		Livekit *application.MediaTokenView `json:"livekit"`
	}{stage, extra})
}

func (routes LiveRoutes) runStageCommand(writer http.ResponseWriter, request *http.Request, command func(application.Actor, uuid.UUID) error) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		if err := command(actor, liveId); err != nil {
			return err
		}
		routes.respondWithStage(writer, request, actor, liveId, nil)
		return nil
	})
}

func (routes LiveRoutes) getLiveStage(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		routes.respondWithStage(writer, request, actor, liveId, nil)
		return nil
	})
}

func (routes LiveRoutes) searchViewersToInvite(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		viewers, err := routes.Application.SearchViewersToInvite(request.Context(), actor, liveId, request.URL.Query().Get("q"))
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, viewers)
		}
		return err
	})
}

func (routes LiveRoutes) inviteGuest(writer http.ResponseWriter, request *http.Request) {
	routes.runStageCommand(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		body, err := decodeAndValidate(writer, request, ValidateInviteGuestRequest)
		if err != nil {
			return err
		}
		return routes.Application.InviteGuestToStage(request.Context(), actor, liveId, uuid.MustParse(body.UserId))
	})
}

func (routes LiveRoutes) cancelGuestInvitation(writer http.ResponseWriter, request *http.Request) {
	routes.runStageCommand(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		slotId, err := pathIdentifier(request, "slotId")
		if err != nil {
			return err
		}
		return routes.Application.CancelGuestInvitation(request.Context(), actor, liveId, slotId)
	})
}

func (routes LiveRoutes) respondToInvitation(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		slotId, err := pathIdentifier(request, "slotId")
		response := request.PathValue("response")
		if err != nil || (response != "accept" && response != "decline") {
			return orNotFound(err)
		}
		if err := routes.Application.RespondToStageInvitation(request.Context(), actor, liveId, slotId, response == "accept"); err != nil {
			return err
		}
		var media *application.MediaTokenView
		if response == "accept" {
			if token, tokenErr := routes.Application.IssueMediaToken(request.Context(), actor, liveId); tokenErr == nil {
				media = &token
			}
		}
		routes.respondWithStage(writer, request, actor, liveId, media)
		return nil
	})
}

func orNotFound(err error) error {
	if err != nil {
		return err
	}
	return httpserver.ErrNotFound
}

func (routes LiveRoutes) requestToJoinStage(writer http.ResponseWriter, request *http.Request) {
	routes.runStageCommand(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		return routes.Application.RequestToJoinStage(request.Context(), actor, liveId)
	})
}

func (routes LiveRoutes) decideJoinRequest(writer http.ResponseWriter, request *http.Request) {
	routes.runStageCommand(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		requestId, err := pathIdentifier(request, "requestId")
		decision := request.PathValue("decision")
		if err != nil || (decision != "approve" && decision != "decline") {
			return orNotFound(err)
		}
		return routes.Application.DecideStageJoinRequest(request.Context(), actor, liveId, requestId, decision == "approve")
	})
}

func resolveTargetUser(request *http.Request, actor application.Actor) (uuid.UUID, error) {
	if request.PathValue("userId") == "me" {
		return actor.UserId, nil
	}
	return pathIdentifier(request, "userId")
}

func (routes LiveRoutes) removeGuest(writer http.ResponseWriter, request *http.Request) {
	routes.runStageCommand(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		userId, err := pathIdentifier(request, "userId")
		if err != nil {
			return err
		}
		var body removeGuestRequest
		if request.ContentLength > 0 {
			if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
				return err
			}
		}
		return routes.Application.RemoveGuestFromStage(request.Context(), actor, liveId, userId, body.Reason)
	})
}

func (routes LiveRoutes) muteStreamer(writer http.ResponseWriter, request *http.Request) {
	routes.runStageCommand(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		userId, err := resolveTargetUser(request, actor)
		if err != nil {
			return err
		}
		body, err := decodeAndValidate(writer, request, ValidateMuteRequest)
		if err != nil {
			return err
		}
		return routes.Application.MuteStageStreamer(request.Context(), actor, liveId, userId, application.MuteGuestInput{Audio: body.Audio, Video: body.Video})
	})
}

func (routes LiveRoutes) leaveStage(writer http.ResponseWriter, request *http.Request) {
	routes.runStageCommand(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		return routes.Application.LeaveStageAsGuest(request.Context(), actor, liveId)
	})
}

func (routes LiveRoutes) reportGuestConnection(writer http.ResponseWriter, request *http.Request) {
	routes.runStageCommand(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		body, err := decodeAndValidate(writer, request, ValidateConnectionRequest)
		if err != nil {
			return err
		}
		return routes.Application.ReportGuestMediaConnection(request.Context(), actor, liveId, *body.Connected)
	})
}
