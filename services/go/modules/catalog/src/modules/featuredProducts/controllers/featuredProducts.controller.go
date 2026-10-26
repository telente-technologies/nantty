package controllers

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	replacefeaturedproducts "nantty/modules/catalog/src/modules/featuredProducts/commands/replaceFeaturedProducts"
	"nantty/modules/catalog/src/modules/featuredProducts/dtos"
	listfeaturedproducts "nantty/modules/catalog/src/modules/featuredProducts/queries/listFeaturedProducts"
	listproductoptions "nantty/modules/catalog/src/modules/featuredProducts/queries/listProductOptions"
	"nantty/modules/catalog/src/modules/featuredProducts/validators"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
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

func (controller FeaturedProductsController) ProductOptions(writer http.ResponseWriter, request *http.Request) {
	text := request.URL.Query().Get("q")
	if len(text) > 80 {
		text = text[:80]
	}
	page, err := listproductoptions.Handler{Container: controller.Container}.Execute(request.Context(), listproductoptions.Query{Store: middlewares.StoreAccessFrom(request.Context()), Text: text})
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}
