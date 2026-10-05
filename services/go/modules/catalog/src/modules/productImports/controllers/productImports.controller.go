package controllers

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	importproducts "zudomart/modules/catalog/src/modules/productImports/commands/importProducts"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type ProductImportsController struct {
	Container *container.Container
}

func (controller ProductImportsController) Import(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, importproducts.Validate)
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	store := middlewares.StoreAccessFrom(request.Context())
	actor := services.DescribeStoreActor(request.Context(), controller.Container, request, middlewares.AccountIdFrom(request.Context()), store.Role)
	view, err := (importproducts.Handler{Container: controller.Container}).Execute(request.Context(), importproducts.Command{
		Store: store, Actor: actor, IdempotencyKey: request.Header.Get("Idempotency-Key"), Request: body,
	})
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}
