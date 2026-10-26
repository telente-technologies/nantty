package controllers

import (
	"net/http"
	"strconv"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	listprofilesitemappage "nantty/modules/users/src/modules/sitemap/queries/listProfileSitemapPage"
	"nantty/platform/httpserver"
)

type SitemapController struct {
	Container *container.Container
}

func (controller SitemapController) ListProfiles(writer http.ResponseWriter, request *http.Request) {
	page := 0
	if raw := request.URL.Query().Get("page"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 0 || parsed > 100000 {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, usersErrors.ValidationFailedFor("page", "must be a whole number from 0"))
			return
		}
		page = parsed
	}
	result, err := listprofilesitemappage.Handler{Container: controller.Container}.Execute(request.Context(), listprofilesitemappage.Query{Page: page})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	writer.Header().Set("Cache-Control", "public, max-age=3600")
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
