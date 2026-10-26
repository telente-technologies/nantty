package routes

import (
	"net/http"

	"nantty/modules/currency/src/container"
	"nantty/modules/currency/src/modules/exchangeRates/controllers"
	"nantty/platform/staffauth"
)

const (
	permissionReadRates  = "currency.rates.read"
	permissionWriteRates = "currency.rates.write"
)

func MountExchangeRatesRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.ExchangeRatesController{Container: container}
	guard := staffauth.Guard{Registry: container.Identity}
	mux.HandleFunc("GET /api/v1/currencies", controller.ListSupportedCurrencies)
	mux.HandleFunc("GET /api/v1/currency/convert", controller.ConvertMoney)
	mux.Handle("GET /api/v1/admin/exchange-rates", guard.RequireStaff(permissionReadRates, false)(http.HandlerFunc(controller.ListExchangeRateHistory)))
	mux.Handle("PUT /api/v1/admin/exchange-rates/{currency}", guard.RequireStaff(permissionWriteRates, true)(http.HandlerFunc(controller.SetExchangeRate)))
}
