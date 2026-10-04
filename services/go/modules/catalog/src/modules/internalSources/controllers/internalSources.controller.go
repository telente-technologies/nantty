package controllers

import (
	"net/http"
	"strconv"
	"time"

	"zudomart/modules/catalog/src/container"
	getbrandsearchsource "zudomart/modules/catalog/src/modules/internalSources/queries/getBrandSearchSource"
	getcategorysearchsource "zudomart/modules/catalog/src/modules/internalSources/queries/getCategorySearchSource"
	getmoderationtargetpreview "zudomart/modules/catalog/src/modules/internalSources/queries/getModerationTargetPreview"
	getproductsearchsource "zudomart/modules/catalog/src/modules/internalSources/queries/getProductSearchSource"
	getstoresearchsource "zudomart/modules/catalog/src/modules/internalSources/queries/getStoreSearchSource"
	liststorevisitors "zudomart/modules/catalog/src/modules/internalSources/queries/listStoreVisitors"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

const maximumAudienceRetentionDays = 180

type InternalSourcesController struct {
	Container *container.Container
}

func (controller InternalSourcesController) respond(writer http.ResponseWriter, request *http.Request, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, body)
}

func (controller InternalSourcesController) GetSearchSource(writer http.ResponseWriter, request *http.Request) {
	identifier, err := utils.PathIdentifier(request, "id")
	if err != nil {
		controller.respond(writer, request, nil, httpserver.ErrNotFound)
		return
	}
	ctx := request.Context()
	switch request.PathValue("collection") {
	case "stores":
		source, err := (getstoresearchsource.Handler{Container: controller.Container}).Execute(ctx, getstoresearchsource.Query{StoreId: identifier})
		controller.respond(writer, request, source, err)
	case "products":
		source, err := (getproductsearchsource.Handler{Container: controller.Container}).Execute(ctx, getproductsearchsource.Query{ProductId: identifier})
		controller.respond(writer, request, source, err)
	case "categories":
		source, err := (getcategorysearchsource.Handler{Container: controller.Container}).Execute(ctx, getcategorysearchsource.Query{CategoryId: identifier})
		controller.respond(writer, request, source, err)
	case "brands":
		source, err := (getbrandsearchsource.Handler{Container: controller.Container}).Execute(ctx, getbrandsearchsource.Query{BrandId: identifier})
		controller.respond(writer, request, source, err)
	default:
		controller.respond(writer, request, nil, httpserver.ErrNotFound)
	}
}

func (controller InternalSourcesController) GetModerationTarget(writer http.ResponseWriter, request *http.Request) {
	targetType := request.PathValue("type")
	identifier, err := utils.PathIdentifier(request, "id")
	if err != nil || (targetType != "product" && targetType != "store") {
		controller.respond(writer, request, nil, httpserver.ErrNotFound)
		return
	}
	preview, err := (getmoderationtargetpreview.Handler{Container: controller.Container}).Execute(request.Context(), getmoderationtargetpreview.Query{TargetType: targetType, TargetId: identifier})
	controller.respond(writer, request, preview, err)
}

func (controller InternalSourcesController) ListStoreVisitors(writer http.ResponseWriter, request *http.Request) {
	storeId, err := utils.PathIdentifier(request, "storeId")
	limit, limitError := utils.ReadPageLimit(request, 500, 1000)
	retentionDays, retentionError := strconv.Atoi(request.URL.Query().Get("retentionDays"))
	if retentionError != nil || retentionDays < 1 || retentionDays > maximumAudienceRetentionDays {
		retentionError = httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "retentionDays", Message: "must be 1 to 180"}})
	}
	for _, failure := range []error{err, limitError, retentionError} {
		if failure != nil {
			controller.respond(writer, request, nil, failure)
			return
		}
	}
	since := controller.Container.Now().Add(-time.Duration(retentionDays) * 24 * time.Hour)
	page, err := (liststorevisitors.Handler{Container: controller.Container}).Execute(request.Context(), liststorevisitors.Query{StoreId: storeId, VisitedSince: since, Cursor: request.URL.Query().Get("cursor"), Limit: limit})
	controller.respond(writer, request, page, err)
}
