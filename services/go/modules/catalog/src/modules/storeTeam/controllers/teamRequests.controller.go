package controllers

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	respondtoteamrequest "zudomart/modules/catalog/src/modules/storeTeam/commands/respondToTeamRequest"
	listteamrequests "zudomart/modules/catalog/src/modules/storeTeam/queries/listTeamRequests"
	catalogservices "zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type TeamRequestsController struct {
	Container *container.Container
}

func (controller TeamRequestsController) List(writer http.ResponseWriter, request *http.Request) {
	page, err := listteamrequests.Handler{Container: controller.Container}.Execute(request.Context(), listteamrequests.Query{AccountId: middlewares.AccountIdFrom(request.Context())})
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller TeamRequestsController) respondToRequest(writer http.ResponseWriter, request *http.Request, accept bool) {
	memberId, err := utils.PathIdentifier(request, "requestId")
	if err == nil {
		actor := catalogservices.DescribeStoreActor(request.Context(), controller.Container, request, middlewares.AccountIdFrom(request.Context()), "")
		err = respondtoteamrequest.Handler{Container: controller.Container}.Execute(request.Context(), respondtoteamrequest.Command{Actor: actor, MemberId: memberId, Accept: accept})
	}
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller TeamRequestsController) Accept(writer http.ResponseWriter, request *http.Request) {
	controller.respondToRequest(writer, request, true)
}

func (controller TeamRequestsController) Decline(writer http.ResponseWriter, request *http.Request) {
	controller.respondToRequest(writer, request, false)
}
