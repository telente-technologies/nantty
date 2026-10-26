package controllers

import (
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/middlewares"
	requestreportexport "nantty/modules/orders/src/modules/reports/commands/requestReportExport"
	"nantty/modules/orders/src/modules/reports/dtos"
	getreport "nantty/modules/orders/src/modules/reports/queries/getReport"
	getreportexport "nantty/modules/orders/src/modules/reports/queries/getReportExport"
	listreportexports "nantty/modules/orders/src/modules/reports/queries/listReportExports"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/utils"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
	"nantty/platform/sellerplans"
)

type ReportsController struct {
	Container *container.Container
}

func (controller ReportsController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func parseRange(from, to string, now time.Time) (time.Time, time.Time, error) {
	today := now.UTC().Truncate(24 * time.Hour)
	start, end := today.AddDate(0, 0, -29), today
	var err error
	if from != "" {
		if start, err = time.Parse("2006-01-02", from); err != nil {
			return start, end, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "from", Message: "must be YYYY-MM-DD"}})
		}
	}
	if to != "" {
		if end, err = time.Parse("2006-01-02", to); err != nil {
			return start, end, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "to", Message: "must be YYYY-MM-DD"}})
		}
	}
	if end.Before(start) || end.Sub(start) > 366*24*time.Hour {
		return start, end, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "from", Message: "range must be 1 to 366 days with from before to"}})
	}
	return start, end, nil
}

func (controller ReportsController) GetReport(writer http.ResponseWriter, request *http.Request) {
	kind := request.PathValue("reportKind")
	if !slices.Contains(services.ReportKinds, kind) {
		controller.respond(writer, request, 0, nil, ordererrors.ReportNotFound)
		return
	}
	store := middlewares.StoreAccessFrom(request.Context())
	if !controller.allowKind(writer, request, store.OwnerAccountId, kind) {
		return
	}
	query := request.URL.Query()
	from, to, err := parseRange(query.Get("from"), query.Get("to"), controller.Container.Now())
	var locationId *uuid.UUID
	if err == nil {
		locationId, err = readLocation(request, store)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := (getreport.Handler{Container: controller.Container}).Execute(request.Context(), getreport.Query{
		Store: store, ActorId: middlewares.AccountIdFrom(request.Context()), Kind: kind, From: from, To: to, LocationId: locationId,
	})
	if err != nil || query.Get("format") != "csv" {
		controller.respond(writer, request, http.StatusOK, result, err)
		return
	}
	content, err := services.RenderReportCsv(result, store.Currency)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	writeCsv(writer, kind+"_"+result.From+"_"+result.To+".csv", content)
}

func writeCsv(writer http.ResponseWriter, filename string, content []byte) {
	writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
	writer.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	writer.Header().Set("Content-Length", strconv.Itoa(len(content)))
	_, _ = writer.Write(content)
}

func (controller ReportsController) RequestExport(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, func(body dtos.ExportRequest) error {
		var collected utils.Issues
		if !slices.Contains(services.ReportKinds, body.Kind) {
			collected.Add("kind", "is not an exportable report")
		}
		return collected.AsError()
	})
	if err == nil && !controller.allowKind(writer, request, middlewares.StoreAccessFrom(request.Context()).OwnerAccountId, body.Kind) {
		return
	}
	var from, to time.Time
	if err == nil {
		from, to, err = parseRange(body.From, body.To, controller.Container.Now())
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (requestreportexport.Handler{Container: controller.Container}).Execute(request.Context(), requestreportexport.Command{
		Store: middlewares.StoreAccessFrom(request.Context()), ActorId: middlewares.AccountIdFrom(request.Context()), Kind: body.Kind, From: from, To: to,
	})
	controller.respond(writer, request, http.StatusAccepted, view, err)
}

func (controller ReportsController) ListExports(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 25, 100)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	page, err := (listreportexports.Handler{Container: controller.Container}).Execute(request.Context(),
		listreportexports.Query{StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId, Cursor: request.URL.Query().Get("cursor"), Limit: limit})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller ReportsController) DownloadExport(writer http.ResponseWriter, request *http.Request) {
	exportId, err := utils.PathIdentifier(request, "exportId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	job, err := (getreportexport.Handler{Container: controller.Container}).Execute(request.Context(),
		getreportexport.Query{StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId, ExportId: exportId})
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	if job.Status != "completed" || job.CsvContent == nil {
		controller.respond(writer, request, http.StatusOK, services.ExportViewOf(job), nil)
		return
	}
	writeCsv(writer, job.Kind+"_"+job.FromDate.Format("2006-01-02")+"_"+job.ToDate.Format("2006-01-02")+".csv", []byte(*job.CsvContent))
}

var freeReportKinds = []string{"sales-by-day", "sales-by-product", "sales-by-category", "sales-by-location", "tax", "inventory-valuation", "low-stock"}

func readLocation(request *http.Request, store commerceports.StoreAccess) (*uuid.UUID, error) {
	raw := request.URL.Query().Get("locationId")
	if raw == "" || raw == "all" {
		return nil, nil
	}
	locationId, err := utils.OptionalQueryIdentifier(request, "locationId")
	if err != nil {
		return nil, err
	}
	inventory, err := commerceports.Default.InventoryStock()
	if err != nil {
		return nil, err
	}
	owned, err := inventory.StoreOwnsLocations(request.Context(), store.StoreId, []uuid.UUID{*locationId})
	if err != nil {
		return nil, err
	}
	if !owned {
		return nil, ordererrors.InvalidLocation
	}
	return locationId, nil
}

func (controller ReportsController) allowKind(writer http.ResponseWriter, request *http.Request, ownerAccountId uuid.UUID, kind string) bool {
	if slices.Contains(freeReportKinds, kind) {
		return true
	}
	return sellerplans.Default.RequireFeature(writer, request, ownerAccountId, "advanced_reports")
}
