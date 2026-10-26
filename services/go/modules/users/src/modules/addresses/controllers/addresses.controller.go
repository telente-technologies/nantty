package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	createaddress "nantty/modules/users/src/modules/addresses/commands/createAddress"
	deleteaddress "nantty/modules/users/src/modules/addresses/commands/deleteAddress"
	updateaddress "nantty/modules/users/src/modules/addresses/commands/updateAddress"
	"nantty/modules/users/src/modules/addresses/dtos"
	getaddress "nantty/modules/users/src/modules/addresses/queries/getAddress"
	listaddresses "nantty/modules/users/src/modules/addresses/queries/listAddresses"
	"nantty/modules/users/src/modules/addresses/services"
	"nantty/modules/users/src/modules/addresses/validators"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type AddressesController struct {
	Container *container.Container
}

func (controller AddressesController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}

func (controller AddressesController) List(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	views, err := listaddresses.Handler{Container: controller.Container}.Execute(request.Context(), listaddresses.Query{AccountId: accountId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	items := make([]dtos.AddressResponse, 0, len(views))
	for _, view := range views {
		items = append(items, dtos.ConvertViewToResponse(view))
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, ""))
}

func (controller AddressesController) Get(writer http.ResponseWriter, request *http.Request) {
	accountId, addressId, err := identifiers(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := getaddress.Handler{Container: controller.Container}.Execute(request.Context(), getaddress.Query{AccountId: accountId, AddressId: addressId})
	controller.respondWithView(writer, request, http.StatusOK, view, err)
}

func (controller AddressesController) Create(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	var body dtos.AddressRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.fail(writer, request, err)
		return
	}
	input, err := validators.ValidateCreateAddressRequest(body)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := createaddress.Handler{Container: controller.Container}.Execute(request.Context(), createaddress.Command{AccountId: accountId, Input: input})
	controller.respondWithView(writer, request, http.StatusCreated, view, err)
}

func (controller AddressesController) Update(writer http.ResponseWriter, request *http.Request) {
	accountId, addressId, err := identifiers(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	var body dtos.AddressRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.fail(writer, request, err)
		return
	}
	patch, err := validators.ValidateUpdateAddressRequest(body)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := updateaddress.Handler{Container: controller.Container}.Execute(request.Context(), updateaddress.Command{AccountId: accountId, AddressId: addressId, Patch: patch})
	controller.respondWithView(writer, request, http.StatusOK, view, err)
}

func (controller AddressesController) Delete(writer http.ResponseWriter, request *http.Request) {
	accountId, addressId, err := identifiers(request)
	if err == nil {
		err = deleteaddress.Handler{Container: controller.Container}.Execute(request.Context(), deleteaddress.Command{AccountId: accountId, AddressId: addressId})
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller AddressesController) respondWithView(writer http.ResponseWriter, request *http.Request, status int, view services.AddressView, err error) {
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, dtos.ConvertViewToResponse(view))
}

func identifiers(request *http.Request) (uuid.UUID, uuid.UUID, error) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	addressId, err := utils.ParseUuidPathValue(request, "addressId")
	return accountId, addressId, err
}
