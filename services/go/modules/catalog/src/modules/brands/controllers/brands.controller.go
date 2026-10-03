package controllers

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	listbrands "zudomart/modules/catalog/src/modules/brands/queries/listBrands"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type BrandsController struct {
	Container *container.Container
}

func (controller BrandsController) ListBrands(writer http.ResponseWriter, request *http.Request) {
	page, err := (listbrands.Handler{Container: controller.Container}).Execute(request.Context(), listbrands.Query{Text: request.URL.Query().Get("q")})
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}
