package controllers

import (
	"nantty/modules/live/src/container"
	issuemediatoken "nantty/modules/live/src/modules/sessions/commands/issueMediaToken"
	cancelguestinvitation "nantty/modules/live/src/modules/stage/commands/cancelGuestInvitation"
	decidestagejoinrequest "nantty/modules/live/src/modules/stage/commands/decideStageJoinRequest"
	inviteguesttostage "nantty/modules/live/src/modules/stage/commands/inviteGuestToStage"
	leavestageasguest "nantty/modules/live/src/modules/stage/commands/leaveStageAsGuest"
	mutestagestreamer "nantty/modules/live/src/modules/stage/commands/muteStageStreamer"
	removeguestfromstage "nantty/modules/live/src/modules/stage/commands/removeGuestFromStage"
	reportguestmediaconnection "nantty/modules/live/src/modules/stage/commands/reportGuestMediaConnection"
	requesttojoinstage "nantty/modules/live/src/modules/stage/commands/requestToJoinStage"
	respondtostageinvitation "nantty/modules/live/src/modules/stage/commands/respondToStageInvitation"
	"nantty/modules/live/src/modules/stage/dtos"
	searchviewerstoinvite "nantty/modules/live/src/modules/stage/queries/searchViewersToInvite"
	"nantty/modules/live/src/modules/stage/validators"
	"nantty/modules/live/src/types"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
	"net/http"

	"github.com/google/uuid"
)

type StageController struct {
	Container *container.Container
}

func (controller StageController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller StageController) GetLiveStage(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		utils.RespondWithStage(controller.Container, writer, request, actor, liveId, nil)
		return nil
	})
}

func (controller StageController) SearchViewersToInvite(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		viewers, err := (searchviewerstoinvite.Handler{Container: controller.Container}).Execute(request.Context(), searchviewerstoinvite.Query{Actor: actor, LiveId: liveId, Search: request.URL.Query().Get("q")})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(viewers, ""))
		}
		return err
	})
}

func (controller StageController) InviteGuest(writer http.ResponseWriter, request *http.Request) {
	utils.RunStageCommand(controller.Container, writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidateInviteGuestRequest)
		if err != nil {
			return err
		}
		if body.Role == "" {
			body.Role = "speaker"
		}
		return (inviteguesttostage.Handler{Container: controller.Container}).Execute(request.Context(), inviteguesttostage.Command{
			Actor: actor, LiveId: liveId, GuestUserId: uuid.MustParse(body.UserId), StageRole: body.Role, StageTitle: body.Title,
		})
	})
}

func (controller StageController) CancelGuestInvitation(writer http.ResponseWriter, request *http.Request) {
	utils.RunStageCommand(controller.Container, writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		slotId, err := utils.PathIdentifier(request, "slotId")
		if err != nil {
			return err
		}
		return (cancelguestinvitation.Handler{Container: controller.Container}).Execute(request.Context(), cancelguestinvitation.Command{Actor: actor, LiveId: liveId, SlotId: slotId})
	})
}

func (controller StageController) RespondToInvitation(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		slotId, err := utils.PathIdentifier(request, "slotId")
		response := request.PathValue("response")
		if err != nil || (response != "accept" && response != "decline") {
			return utils.OrNotFound(err)
		}
		if err := (respondtostageinvitation.Handler{Container: controller.Container}).Execute(request.Context(), respondtostageinvitation.Command{Actor: actor, LiveId: liveId, SlotId: slotId, Accept: response == "accept"}); err != nil {
			return err
		}
		var media *types.MediaTokenView
		if response == "accept" {
			if token, tokenErr := (issuemediatoken.Handler{Container: controller.Container}).Execute(request.Context(), issuemediatoken.Command{Actor: actor, LiveId: liveId}); tokenErr == nil {
				media = &token
			}
		}
		utils.RespondWithStage(controller.Container, writer, request, actor, liveId, media)
		return nil
	})
}

func (controller StageController) RequestToJoinStage(writer http.ResponseWriter, request *http.Request) {
	utils.RunStageCommand(controller.Container, writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		return (requesttojoinstage.Handler{Container: controller.Container}).Execute(request.Context(), requesttojoinstage.Command{Actor: actor, LiveId: liveId})
	})
}

func (controller StageController) DecideJoinRequest(writer http.ResponseWriter, request *http.Request) {
	utils.RunStageCommand(controller.Container, writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		requestId, err := utils.PathIdentifier(request, "requestId")
		decision := request.PathValue("decision")
		if err != nil || (decision != "approve" && decision != "decline") {
			return utils.OrNotFound(err)
		}
		return (decidestagejoinrequest.Handler{Container: controller.Container}).Execute(request.Context(), decidestagejoinrequest.Command{Actor: actor, LiveId: liveId, RequestId: requestId, Approve: decision == "approve"})
	})
}

func resolveTargetUser(request *http.Request, actor types.Actor) (uuid.UUID, error) {
	if request.PathValue("userId") == "me" {
		return actor.UserId, nil
	}
	return utils.PathIdentifier(request, "userId")
}

func (controller StageController) RemoveGuest(writer http.ResponseWriter, request *http.Request) {
	utils.RunStageCommand(controller.Container, writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		userId, err := utils.PathIdentifier(request, "userId")
		if err != nil {
			return err
		}
		var body dtos.RemoveGuestRequest
		if request.ContentLength > 0 {
			if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
				return err
			}
		}
		return (removeguestfromstage.Handler{Container: controller.Container}).Execute(request.Context(), removeguestfromstage.Command{Actor: actor, LiveId: liveId, GuestUserId: userId, Reason: body.Reason})
	})
}

func (controller StageController) MuteStreamer(writer http.ResponseWriter, request *http.Request) {
	utils.RunStageCommand(controller.Container, writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		userId, err := resolveTargetUser(request, actor)
		if err != nil {
			return err
		}
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidateMuteRequest)
		if err != nil {
			return err
		}
		return (mutestagestreamer.Handler{Container: controller.Container}).Execute(request.Context(), mutestagestreamer.Command{Actor: actor, LiveId: liveId, TargetUserId: userId, Input: types.MuteGuestInput{Audio: body.Audio, Video: body.Video}})
	})
}

func (controller StageController) LeaveStage(writer http.ResponseWriter, request *http.Request) {
	utils.RunStageCommand(controller.Container, writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		return (leavestageasguest.Handler{Container: controller.Container}).Execute(request.Context(), leavestageasguest.Command{Actor: actor, LiveId: liveId})
	})
}

func (controller StageController) ReportGuestConnection(writer http.ResponseWriter, request *http.Request) {
	utils.RunStageCommand(controller.Container, writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidateConnectionRequest)
		if err != nil {
			return err
		}
		return (reportguestmediaconnection.Handler{Container: controller.Container}).Execute(request.Context(), reportguestmediaconnection.Command{Actor: actor, LiveId: liveId, Connected: *body.Connected})
	})
}
