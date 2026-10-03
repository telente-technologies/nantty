package controllers

import (
	"github.com/google/uuid"
	"net/http"
	"zudomart/modules/ads/src/modules/reporting/dtos"

	"zudomart/modules/ads/src/container"
	exportreportcsv "zudomart/modules/ads/src/modules/reporting/queries/exportReportCsv"
	getreport "zudomart/modules/ads/src/modules/reporting/queries/getReport"
	"zudomart/modules/ads/src/modules/reporting/validators"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

type ReportingController struct{ Container *container.Container }

func (controller ReportingController) Get(writer http.ResponseWriter, request *http.Request) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		user, account, report, _, err := controller.parse(request)
		if err != nil {
			return err
		}
		result, err := (getreport.Handler{Container: controller.Container}).Execute(request.Context(), getreport.Query{AccountId: account, UserId: user, Report: report})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func (controller ReportingController) Export(writer http.ResponseWriter, request *http.Request) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		user, account, report, columns, err := controller.parse(request)
		if err != nil {
			return err
		}
		output, err := (exportreportcsv.Handler{Container: controller.Container}).Execute(request.Context(), exportreportcsv.Query{Report: getreport.Query{AccountId: account, UserId: user, Report: report}, Columns: columns})
		if err != nil {
			return err
		}
		writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
		writer.Header().Set("Content-Disposition", `attachment; filename="ads-report.csv"`)
		_, _ = writer.Write(output)
		return nil
	})
}

func (controller ReportingController) parse(request *http.Request) (userId, accountId uuid.UUID, report dtos.ReportQuery, columns []string, err error) {
	if userId, err = utils.ActorUserId(request); err != nil {
		return
	}
	if accountId, err = utils.PathIdentifier(request, "accountId"); err != nil {
		return
	}
	report, columns, err = validators.ParseReportQuery(request.URL.Query())
	return
}
