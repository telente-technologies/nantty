package controllers

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	createstore "zudomart/modules/catalog/src/modules/stores/commands/createStore"
	setstorestatus "zudomart/modules/catalog/src/modules/stores/commands/setStoreStatus"
	updatestore "zudomart/modules/catalog/src/modules/stores/commands/updateStore"
	"zudomart/modules/catalog/src/modules/stores/dtos"
	getselleraccess "zudomart/modules/catalog/src/modules/stores/queries/getSellerAccess"
	getstoredetail "zudomart/modules/catalog/src/modules/stores/queries/getStoreDetail"
	listmystores "zudomart/modules/catalog/src/modules/stores/queries/listMyStores"
	"zudomart/modules/catalog/src/modules/stores/validators"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type StoresController struct {
	Container *container.Container
}

func (controller StoresController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller StoresController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller StoresController) CreateStore(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.CreateStoreRequest](writer, request, validators.ValidateCreateStore)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	result, err := (createstore.Handler{Container: controller.Container}).Execute(request.Context(),
		createstore.Command{AccountId: middlewares.AccountIdFrom(request.Context()), Request: body})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func optionalViewer(request *http.Request) *uuid.UUID {
	if _, found := jwtauth.PrincipalFromContext(request.Context()); !found {
		return nil
	}
	identifier := middlewares.AccountIdFrom(request.Context())
	return &identifier
}

func (controller StoresController) GetStore(writer http.ResponseWriter, request *http.Request) {
	query := getstoredetail.Query{Viewer: optionalViewer(request)}
	if storeId, err := uuid.Parse(request.PathValue("storeId")); err == nil {
		query.StoreId = storeId
	} else {
		query.Slug = strings.ToLower(request.PathValue("storeId"))
	}
	view, err := (getstoredetail.Handler{Container: controller.Container}).Execute(request.Context(), query)
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller StoresController) GetSellerAccess(writer http.ResponseWriter, request *http.Request) {
	var requested *uuid.UUID
	if parsed, err := uuid.Parse(request.Header.Get("X-Seller-Store")); err == nil {
		requested = &parsed
	}
	view, err := (getselleraccess.Handler{Container: controller.Container}).Execute(request.Context(),
		getselleraccess.Query{AccountId: middlewares.AccountIdFrom(request.Context()), RequestedStore: requested})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller StoresController) ListMyStores(writer http.ResponseWriter, request *http.Request) {
	var requested *uuid.UUID
	if parsed, err := uuid.Parse(request.Header.Get("X-Seller-Store")); err == nil {
		requested = &parsed
	}
	page, err := (listmystores.Handler{Container: controller.Container}).Execute(request.Context(),
		listmystores.Query{AccountId: middlewares.AccountIdFrom(request.Context()), RequestedStore: requested})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller StoresController) SetStoreStatus(writer http.ResponseWriter, request *http.Request) {
	storeId, err := utils.PathIdentifier(request, "storeId")
	var body dtos.StoreStatusRequest
	if err == nil {
		body, err = utils.DecodeAndValidate(writer, request, validators.ValidateStoreStatus)
	}
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	view, err := (setstorestatus.Handler{Container: controller.Container}).Execute(request.Context(), setstorestatus.Command{
		Actor: services.StaffActorFrom(request), StoreId: storeId, Status: body.Status, Reason: strings.TrimSpace(body.Reason),
	})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller StoresController) UpdateStore(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.UpdateStoreRequest](writer, request, validators.ValidateUpdateStore)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	err = (updatestore.Handler{Container: controller.Container}).Execute(request.Context(),
		updatestore.Command{Store: middlewares.StoreAccessFrom(request.Context()), Request: body})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
