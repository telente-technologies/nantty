package controllers

import (
	"net/http"

	"github.com/google/uuid"

	createscheduledreport "zudomart/modules/ads/src/modules/reporting/commands/createScheduledReport"
	deletescheduledreport "zudomart/modules/ads/src/modules/reporting/commands/deleteScheduledReport"
	"zudomart/modules/ads/src/modules/reporting/dtos"
	exportreportpdf "zudomart/modules/ads/src/modules/reporting/queries/exportReportPdf"
	getreport "zudomart/modules/ads/src/modules/reporting/queries/getReport"
	listscheduledreports "zudomart/modules/ads/src/modules/reporting/queries/listScheduledReports"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

func (controller ReportingController) scoped(writer http.ResponseWriter, request *http.Request, work func(user, account uuid.UUID) error) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		user, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		account, err := utils.PathIdentifier(request, "accountId")
		if err != nil {
			return err
		}
		return work(user, account)
	})
}

func (controller ReportingController) ExportPdf(writer http.ResponseWriter, request *http.Request) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		user, account, report, columns, err := controller.parse(request)
		if err != nil {
			return err
		}
		output, err := (exportreportpdf.Handler{Container: controller.Container}).Execute(request.Context(), exportreportpdf.Query{Report: getreport.Query{AccountId: account, UserId: user, Report: report}, Columns: columns})
		if err != nil {
			return err
		}
		writer.Header().Set("Content-Type", "application/pdf")
		writer.Header().Set("Content-Disposition", `attachment; filename="ads-report.pdf"`)
		_, _ = writer.Write(output)
		return nil
	})
}

func (controller ReportingController) ListScheduled(writer http.ResponseWriter, request *http.Request) {
	controller.scoped(writer, request, func(user, account uuid.UUID) error {
		items, err := (listscheduledreports.Handler{Container: controller.Container}).Execute(request.Context(), listscheduledreports.Query{AccountId: account, UserId: user})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, ""))
		return nil
	})
}

func (controller ReportingController) CreateScheduled(writer http.ResponseWriter, request *http.Request) {
	controller.scoped(writer, request, func(user, account uuid.UUID) error {
		var body dtos.ScheduledReportInput
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		created, err := (createscheduledreport.Handler{Container: controller.Container}).Execute(request.Context(), createscheduledreport.Command{AccountId: account, UserId: user, Input: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, created)
		return nil
	})
}

func (controller ReportingController) DeleteScheduled(writer http.ResponseWriter, request *http.Request) {
	controller.scoped(writer, request, func(user, account uuid.UUID) error {
		reportId, err := utils.PathIdentifier(request, "scheduledReportId")
		if err != nil {
			return err
		}
		if err := (deletescheduledreport.Handler{Container: controller.Container}).Execute(request.Context(), deletescheduledreport.Command{AccountId: account, ReportId: reportId, UserId: user}); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}
