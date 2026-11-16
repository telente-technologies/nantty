package controllers

import (
	"net/http"
	"strconv"

	"nantty/modules/admin/src/container"
	exportfinancereport "nantty/modules/admin/src/modules/financeReports/commands/exportFinanceReport"
	"nantty/modules/admin/src/modules/financeReports/models"
	getfinanceoverview "nantty/modules/admin/src/modules/financeReports/queries/getFinanceOverview"
	getmoneybyaspect "nantty/modules/admin/src/modules/financeReports/queries/getMoneyByAspect"
	listescrows "nantty/modules/admin/src/modules/financeReports/queries/listEscrows"
	listfinanceissues "nantty/modules/admin/src/modules/financeReports/queries/listFinanceIssues"
	listfinancereports "nantty/modules/admin/src/modules/financeReports/queries/listFinanceReports"
	lookupreference "nantty/modules/admin/src/modules/financeReports/queries/lookupReference"
	httprequests "nantty/modules/admin/src/utils/httpRequests"
	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

type FinanceReportsController struct {
	Container *container.Container
}

func (controller FinanceReportsController) Overview(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := getfinanceoverview.Handler{Container: controller.Container}.Execute(request.Context(), getfinanceoverview.Query{
		Range: query.Get("range"), Currency: query.Get("currency"),
	})
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller FinanceReportsController) MoneyByAspect(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := getmoneybyaspect.Handler{Container: controller.Container}.Execute(request.Context(), getmoneybyaspect.Query{
		Aspect: query.Get("aspect"), Range: query.Get("range"), Currency: query.Get("currency"),
	})
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller FinanceReportsController) EscrowHeld(writer http.ResponseWriter, request *http.Request) {
	controller.listEscrows(writer, request, false)
}

func (controller FinanceReportsController) StuckEscrows(writer http.ResponseWriter, request *http.Request) {
	controller.listEscrows(writer, request, true)
}

func (controller FinanceReportsController) listEscrows(writer http.ResponseWriter, request *http.Request, stuckOnly bool) {
	query := request.URL.Query()
	limit, _ := strconv.Atoi(query.Get("limit"))
	result, err := listescrows.Handler{Container: controller.Container}.Execute(request.Context(), listescrows.Query{
		StuckOnly: stuckOnly, Status: query.Get("status"), Currency: query.Get("currency"), Cursor: query.Get("cursor"), Limit: limit,
	})
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller FinanceReportsController) Issues(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	limit, _ := strconv.Atoi(query.Get("limit"))
	result, err := listfinanceissues.Handler{Container: controller.Container}.Execute(request.Context(), listfinanceissues.Query{
		Queue: query.Get("queue"), Limit: limit,
	})
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller FinanceReportsController) Lookup(writer http.ResponseWriter, request *http.Request) {
	result, err := lookupreference.Handler{Container: controller.Container}.Execute(request.Context(), lookupreference.Query{
		Reference: request.URL.Query().Get("ref"),
	})
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller FinanceReportsController) Reports(writer http.ResponseWriter, request *http.Request) {
	result, err := listfinancereports.Handler{Container: controller.Container}.Execute(request.Context())
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller FinanceReportsController) Export(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, func(_ models.ExportRequest) error { return nil })
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	actor, found := staffauth.StaffFromContext(request.Context())
	if !found || !actor.SteppedUp {
		httpserver.WriteJsonResponse(writer, http.StatusForbidden, httpserver.ErrForbidden)
		return
	}
	filename, payload, err := exportfinancereport.Handler{Container: controller.Container}.Execute(request.Context(), actor, body)
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
	writer.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(payload)
}
