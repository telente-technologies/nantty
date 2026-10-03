package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/live/src/container"
	applypresencechange "zudomart/modules/live/src/modules/internalApi/commands/applyPresenceChange"
	decidetopicaccess "zudomart/modules/live/src/modules/internalApi/queries/decideTopicAccess"
	getliveadeligibility "zudomart/modules/live/src/modules/internalApi/queries/getLiveAdEligibility"
	getlivesharecard "zudomart/modules/live/src/modules/internalApi/queries/getLiveShareCard"
	"zudomart/modules/live/src/types"
	"zudomart/modules/live/src/utils"
	"zudomart/platform/httpserver"
)

type InternalApiController struct {
	Container *container.Container
}

func (controller InternalApiController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller InternalApiController) GetShareCard(writer http.ResponseWriter, request *http.Request) {
	liveId, err := utils.PathIdentifier(request, "id")
	if err != nil {
		httpserver.WriteJsonResponse(writer, http.StatusOK, types.ShareCardView{Availability: "unavailable"})
		return
	}
	viewerId, _ := uuid.Parse(request.URL.Query().Get("viewerId"))
	card, err := (getlivesharecard.Handler{Container: controller.Container}).Execute(request.Context(), getlivesharecard.Query{LiveId: liveId, ViewerId: viewerId})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, card)
}

func (controller InternalApiController) GetTopicAccess(writer http.ResponseWriter, request *http.Request) {
	userId, err := uuid.Parse(request.URL.Query().Get("userId"))
	if err != nil {
		httpserver.WriteJsonResponse(writer, http.StatusOK, types.TopicAccessView{Reason: "unknownUser"})
		return
	}
	view, err := (decidetopicaccess.Handler{Container: controller.Container}).Execute(request.Context(), decidetopicaccess.Query{UserId: userId, Topic: request.URL.Query().Get("topic")})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller InternalApiController) GetAdEligibility(writer http.ResponseWriter, request *http.Request) {
	liveId, err := utils.PathIdentifier(request, "liveId")
	if err == nil {
		var view types.LiveAdEligibilityView
		if view, err = (getliveadeligibility.Handler{Container: controller.Container}).Execute(request.Context(), getliveadeligibility.Query{LiveId: liveId}); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
			return
		}
	}
	controller.responder().Error(writer, request, err)
}

func (controller InternalApiController) ApplyPresence(writer http.ResponseWriter, request *http.Request) {
	liveId, err := utils.PathIdentifier(request, "liveId")
	if err == nil {
		var body types.PresenceChangeInput
		if body, err = utils.DecodeAndValidate(writer, request, func(types.PresenceChangeInput) error { return nil }); err == nil {
			err = (applypresencechange.Handler{Container: controller.Container}).Execute(request.Context(), applypresencechange.Command{LiveId: liveId, Input: body})
		}
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
			return
		}
	}
	controller.responder().Error(writer, request, err)
}
