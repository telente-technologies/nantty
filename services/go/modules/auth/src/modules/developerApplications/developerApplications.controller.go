package developerapplications

import (
	"errors"
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type Controller struct{ Container *container.Container }

func (controller Controller) List(writer http.ResponseWriter, request *http.Request) {
	accountID, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	items, err := (Service{Container: controller.Container}).List(request.Context(), accountID, request.PathValue("organizationID"))
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"applications": items})
}

func (controller Controller) Get(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	item, err := (Service{Container: controller.Container}).Get(request.Context(), account, request.PathValue("organizationID"), request.PathValue("applicationID"))
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, item)
}

func (controller Controller) GetMyCapabilities(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	organizationID := request.PathValue("organizationID")
	applicationID := request.PathValue("applicationID")
	capabilities, err := (Service{Container: controller.Container}).EffectiveCapabilities(request.Context(), account, organizationID, applicationID)
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, capabilities)
}

func (controller Controller) Create(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	input, err := utils.DecodeAndValidate[ApplicationInput](writer, request, func(value ApplicationInput) error {
		_, err := NormalizeDeveloperApplicationInput(value)
		return err
	})
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	item, replayed, err := (Service{Container: controller.Container}).Create(request.Context(), account, request.PathValue("organizationID"), request.Header.Get("Idempotency-Key"), input)
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	status := http.StatusCreated
	if replayed {
		status = http.StatusOK
	}
	httpserver.WriteJsonResponse(writer, status, item)
}

func (controller Controller) Update(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	input, err := utils.DecodeAndValidate[ApplicationInput](writer, request, func(value ApplicationInput) error {
		_, err := NormalizeDeveloperApplicationInput(value)
		return err
	})
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	item, err := (Service{Container: controller.Container}).Update(request.Context(), account, request.PathValue("organizationID"), request.PathValue("applicationID"), input)
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, item)
}

func (controller Controller) Archive(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	if err := (Service{Container: controller.Container}).Archive(request.Context(), account, request.PathValue("organizationID"), request.PathValue("applicationID")); err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller Controller) ListMemberGrants(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	items, err := (Service{Container: controller.Container}).ListMemberGrants(request.Context(), account, request.PathValue("organizationID"), request.PathValue("applicationID"))
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"members": items})
}

func (controller Controller) ReplaceMemberGrants(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	input, err := utils.DecodeAndValidate[GrantInput](writer, request, func(value GrantInput) error {
		_, err := NormalizeDeveloperApplicationGrantCapabilities(value.Capabilities)
		return err
	})
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	item, err := (Service{Container: controller.Container}).ReplaceMemberGrants(request.Context(), account, request.PathValue("organizationID"), request.PathValue("applicationID"), request.PathValue("membershipID"), input)
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, item)
}

func (controller Controller) ListBusinessConsents(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	items, err := (Service{Container: controller.Container}).ListBusinessConsents(request.Context(), account)
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"consents": items})
}

func (controller Controller) GrantBusinessConsent(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	input, err := utils.DecodeAndValidate[BusinessConsentInput](writer, request, func(value BusinessConsentInput) error {
		_, err := NormalizeBusinessConsentScopes(value.Scopes)
		return err
	})
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	item, err := (Service{Container: controller.Container}).GrantBusinessConsent(request.Context(), account, input)
	if err != nil {
		controller.writeError(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store, max-age=0")
	writer.Header().Set("Pragma", "no-cache")
	writer.Header().Set("Referrer-Policy", "no-referrer")
	httpserver.WriteJsonResponse(writer, http.StatusCreated, item)
}

func (controller Controller) RevokeBusinessConsent(writer http.ResponseWriter, request *http.Request) {
	account, ok := accountID(request)
	if !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	if err := (Service{Container: controller.Container}).RevokeBusinessConsent(request.Context(), account, request.PathValue("consentID")); err != nil {
		controller.writeError(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller Controller) DenyBusinessConsent(writer http.ResponseWriter, request *http.Request) {
	if _, ok := accountID(request); !ok {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	input, err := utils.DecodeAndValidate[BusinessConsentDenialInput](writer, request, func(value BusinessConsentDenialInput) error {
		return validateBusinessConsentAuthorizationShape(value.Authorization)
	})
	if err != nil {
		controller.writeBusinessAuthorizationError(writer, request, err)
		return
	}
	redirectURL, err := (Service{Container: controller.Container}).BuildBusinessConsentDenialRedirect(
		request.Context(), request.PathValue("applicationID"), request.PathValue("storeID"), input.Authorization,
	)
	if err != nil {
		controller.writeBusinessAuthorizationError(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store, max-age=0")
	writer.Header().Set("Pragma", "no-cache")
	writer.Header().Set("Referrer-Policy", "no-referrer")
	httpserver.WriteJsonResponse(writer, http.StatusOK, BusinessConsentDenialResponse{AuthorizationRedirectURL: redirectURL})
}

func accountID(request *http.Request) (string, bool) {
	principal, ok := jwtauth.PrincipalFromContext(request.Context())
	return principal.UserId, ok
}

func (controller Controller) writeError(writer http.ResponseWriter, request *http.Request, err error) {
	switch {
	case errors.Is(err, errInvalidApplicationAccount):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
	case errors.Is(err, errApplicationOrganizationNotFound), errors.Is(err, errApplicationNotFound), errors.Is(err, errApplicationMemberNotFound):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "DEVELOPER_APPLICATION_NOT_FOUND", "The application was not found in this organization."))
	case errors.Is(err, errBusinessConsentNotFound):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "BUSINESS_CONSENT_NOT_FOUND", "The authorization was not found or is no longer active."))
	case errors.Is(err, errInvalidBusinessConsent):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_BUSINESS_CONSENT", "Choose only the messaging permissions requested by an approved business app."))
	case errors.Is(err, errInvalidBusinessAuthorizationCode):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_BUSINESS_AUTHORIZATION_REQUEST", "The callback, state, or PKCE parameters are invalid or not registered for this app."))
	case errors.Is(err, errApplicationForbidden):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewForbiddenError("Only organization owners and admins can access the draft application registry until application-level grants are available."))
	case errors.Is(err, errInvalidApplication), errors.Is(err, errInvalidApplicationGrant), errors.Is(err, errApplicationIdempotencyRequired):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_DEVELOPER_APPLICATION", "Check the application details and required idempotency key."))
	case errors.Is(err, errApplicationIdempotencyConflict):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusConflict, "IDEMPOTENCY_KEY_REUSED", "Use a new idempotency key for different application details."))
	case errors.Is(err, errApplicationConflict):
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusConflict, "APPLICATION_NOT_EDITABLE", "Only draft applications can be edited."))
	default:
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
	}
}
