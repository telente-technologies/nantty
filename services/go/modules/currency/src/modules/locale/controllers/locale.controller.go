package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/currency/src/container"
	"zudomart/modules/currency/src/modules/locale/queries/listSupportedCountries"
	"zudomart/modules/currency/src/modules/locale/queries/resolveViewerLocale"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type LocaleController struct {
	Container *container.Container
}

func (controller LocaleController) ResolveViewerLocale(writer http.ResponseWriter, request *http.Request) {
	locale, err := resolveviewerlocale.Handler{Container: controller.Container}.Execute(request.Context(), resolveviewerlocale.Query{
		AccountId:            controller.readOptionalAccountId(request),
		TrustedHeaderCountry: controller.readTrustedHeader(request),
		RemoteAddress:        httpserver.ClientIP(request),
		ClientRegionHint:     request.Header.Get("X-Client-Region"),
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, locale)
}

func (controller LocaleController) ListSupportedCountries(writer http.ResponseWriter, request *http.Request) {
	result, err := listsupportedcountries.Handler{Container: controller.Container}.Execute(request.Context(), listsupportedcountries.Query{})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller LocaleController) readTrustedHeader(request *http.Request) string {
	headerName := controller.Container.Settings.TrustedCountryHeader
	if headerName == "" {
		return ""
	}
	return request.Header.Get(headerName)
}

func (controller LocaleController) readOptionalAccountId(request *http.Request) uuid.UUID {
	rawToken := jwtauth.ExtractBearerTokenFromAuthorizationHeader(request)
	tokens, err := controller.Container.Identity.StaffTokenService()
	if rawToken == "" || err != nil {
		return uuid.Nil
	}
	settings := controller.Container.Settings
	verifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, settings.TokenIssuer, settings.TokenAudience)
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
