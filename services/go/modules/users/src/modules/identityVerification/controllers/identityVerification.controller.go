package controllers

import (
	"io"
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/integrations"
	applysmileresult "nantty/modules/users/src/modules/identityVerification/commands/applySmileResult"
	requestverification "nantty/modules/users/src/modules/identityVerification/commands/requestVerification"
	startidentitycapture "nantty/modules/users/src/modules/identityVerification/commands/startIdentityCapture"
	"nantty/modules/users/src/modules/identityVerification/dtos"
	getverificationjourney "nantty/modules/users/src/modules/identityVerification/queries/getVerificationJourney"
	"nantty/modules/users/src/modules/identityVerification/services"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

const maximumCallbackBytes = 256 << 10

type IdentityVerificationController struct {
	Container *container.Container
}

func acceptAny[Request any](Request) error { return nil }

func (controller IdentityVerificationController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func (controller IdentityVerificationController) Journey(writer http.ResponseWriter, request *http.Request) {
	result, err := getverificationjourney.Handler{Container: controller.Container}.Execute(request.Context(), utils.AccountIdFromRequest(request))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller IdentityVerificationController) Request(writer http.ResponseWriter, request *http.Request) {
	result, err := requestverification.Handler{Container: controller.Container}.Execute(request.Context(), requestverification.Command{AccountId: utils.AccountIdFromRequest(request)})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller IdentityVerificationController) StartCapture(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.StartCaptureRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := startidentitycapture.Handler{Container: controller.Container}.Execute(request.Context(), startidentitycapture.Command{
		AccountId: utils.AccountIdFromRequest(request), CaseId: request.PathValue("caseId"), ConsentVersion: body.ConsentVersion, ConsentAccepted: body.ConsentAccepted,
		Platform: body.Platform, DocumentCountry: body.DocumentCountry, DocumentType: body.DocumentType,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller IdentityVerificationController) DocumentTypes(writer http.ResponseWriter, request *http.Request) {
	country := request.URL.Query().Get("country")
	documents := services.DocumentsForCountry(country)
	controller.respond(writer, request, http.StatusOK, map[string]any{"country": country, "documentTypes": documents.Types, "governmentLookup": documents.Enhanced}, nil)
}

func (controller IdentityVerificationController) SmileCallback(writer http.ResponseWriter, request *http.Request) {
	raw, err := io.ReadAll(http.MaxBytesReader(writer, request.Body, maximumCallbackBytes))
	if err != nil {
		controller.respond(writer, request, 0, nil, applysmileresult.ErrCallbackMalformed)
		return
	}
	settings := controller.Container.Settings.Verification
	verify := func(timestamp, signature string) bool {
		return integrations.VerifySmileIdSignature(settings.SmileIdApiKey, settings.SmileIdPartnerId, timestamp, signature)
	}
	result, err := applysmileresult.Handler{Container: controller.Container, Verify: verify}.Execute(request.Context(), applysmileresult.Command{RawBody: raw})
	controller.respond(writer, request, http.StatusOK, result, err)
}
