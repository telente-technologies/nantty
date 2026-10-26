package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	applyforcreator "nantty/modules/users/src/modules/creatorStatus/commands/applyForCreator"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type CreatorStatusController struct {
	Container *container.Container
}

func (controller CreatorStatusController) ApplyForCreator(writer http.ResponseWriter, request *http.Request) {
	view, err := applyforcreator.Handler{Container: controller.Container}.Execute(request.Context(), applyforcreator.Command{AccountId: utils.AccountIdFromRequest(request)})
	if err == nil {
		httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
		return
	}
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}
