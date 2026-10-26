package controllers

import (
	"net/http"

	"nantty/modules/admin/src/container"
	getoverviewmetrics "nantty/modules/admin/src/modules/platformMetrics/queries/getOverviewMetrics"
	httprequests "nantty/modules/admin/src/utils/httpRequests"
	"nantty/platform/httpserver"
)

type PlatformMetricsController struct {
	Container *container.Container
}

func (controller PlatformMetricsController) Overview(writer http.ResponseWriter, request *http.Request) {
	result, err := getoverviewmetrics.Handler{Container: controller.Container}.Execute(request.Context(), getoverviewmetrics.Query{Range: request.URL.Query().Get("range")})
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
