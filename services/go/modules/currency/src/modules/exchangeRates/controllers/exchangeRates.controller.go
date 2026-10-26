package controllers

import (
	"net/http"
	"strconv"
	"strings"

	"nantty/modules/currency/src/container"
	"nantty/modules/currency/src/modules/exchangeRates/commands/setExchangeRate"
	"nantty/modules/currency/src/modules/exchangeRates/dtos"
	"nantty/modules/currency/src/modules/exchangeRates/queries/convertMoney"
	"nantty/modules/currency/src/modules/exchangeRates/queries/listExchangeRateHistory"
	"nantty/modules/currency/src/modules/exchangeRates/queries/listSupportedCurrencies"
	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

type ExchangeRatesController struct {
	Container *container.Container
}

func (controller ExchangeRatesController) respondWithError(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}

func (controller ExchangeRatesController) ListSupportedCurrencies(writer http.ResponseWriter, request *http.Request) {
	result, err := listsupportedcurrencies.Handler{Container: controller.Container}.Execute(request.Context(), listsupportedcurrencies.Query{})
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller ExchangeRatesController) ConvertMoney(writer http.ResponseWriter, request *http.Request) {
	values := request.URL.Query()
	amountMinor, err := strconv.ParseInt(values.Get("amountMinor"), 10, 64)
	if err != nil {
		controller.respondWithError(writer, request, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amountMinor", Message: "must be an integer of minor units"}}))
		return
	}
	result, err := convertmoney.Handler{Container: controller.Container}.Execute(request.Context(), convertmoney.Query{AmountMinor: amountMinor, From: values.Get("from"), To: values.Get("to")})
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller ExchangeRatesController) ListExchangeRateHistory(writer http.ResponseWriter, request *http.Request) {
	values := request.URL.Query()
	result, err := listexchangeratehistory.Handler{Container: controller.Container}.Execute(request.Context(), listexchangeratehistory.Query{Currency: strings.ToUpper(values.Get("currency")), Cursor: values.Get("cursor")})
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller ExchangeRatesController) SetExchangeRate(writer http.ResponseWriter, request *http.Request) {
	var body dtos.SetExchangeRateRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	result, err := setexchangerate.Handler{Container: controller.Container}.Execute(request.Context(), setexchangerate.Command{
		StaffId: staff.Id, StaffRole: staff.Role, Currency: request.PathValue("currency"), Rate: body.Rate, Reason: body.Reason,
		ConfirmLargeChange: body.ConfirmLargeChange, IpAddress: httpserver.ClientIP(request), UserAgent: request.UserAgent(),
		RequestId: httpserver.RequestIdFromContext(request.Context()),
	})
	if err != nil {
		controller.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
