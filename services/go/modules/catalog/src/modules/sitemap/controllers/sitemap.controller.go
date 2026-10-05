package controllers

import (
	"net/http"
	"strconv"

	"zudomart/modules/catalog/src/container"
	listsitemapentries "zudomart/modules/catalog/src/modules/sitemap/queries/listSitemapEntries"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type SitemapController struct {
	Container *container.Container
}

func (controller SitemapController) List(writer http.ResponseWriter, request *http.Request) {
	issues := utils.Issues{}
	kind := request.PathValue("kind")
	if kind != "products" && kind != "stores" {
		httpserver.WriteJsonResponse(writer, http.StatusNotFound, httpserver.ErrNotFound)
		return
	}
	page := 1
	if raw := request.URL.Query().Get("page"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 100000 {
			issues.Add("page", "must be a positive whole number")
		}
		page = parsed
	}
	if err := issues.AsError(); err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	result, err := (listsitemapentries.Handler{Container: controller.Container}).Execute(request.Context(), listsitemapentries.Query{Kind: kind, Page: page})
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "public, max-age=3600")
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
