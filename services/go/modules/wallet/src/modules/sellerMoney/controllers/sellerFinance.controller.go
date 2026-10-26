package controllers

import (
	"net/http"
	"regexp"

	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
	getsellerfees "nantty/modules/wallet/src/modules/sellerMoney/queries/getSellerFees"
	getsellerfinancesummary "nantty/modules/wallet/src/modules/sellerMoney/queries/getSellerFinanceSummary"
	getsellersettlement "nantty/modules/wallet/src/modules/sellerMoney/queries/getSellerSettlement"
	listsellerescrow "nantty/modules/wallet/src/modules/sellerMoney/queries/listSellerEscrow"
	listsellerrefunds "nantty/modules/wallet/src/modules/sellerMoney/queries/listSellerRefunds"
	listsellersettlements "nantty/modules/wallet/src/modules/sellerMoney/queries/listSellerSettlements"
	"nantty/modules/wallet/src/modules/sellerMoney/validators"
	"nantty/platform/httpserver"
)

var settlementIdPattern = regexp.MustCompile(`^stl_[0-9]{8}$`)

func (controller SellerMoneyController) FinanceSummary(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	period, err := validators.ReadDateRange(request, seller, 30, controller.Application.Payouts.Container.Now())
	var view dtos.FinanceSummaryView
	if err == nil {
		view, err = getsellerfinancesummary.Handler{Application: controller.Application}.Execute(request.Context(), getsellerfinancesummary.Query{Seller: seller, Period: period})
	}
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerMoneyController) Fees(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	period, err := validators.ReadDateRange(request, seller, 30, controller.Application.Payouts.Container.Now())
	var view dtos.FeeBreakdownView
	if err == nil {
		view, err = getsellerfees.Handler{Application: controller.Application}.Execute(request.Context(), getsellerfees.Query{Seller: seller, Period: period})
	}
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerMoneyController) Escrow(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	values := request.URL.Query()
	err := validators.ReadEscrowStatus(values.Get("status"))
	limit := 0
	if err == nil {
		limit, err = validators.ReadLimit(request, 50)
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	after, err := validators.ReadIdentifierCursor(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	query := listsellerescrow.Query{Seller: seller, Status: values.Get("status"), Text: truncate(values.Get("q"), 80), After: after, Limit: limit}
	page, err := listsellerescrow.Handler{Application: controller.Application}.Execute(request.Context(), query)
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller SellerMoneyController) Settlements(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	limit, err := validators.ReadLimit(request, 50)
	cursor := request.URL.Query().Get("cursor")
	if err == nil && cursor != "" && !settlementIdPattern.MatchString(cursor) {
		err = httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "cursor", Message: "is not valid"}})
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	page, err := listsellersettlements.Handler{Application: controller.Application}.Execute(request.Context(), listsellersettlements.Query{Seller: seller, Cursor: cursor, Limit: limit})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller SellerMoneyController) Settlement(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	settlementId := request.PathValue("settlementId")
	if !settlementIdPattern.MatchString(settlementId) {
		controller.fail(writer, request, getsellersettlement.ErrSettlementNotFound)
		return
	}
	detail, err := getsellersettlement.Handler{Application: controller.Application}.Execute(request.Context(), getsellersettlement.Query{Seller: seller, SettlementId: settlementId})
	controller.respond(writer, request, http.StatusOK, detail, err)
}

func (controller SellerMoneyController) Refunds(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	period, err := validators.ReadDateRange(request, seller, 90, controller.Application.Payouts.Container.Now())
	limit := 0
	if err == nil {
		limit, err = validators.ReadLimit(request, 50)
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	after, err := validators.ReadIdentifierCursor(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	query := listsellerrefunds.Query{Seller: seller, Period: period, Text: truncate(request.URL.Query().Get("q"), 80), After: after, Limit: limit}
	page, err := listsellerrefunds.Handler{Application: controller.Application}.Execute(request.Context(), query)
	controller.respond(writer, request, http.StatusOK, page, err)
}

func truncate(text string, maximum int) string {
	if len(text) > maximum {
		return text[:maximum]
	}
	return text
}
