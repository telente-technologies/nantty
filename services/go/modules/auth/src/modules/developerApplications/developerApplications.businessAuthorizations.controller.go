package developerapplications

import (
	"errors"
	"net/http"

	"nantty/platform/httpserver"
)

func (controller Controller) GetBusinessApplicationPreview(writer http.ResponseWriter, request *http.Request) {
	if _, ok := accountID(request); !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	preview, err := (Service{Container: controller.Container}).GetBusinessApplicationPreview(request.Context(), request.PathValue("applicationID"))
	if err != nil {
		controller.writeBusinessAuthorizationError(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("Referrer-Policy", "no-referrer")
	httpserver.WriteJsonResponse(writer, http.StatusOK, preview)
}

func (controller Controller) GetBusinessConsentPreview(writer http.ResponseWriter, request *http.Request) {
	if _, ok := accountID(request); !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	authorization, err := parseBusinessConsentAuthorizationRequest(request.URL.Query())
	if err != nil {
		controller.writeBusinessAuthorizationError(writer, request, err)
		return
	}
	preview, err := (Service{Container: controller.Container}).GetBusinessConsentPreview(
		request.Context(), request.PathValue("applicationID"), request.PathValue("storeID"), authorization,
	)
	if err != nil {
		controller.writeBusinessAuthorizationError(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("Referrer-Policy", "no-referrer")
	httpserver.WriteJsonResponse(writer, http.StatusOK, preview)
}

func (controller Controller) ListBusinessAuthorizations(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	items, err := (Service{Container: controller.Container}).ListBusinessAuthorizations(request.Context(), account)
	if err != nil {
		controller.writeBusinessAuthorizationError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"authorizations": items})
}

func (controller Controller) GrantBusinessAuthorization(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	var input BusinessAuthorizationInput
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &input); err != nil {
		controller.writeBusinessAuthorizationError(writer, request, err)
		return
	}
	if _, err := NormalizeBusinessConsentScopes(input.Scopes); err != nil {
		controller.writeBusinessAuthorizationError(writer, request, err)
		return
	}
	item, err := (Service{Container: controller.Container}).GrantBusinessAuthorization(request.Context(), account, input)
	if err != nil {
		controller.writeBusinessAuthorizationError(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJsonResponse(writer, http.StatusCreated, item)
}

func (controller Controller) RevokeBusinessAuthorization(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	if err := (Service{Container: controller.Container}).RevokeBusinessAuthorization(request.Context(), account, request.PathValue("authorizationID")); err != nil {
		controller.writeBusinessAuthorizationError(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller Controller) writeBusinessAuthorizationError(writer http.ResponseWriter, request *http.Request, err error) {
	switch {
	case errors.Is(err, errInvalidApplicationAccount):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
	case errors.Is(err, errBusinessAuthorizationNotFound), errors.Is(err, errBusinessConsentNotFound):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "BUSINESS_AUTHORIZATION_NOT_FOUND", "The approved application or business authorization was not found."))
	case errors.Is(err, errBusinessAuthorizationDenied):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewForbiddenError("Only a business account member with permission to manage developer integrations can connect this store."))
	case errors.Is(err, errBusinessAuthorizationUnavailable):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusServiceUnavailable, "BUSINESS_AUTHORIZATION_UNAVAILABLE", "Business ownership could not be verified. No access was granted."))
	case errors.Is(err, errInvalidBusinessConsent):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_BUSINESS_AUTHORIZATION", "Choose valid identifiers and only messaging permissions requested by the approved app."))
	case errors.Is(err, errInvalidBusinessAuthorizationCode):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_BUSINESS_AUTHORIZATION_REQUEST", "The callback, state, or PKCE parameters are invalid or not registered for this app."))
	default:
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
	}
}
