package controllers

import (
	"net/http"

	requestsellerpayout "zudomart/modules/wallet/src/modules/sellerMoney/commands/requestSellerPayout"
	savesellerpayoutschedule "zudomart/modules/wallet/src/modules/sellerMoney/commands/saveSellerPayoutSchedule"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	getsellerbalances "zudomart/modules/wallet/src/modules/sellerMoney/queries/getSellerBalances"
	getsellerpayoutschedule "zudomart/modules/wallet/src/modules/sellerMoney/queries/getSellerPayoutSchedule"
	getsellerpayoutsettings "zudomart/modules/wallet/src/modules/sellerMoney/queries/getSellerPayoutSettings"
	getsellerstatement "zudomart/modules/wallet/src/modules/sellerMoney/queries/getSellerStatement"
	listsellerpayouts "zudomart/modules/wallet/src/modules/sellerMoney/queries/listSellerPayouts"
	listsellerstatements "zudomart/modules/wallet/src/modules/sellerMoney/queries/listSellerStatements"
	listsellertransactions "zudomart/modules/wallet/src/modules/sellerMoney/queries/listSellerTransactions"
	"zudomart/modules/wallet/src/modules/sellerMoney/services"
	"zudomart/modules/wallet/src/modules/sellerMoney/validators"
	"zudomart/platform/httpserver"
	"zudomart/platform/idempotency"
	"zudomart/platform/money"
)

func (controller SellerMoneyController) Balances(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	view, err := getsellerbalances.Handler{Application: controller.Application}.Execute(request.Context(), getsellerbalances.Query{Seller: seller})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerMoneyController) Transactions(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	filter, err := validators.ReadTransactionFilter(request, seller)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	page, err := listsellertransactions.Handler{Application: controller.Application}.Execute(request.Context(), listsellertransactions.Query{Seller: seller, Filter: filter})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller SellerMoneyController) StatementCsv(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	month, err := validators.ReadMonth(request.URL.Query().Get("month"), seller)
	var detail dtos.StatementDetailView
	if err == nil {
		detail, err = getsellerstatement.Handler{Application: controller.Application}.Execute(request.Context(), getsellerstatement.Query{Seller: seller, Month: month})
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
	writer.Header().Set("Content-Disposition", `attachment; filename="wallet-statement-`+month.Format("2006-01")+`.csv"`)
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(services.StatementCsv(detail, seller.Currency, money.MinorUnitExponentForCurrency(money.CurrencyCode(seller.Currency))))
}

func (controller SellerMoneyController) Statements(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	months, err := listsellerstatements.Handler{Application: controller.Application}.Execute(request.Context(), listsellerstatements.Query{Seller: seller})
	controller.respond(writer, request, http.StatusOK, httpserver.NewCursorPage(months, ""), err)
}

func (controller SellerMoneyController) Statement(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	month, err := validators.ReadMonth(request.PathValue("month"), seller)
	var detail dtos.StatementDetailView
	if err == nil {
		detail, err = getsellerstatement.Handler{Application: controller.Application}.Execute(request.Context(), getsellerstatement.Query{Seller: seller, Month: month})
	}
	controller.respond(writer, request, http.StatusOK, detail, err)
}

func (controller SellerMoneyController) PayoutSettings(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	view, err := getsellerpayoutsettings.Handler{Application: controller.Application}.Execute(request.Context(), getsellerpayoutsettings.Query{Seller: seller})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerMoneyController) Payouts(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	limit, err := validators.ReadLimit(request, 25)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	after, err := validators.ReadIdentifierCursor(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	page, err := listsellerpayouts.Handler{Application: controller.Application}.Execute(request.Context(), listsellerpayouts.Query{Seller: seller, After: after, Limit: limit})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller SellerMoneyController) RequestPayout(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	key := request.Header.Get("Idempotency-Key")
	if !idempotency.IsValidIdempotencyKey(key) {
		controller.fail(writer, request, httpserver.NewApiError(http.StatusBadRequest, "IDEMPOTENCY_KEY_REQUIRED", "Send an Idempotency-Key header of 8-128 letters, digits, - or _."))
		return
	}
	body, err := decode(writer, request, validators.ValidateRequestPayout)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, replayed, err := requestsellerpayout.Handler{Application: controller.Application}.Execute(request.Context(), requestsellerpayout.Command{Seller: seller, Body: body, IdempotencyKey: key})
	if err == nil && replayed {
		writer.Header().Set("Idempotent-Replayed", "true")
	}
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller SellerMoneyController) PayoutSchedule(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	view, err := getsellerpayoutschedule.Handler{Application: controller.Application}.Execute(request.Context(), getsellerpayoutschedule.Query{Seller: seller})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerMoneyController) SavePayoutSchedule(writer http.ResponseWriter, request *http.Request, seller dtos.SellerContext) {
	body, err := decode(writer, request, validators.ValidateSavePayoutSchedule)
	var view dtos.PayoutScheduleView
	if err == nil {
		view, err = savesellerpayoutschedule.Handler{Application: controller.Application}.Execute(request.Context(), savesellerpayoutschedule.Command{Seller: seller, Body: body})
	}
	controller.respond(writer, request, http.StatusOK, view, err)
}
