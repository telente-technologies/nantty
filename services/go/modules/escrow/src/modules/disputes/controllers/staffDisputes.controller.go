package controllers

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	getstaffdispute "nantty/modules/escrow/src/modules/disputes/queries/getStaffDispute"
	liststaffdisputes "nantty/modules/escrow/src/modules/disputes/queries/listStaffDisputes"
	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/platform/httpserver"
)

var staffStatusGroups = map[string][]string{
	"awaiting_seller": {"awaiting_seller"}, "under_review": {"under_review"}, "resolved_refunded": {"resolved_refunded"},
	"resolved_released": {"resolved_released"}, "closed": {"closed"},
	"open": {"awaiting_seller", "under_review"}, "resolved": {"resolved_refunded", "resolved_released", "closed"},
}

func (controller DisputesController) ListStaffDisputes(writer http.ResponseWriter, request *http.Request) {
	parameters := request.URL.Query()
	collector := &ledgerutils.IssueCollector{}
	query := liststaffdisputes.Query{Search: strings.TrimSpace(parameters.Get("search")), Limit: ledgerutils.ReadPageLimit(request)}
	if status := strings.ToLower(parameters.Get("status")); status != "" && status != "all" {
		statuses, known := staffStatusGroups[status]
		if !known {
			collector.Add("status", "is not an allowed value")
		}
		query.Statuses = statuses
	}
	collector.RequireLength("search", query.Search, 0, 120)
	if err := collector.Result(); err != nil {
		controller.fail(writer, request, err)
		return
	}
	cursor, err := readCursor(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	query.AfterId = cursor
	page, err := liststaffdisputes.Handler{Application: controller.Application}.Execute(request.Context(), query)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller DisputesController) GetStaffDispute(writer http.ResponseWriter, request *http.Request) {
	disputeId, err := uuid.Parse(request.PathValue("disputeId"))
	if err != nil {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	view, err := getstaffdispute.Handler{Application: controller.Application}.Execute(request.Context(), getstaffdispute.Query{DisputeId: disputeId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}
