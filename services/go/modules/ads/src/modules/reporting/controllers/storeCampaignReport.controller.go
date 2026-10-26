package controllers

import (
	"net/http"
	"time"

	storecampaignreport "nantty/modules/ads/src/modules/reporting/queries/storeCampaignReport"
	"nantty/modules/ads/src/utils"
	"nantty/platform/httpserver"
)

const maximumStoreReportDays = 366

func (controller ReportingController) StoreCampaignReport(writer http.ResponseWriter, request *http.Request) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		storeId := request.PathValue("storeId")
		from, fromErr := time.Parse(time.DateOnly, request.URL.Query().Get("from"))
		to, toErr := time.Parse(time.DateOnly, request.URL.Query().Get("to"))
		if storeId == "" || len(storeId) > 80 || fromErr != nil || toErr != nil || to.Before(from) || to.Sub(from) > maximumStoreReportDays*24*time.Hour {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "from", Message: "Send from and to as YYYY-MM-DD, at most a year apart."}})
		}
		rows, err := (storecampaignreport.Handler{Container: controller.Container}).Execute(request.Context(), storecampaignreport.Query{StoreId: storeId, From: from, To: to})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(rows, ""))
		return nil
	})
}
