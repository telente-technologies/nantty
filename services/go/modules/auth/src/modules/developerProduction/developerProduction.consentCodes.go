package developerproduction

import (
	"net/http"

	developerapplications "nantty/modules/auth/src/modules/developerApplications"
	"nantty/platform/httpserver"
)

func (controller Controller) ExchangeBusinessConsentCode(writer http.ResponseWriter, request *http.Request) {
	credentialID, applicationID, _, err := controller.authenticateLiveCredential(request, "")
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var input struct {
		Code         string `json:"code"`
		RedirectURI  string `json:"redirectUri"`
		CodeVerifier string `json:"codeVerifier"`
	}
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &input); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	receipt, err := developerapplications.ConsumeBusinessConsentAuthorizationCode(
		request.Context(), controller.Container.Database, input.Code, input.RedirectURI, input.CodeVerifier,
		credentialID, applicationID, controller.Container.Now().UTC(),
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store, max-age=0")
	writer.Header().Set("Pragma", "no-cache")
	httpserver.WriteJsonResponse(writer, http.StatusOK, receipt)
}
