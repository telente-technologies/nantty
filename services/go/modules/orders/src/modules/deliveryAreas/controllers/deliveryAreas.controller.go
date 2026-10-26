package controllers

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	deletedeliveryarea "nantty/modules/orders/src/modules/deliveryAreas/commands/deleteDeliveryArea"
	savedeliveryarea "nantty/modules/orders/src/modules/deliveryAreas/commands/saveDeliveryArea"
	"nantty/modules/orders/src/modules/deliveryAreas/dtos"
	listdeliveryareas "nantty/modules/orders/src/modules/deliveryAreas/queries/listDeliveryAreas"
	"nantty/modules/orders/src/modules/deliveryAreas/validators"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type DeliveryAreasController struct {
	Container *container.Container
}

func (controller DeliveryAreasController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller DeliveryAreasController) List(writer http.ResponseWriter, request *http.Request) {
	page, err := listdeliveryareas.Handler{Container: controller.Container}.Execute(request.Context(), listdeliveryareas.Query{Store: middlewares.StoreAccessFrom(request.Context())})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller DeliveryAreasController) Create(writer http.ResponseWriter, request *http.Request) {
	input, err := utils.DecodeAndValidate[dtos.DeliveryAreaInput](writer, request, validators.ValidateNewDeliveryArea)
	var view dtos.DeliveryAreaView
	if err == nil {
		view, err = savedeliveryarea.Handler{Container: controller.Container}.Execute(request.Context(), savedeliveryarea.Command{Store: middlewares.StoreAccessFrom(request.Context()), Input: input})
	}
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller DeliveryAreasController) Update(writer http.ResponseWriter, request *http.Request) {
	areaId, err := utils.PathIdentifier(request, "areaId")
	var input dtos.DeliveryAreaInput
	if err == nil {
		input, err = utils.DecodeAndValidate[dtos.DeliveryAreaInput](writer, request, validators.AcceptPartialDeliveryArea)
	}
	var view dtos.DeliveryAreaView
	if err == nil {
		view, err = savedeliveryarea.Handler{Container: controller.Container}.Execute(request.Context(), savedeliveryarea.Command{Store: middlewares.StoreAccessFrom(request.Context()), AreaId: &areaId, Input: input})
	}
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller DeliveryAreasController) Delete(writer http.ResponseWriter, request *http.Request) {
	areaId, err := utils.PathIdentifier(request, "areaId")
	if err == nil {
		err = deletedeliveryarea.Handler{Container: controller.Container}.Execute(request.Context(), deletedeliveryarea.Command{Store: middlewares.StoreAccessFrom(request.Context()), AreaId: areaId})
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
