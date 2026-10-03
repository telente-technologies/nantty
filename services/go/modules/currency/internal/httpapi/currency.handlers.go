package httpapi

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/currency/internal/application"
	"zudomart/modules/currency/internal/catalog"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

func (routes CurrencyRoutes) resolveViewerLocale(writer http.ResponseWriter, request *http.Request) {
	httpserver.WriteJsonResponse(writer, http.StatusOK, routes.Application.ResolveViewerLocale(request.Context(), application.ViewerRequest{
		AccountId:            routes.readOptionalAccountId(request),
		TrustedHeaderCountry: trustedHeaderValue(request, routes.Application.Settings.TrustedCountryHeader),
		RemoteAddress:        strings.TrimSpace(request.Header.Get("X-Real-Ip")),
		ClientRegionHint:     request.Header.Get("X-Client-Region"),
	}))
}

func trustedHeaderValue(request *http.Request, headerName string) string {
	if headerName == "" {
		return ""
	}
	return request.Header.Get(headerName)
}

func (routes CurrencyRoutes) readOptionalAccountId(request *http.Request) uuid.UUID {
	rawToken := jwtauth.ExtractBearerTokenFromAuthorizationHeader(request)
	tokens, err := routes.Registry.StaffTokenService()
	if rawToken == "" || err != nil {
		return uuid.Nil
	}
	verifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, routes.TokenIssuer, routes.TokenAudience)
	principal, err := verifier.VerifyAccessTokenAndExtractPrincipal(request.Context(), rawToken)
	if err != nil {
		return uuid.Nil
	}
	accountId, err := uuid.Parse(principal.UserId)
	if err != nil {
		return uuid.Nil
	}
	return accountId
}

func (routes CurrencyRoutes) listSupportedCountries(writer http.ResponseWriter, request *http.Request) {
	countries := catalog.SupportedCountries()
	views := make([]CountryView, 0, len(countries))
	for _, country := range countries {
		currency, _ := catalog.FindSupportedCurrency(country.Currency)
		views = append(views, CountryView{CountryCode: country.Code, CountryName: country.Name, Currency: country.Currency, CurrencyName: currency.Name})
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, ListResponse[CountryView]{Data: views})
}

func (routes CurrencyRoutes) listSupportedCurrencies(writer http.ResponseWriter, request *http.Request) {
	views, err := routes.Application.ListSupportedCurrenciesWithCurrentRates(request.Context())
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, routes.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, ListResponse[application.CurrencyView]{Data: views})
}

func (routes CurrencyRoutes) convertMoney(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	amountMinor, err := strconv.ParseInt(query.Get("amountMinor"), 10, 64)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, routes.Logger, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amountMinor", Message: "must be an integer of minor units"}}))
		return
	}
	converted, err := routes.Application.ConvertMoneyBetweenSupportedCurrencies(request.Context(), amountMinor, query.Get("from"), query.Get("to"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, routes.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, converted)
}

func (routes CurrencyRoutes) listExchangeRateHistory(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	page, err := routes.Application.ListExchangeRateHistory(request.Context(), strings.ToUpper(query.Get("currency")), query.Get("cursor"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, routes.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (routes CurrencyRoutes) setExchangeRate(writer http.ResponseWriter, request *http.Request) {
	var body SetExchangeRateRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, routes.Logger, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	revision, err := routes.Application.SetExchangeRateForCurrency(request.Context(), application.SetExchangeRateInput{
		StaffId: staff.Id, StaffRole: staff.Role, Currency: request.PathValue("currency"), Rate: body.Rate, Reason: body.Reason,
		ConfirmLargeChange: body.ConfirmLargeChange, IpAddress: strings.TrimSpace(request.Header.Get("X-Real-Ip")), UserAgent: request.UserAgent(),
		RequestId: httpserver.RequestIdFromContext(request.Context()),
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, routes.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, revision)
}
