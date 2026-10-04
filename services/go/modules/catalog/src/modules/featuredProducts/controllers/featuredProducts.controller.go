package controllers

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	replacefeaturedproducts "zudomart/modules/catalog/src/modules/featuredProducts/commands/replaceFeaturedProducts"
	"zudomart/modules/catalog/src/modules/featuredProducts/dtos"
	listfeaturedproducts "zudomart/modules/catalog/src/modules/featuredProducts/queries/listFeaturedProducts"
	"zudomart/modules/catalog/src/modules/featuredProducts/validators"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type FeaturedProductsController struct {
	Container *container.Container
}

func (controller FeaturedProductsController) respond(writer http.ResponseWriter, request *http.Request, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, body)
}

func (controller FeaturedProductsController) List(writer http.ResponseWriter, request *http.Request) {
	page, err := (listfeaturedproducts.Handler{Container: controller.Container}).Execute(request.Context(), listfeaturedproducts.Query{StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId})
	controller.respond(writer, request, page, err)
}

func (controller FeaturedProductsController) Replace(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.ReplaceFeaturedProductsRequest](writer, request, validators.ValidateReplaceFeaturedProducts)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	page, err := (replacefeaturedproducts.Handler{Container: controller.Container}).Execute(request.Context(), replacefeaturedproducts.Command{Store: middlewares.StoreAccessFrom(request.Context()), Request: body})
	controller.respond(writer, request, page, err)
}
