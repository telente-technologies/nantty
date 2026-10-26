package controllers

import (
	"crypto/subtle"
	"net/http"

	"nantty/modules/users/src/container"
	getusersearchsource "nantty/modules/users/src/modules/searchSources/queries/getUserSearchSource"
	"nantty/platform/httpserver"
)

type SearchSourcesController struct {
	Container *container.Container
}

func (controller SearchSourcesController) GetUserSearchSource(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.Privacy.InternalApiToken
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	source, err := (getusersearchsource.Handler{Container: controller.Container}).Execute(request.Context(), getusersearchsource.Query{AccountId: request.PathValue("id")})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, source)
}
