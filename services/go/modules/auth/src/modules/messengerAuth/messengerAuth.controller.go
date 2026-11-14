package messengerauth

import (
	"net/http"
	"strings"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type Controller struct{ Container *container.Container }

func (controller Controller) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}

func (controller Controller) Create(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[CreateRequest](writer, request, validateCreateRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	result, err := (Service{controller.Container}).Create(request.Context(), body, utils.ReadClientDetails(request))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if result.Session != nil {
		httpserver.WriteJsonResponse(writer, http.StatusOK, CompleteResponse{AuthSessionResponse: *result.Session, TrustedDevice: *result.TrustedDevice})
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, result.Pending)
}

func (controller Controller) Status(writer http.ResponseWriter, request *http.Request) {
	proof, ok := bearerProof(request)
	if !ok {
		controller.fail(writer, request, httpserver.NewApiError(http.StatusUnauthorized, "MESSENGER_PROOF_REQUIRED", "Authorization proof is required."))
		return
	}
	result, err := (Service{controller.Container}).Status(request.Context(), request.PathValue("authorizationId"), proof)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller Controller) ListPendingAuthorizations(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := (Service{controller.Container}).ListPendingAuthorizations(request.Context(), principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller Controller) VerifyCode(writer http.ResponseWriter, request *http.Request) {
	proof, ok := bearerProof(request)
	if !ok {
		controller.fail(writer, request, httpserver.NewApiError(http.StatusUnauthorized, "MESSENGER_PROOF_REQUIRED", "Authorization proof is required."))
		return
	}
	body, err := utils.DecodeAndValidate[VerifyCodeRequest](writer, request, validateVerifyCodeRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	err = (Service{controller.Container}).VerifyCode(request.Context(), request.PathValue("authorizationId"), proof, body.Code)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]string{"status": "approved"})
}

func (controller Controller) Complete(writer http.ResponseWriter, request *http.Request) {
	proof, ok := bearerProof(request)
	if !ok {
		controller.fail(writer, request, httpserver.NewApiError(http.StatusUnauthorized, "MESSENGER_PROOF_REQUIRED", "Authorization proof is required."))
		return
	}
	session, trusted, err := (Service{controller.Container}).Complete(request.Context(), request.PathValue("authorizationId"), proof)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, CompleteResponse{AuthSessionResponse: session, TrustedDevice: trusted})
}

func (controller Controller) Approve(writer http.ResponseWriter, request *http.Request) {
	controller.decide(writer, request, true)
}

func (controller Controller) Deny(writer http.ResponseWriter, request *http.Request) {
	controller.decide(writer, request, false)
}

func (controller Controller) decide(writer http.ResponseWriter, request *http.Request, approve bool) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	service := Service{controller.Container}
	var err error
	if approve {
		err = service.Approve(request.Context(), principal.UserId, principal.SessionId, request.PathValue("authorizationId"))
	} else {
		err = service.Deny(request.Context(), principal.UserId, principal.SessionId, request.PathValue("authorizationId"))
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller Controller) IssueCode(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := (Service{controller.Container}).IssueCode(request.Context(), principal.UserId, principal.SessionId, request.PathValue("authorizationId"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller Controller) SendRecoveryEmail(writer http.ResponseWriter, request *http.Request) {
	proof, ok := bearerProof(request)
	if !ok {
		controller.fail(writer, request, httpserver.NewApiError(http.StatusUnauthorized, "MESSENGER_PROOF_REQUIRED", "Authorization proof is required."))
		return
	}
	if _, err := utils.DecodeAndValidate[struct{}](writer, request, func(struct{}) error { return nil }); err != nil {
		controller.fail(writer, request, err)
		return
	}
	result, err := (Service{controller.Container}).SendRecoveryEmail(request.Context(), request.PathValue("authorizationId"), proof)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, result)
}

func (controller Controller) VerifyRecoveryEmail(writer http.ResponseWriter, request *http.Request) {
	proof, ok := bearerProof(request)
	if !ok {
		controller.fail(writer, request, httpserver.NewApiError(http.StatusUnauthorized, "MESSENGER_PROOF_REQUIRED", "Authorization proof is required."))
		return
	}
	body, err := utils.DecodeAndValidate[VerifyCodeRequest](writer, request, validateVerifyCodeRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	err = (Service{controller.Container}).VerifyRecoveryEmail(request.Context(), request.PathValue("authorizationId"), proof, body.Code)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]string{"status": "approved"})
}

func (controller Controller) ListDevices(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	devices, err := (Service{controller.Container}).ListDevices(request.Context(), principal.UserId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"devices": devices})
}

func (controller Controller) RevokeDevice(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	err := (Service{controller.Container}).RevokeDevice(request.Context(), principal.UserId, request.PathValue("deviceId"))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func bearerProof(request *http.Request) (string, bool) {
	value := request.Header.Get("Authorization")
	if len(value) < 8 || !strings.EqualFold(value[:7], "Bearer ") {
		return "", false
	}
	proof := strings.TrimSpace(value[7:])
	return proof, proof != ""
}
