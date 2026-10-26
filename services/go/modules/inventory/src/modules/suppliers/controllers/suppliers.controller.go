package controllers

import (
	"net/http"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/middlewares"
	createsupplier "nantty/modules/inventory/src/modules/suppliers/commands/createSupplier"
	deletesupplier "nantty/modules/inventory/src/modules/suppliers/commands/deleteSupplier"
	updatesupplier "nantty/modules/inventory/src/modules/suppliers/commands/updateSupplier"
	"nantty/modules/inventory/src/modules/suppliers/dtos"
	listsuppliers "nantty/modules/inventory/src/modules/suppliers/queries/listSuppliers"
	"nantty/modules/inventory/src/modules/suppliers/validators"
	"nantty/modules/inventory/src/utils"
	"nantty/platform/httpserver"
)

type SuppliersController struct {
	Container *container.Container
}

func (controller SuppliersController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller SuppliersController) ListSuppliers(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 50, 200)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	query := request.URL.Query()
	page, err := (listsuppliers.Handler{Container: controller.Container}).Execute(request.Context(), listsuppliers.Query{
		StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId, Text: query.Get("q"), Cursor: query.Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller SuppliersController) CreateSupplier(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.SupplierRequest](writer, request, validators.ValidateSupplier)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	view, err := (createsupplier.Handler{Container: controller.Container}).Execute(request.Context(),
		createsupplier.Command{Store: middlewares.StoreAccessFrom(request.Context()), Request: body})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller SuppliersController) UpdateSupplier(writer http.ResponseWriter, request *http.Request) {
	supplierId, err := utils.PathIdentifier(request, "supplierId")
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	body, err := utils.DecodeAndValidate[dtos.SupplierRequest](writer, request, validators.ValidateSupplier)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	view, err := (updatesupplier.Handler{Container: controller.Container}).Execute(request.Context(),
		updatesupplier.Command{Store: middlewares.StoreAccessFrom(request.Context()), SupplierId: supplierId, Request: body})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SuppliersController) DeleteSupplier(writer http.ResponseWriter, request *http.Request) {
	supplierId, err := utils.PathIdentifier(request, "supplierId")
	if err == nil {
		err = (deletesupplier.Handler{Container: controller.Container}).Execute(request.Context(),
			deletesupplier.Command{Store: middlewares.StoreAccessFrom(request.Context()), SupplierId: supplierId})
	}
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller SuppliersController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}
