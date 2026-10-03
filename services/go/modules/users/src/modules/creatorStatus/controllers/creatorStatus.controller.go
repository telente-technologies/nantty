package controllers

import (
	"net/http"

	"zudomart/modules/users/src/container"
	applyforcreator "zudomart/modules/users/src/modules/creatorStatus/commands/applyForCreator"
	"zudomart/modules/users/src/utils"
	"zudomart/platform/httpserver"
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
