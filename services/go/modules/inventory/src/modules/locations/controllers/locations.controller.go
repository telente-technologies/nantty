package controllers

import (
	"net/http"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/middlewares"
	createstorelocation "zudomart/modules/inventory/src/modules/locations/commands/createStoreLocation"
	updatestorelocation "zudomart/modules/inventory/src/modules/locations/commands/updateStoreLocation"
	"zudomart/modules/inventory/src/modules/locations/dtos"
	liststorelocations "zudomart/modules/inventory/src/modules/locations/queries/listStoreLocations"
	"zudomart/modules/inventory/src/modules/locations/validators"
	"zudomart/modules/inventory/src/utils"
	"zudomart/platform/httpserver"
)

type LocationsController struct {
	Container *container.Container
}

func (controller LocationsController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller LocationsController) ListLocations(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	page, err := (liststorelocations.Handler{Container: controller.Container}).Execute(request.Context(), liststorelocations.Query{StoreId: store.StoreId})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller LocationsController) CreateLocation(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, validators.ValidateCreateLocation)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	view, err := (createstorelocation.Handler{Container: controller.Container}).Execute(request.Context(),
		createstorelocation.Command{Store: middlewares.StoreAccessFrom(request.Context()), Request: body})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
}

func (controller LocationsController) UpdateLocation(writer http.ResponseWriter, request *http.Request) {
	locationId, err := utils.PathIdentifier(request, "locationId")
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	body, err := utils.DecodeAndValidate[dtos.UpdateLocationRequest](writer, request, validators.ValidateUpdateLocation)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	view, err := (updatestorelocation.Handler{Container: controller.Container}).Execute(request.Context(),
		updatestorelocation.Command{Store: middlewares.StoreAccessFrom(request.Context()), LocationId: locationId, Request: body})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}
