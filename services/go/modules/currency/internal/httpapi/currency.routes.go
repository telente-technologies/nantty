package httpapi

import (
	"log/slog"
	"net/http"

	"zudomart/modules/currency/internal/application"
	"zudomart/platform/identityports"
	"zudomart/platform/staffauth"
)

type CurrencyRoutes struct {
	Application   *application.CurrencyApplication
	TokenIssuer   string
	TokenAudience string
	Registry      *identityports.Registry
	Logger        *slog.Logger
}

const (
	permissionReadRates  = "currency.rates.read"
	permissionWriteRates = "currency.rates.write"
)

func (routes CurrencyRoutes) MountCurrencyRoutes(mux *http.ServeMux) {
	guard := staffauth.Guard{Registry: routes.Registry}
	mux.HandleFunc("GET /api/v1/locale", routes.resolveViewerLocale)
	mux.HandleFunc("GET /api/v1/locale/countries", routes.listSupportedCountries)
	mux.HandleFunc("GET /api/v1/currencies", routes.listSupportedCurrencies)
	mux.HandleFunc("GET /api/v1/currency/convert", routes.convertMoney)
	mux.Handle("GET /api/v1/admin/exchange-rates", guard.RequireStaff(permissionReadRates, false)(http.HandlerFunc(routes.listExchangeRateHistory)))
	mux.Handle("PUT /api/v1/admin/exchange-rates/{currency}", guard.RequireStaff(permissionWriteRates, true)(http.HandlerFunc(routes.setExchangeRate)))
}
