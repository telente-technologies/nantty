package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	requestdataexport "nantty/modules/users/src/modules/dataExport/commands/requestDataExport"
	"nantty/modules/users/src/modules/dataExport/dtos"
	getdataexport "nantty/modules/users/src/modules/dataExport/queries/getDataExport"
	listdataexports "nantty/modules/users/src/modules/dataExport/queries/listDataExports"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/idempotency"
)

type DataExportController struct {
	Container *container.Container
}

func (controller DataExportController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}

func (controller DataExportController) Request(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	key := request.Header.Get("Idempotency-Key")
	if key != "" && !idempotency.IsValidIdempotencyKey(key) {
		controller.fail(writer, request, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "Idempotency-Key", Message: "must be 8-128 letters, numbers, dashes or underscores"}}))
		return
	}
	row, err := requestdataexport.Handler{Container: controller.Container}.Execute(request.Context(), requestdataexport.Command{AccountId: accountId, IdempotencyKey: key})
	controller.respondWithExport(writer, request, http.StatusAccepted, row, err)
}

func (controller DataExportController) Get(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	exportId, err := utils.ParseUuidPathValue(request, "exportId")
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	row, err := getdataexport.Handler{Container: controller.Container}.Execute(request.Context(), getdataexport.Query{AccountId: accountId, ExportId: exportId})
	controller.respondWithExport(writer, request, http.StatusOK, row, err)
}

func (controller DataExportController) List(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	rows, err := listdataexports.Handler{Container: controller.Container}.Execute(request.Context(), listdataexports.Query{AccountId: accountId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	items := make([]dtos.DataExportResponse, 0, len(rows))
	for _, row := range rows {
		item, err := dtos.ConvertExportToResponse(request.Context(), controller.Container, row)
		if err != nil {
			controller.fail(writer, request, err)
			return
		}
		items = append(items, item)
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, ""))
}

func (controller DataExportController) respondWithExport(writer http.ResponseWriter, request *http.Request, status int, row *ent.DataExportRequest, err error) {
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	response, err := dtos.ConvertExportToResponse(request.Context(), controller.Container, row)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, response)
}
