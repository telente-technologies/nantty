package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	dismisssuggestion "nantty/modules/users/src/modules/checkmarks/commands/dismissSuggestion"
	submitblackapplication "nantty/modules/users/src/modules/checkmarks/commands/submitBlackApplication"
	submitverificationapplication "nantty/modules/users/src/modules/checkmarks/commands/submitVerificationApplication"
	"nantty/modules/users/src/modules/checkmarks/dtos"
	getmyverification "nantty/modules/users/src/modules/checkmarks/queries/getMyVerification"
	listcheckmarksuggestions "nantty/modules/users/src/modules/checkmarks/queries/listCheckmarkSuggestions"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type CheckmarksController struct {
	Container *container.Container
}

func acceptAny[Request any](Request) error { return nil }

func (controller CheckmarksController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func (controller CheckmarksController) Suggestions(writer http.ResponseWriter, request *http.Request) {
	result, err := listcheckmarksuggestions.Handler{Container: controller.Container}.Execute(request.Context(), utils.AccountIdFromRequest(request))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CheckmarksController) DismissSuggestion(writer http.ResponseWriter, request *http.Request) {
	err := dismisssuggestion.Handler{Container: controller.Container}.Execute(request.Context(), utils.AccountIdFromRequest(request), request.PathValue("color"))
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller CheckmarksController) Me(writer http.ResponseWriter, request *http.Request) {
	result, err := getmyverification.Handler{Container: controller.Container}.Execute(request.Context(), utils.AccountIdFromRequest(request))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CheckmarksController) Apply(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ApplicationRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := submitverificationapplication.Handler{Container: controller.Container}.Execute(request.Context(), submitverificationapplication.Command{
		AccountId: utils.AccountIdFromRequest(request), Kind: body.Kind, PlanId: body.PlanId, LegalName: body.LegalName, DocumentType: body.IdentityDocument.DocumentType,
		DocumentNumber: body.IdentityDocument.DocumentNumber, DocumentPhotoUrl: body.IdentityDocument.DocumentPhotoUrl, SelfiePhotoUrl: body.SelfiePhotoUrl,
		BusinessName: body.BusinessName, RegistrationNumber: body.BusinessRegistrationNumber, BusinessAddress: body.BusinessAddress, DocumentUrls: body.DocumentUrls,
	})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller CheckmarksController) ApplyBlack(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.BlackApplicationRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	id, err := submitblackapplication.Handler{Container: controller.Container}.Execute(request.Context(), submitblackapplication.Command{
		AccountId: utils.AccountIdFromRequest(request), AgencyName: body.AgencyName,
		LegalIdentityName: body.LegalIdentityName, LegalRegistrationRef: body.LegalRegistrationRef,
		JurisdictionCountryCode: body.JurisdictionCountryCode, OfficialWebsite: body.OfficialWebsite,
		OfficialContactPhone: body.OfficialContactPhone, InstitutionalEmail: body.InstitutionalEmail,
		RepresentativeName: body.RepresentativeName, RepresentativeRole: body.RepresentativeRole,
		RepresentativeEmail: body.RepresentativeEmail, RepresentativeIdRef: body.RepresentativeIdRef,
		EvidenceNotes: body.EvidenceNotes,
	})
	controller.respond(writer, request, http.StatusCreated, map[string]any{"applicationId": id, "institutionalEmailVerificationRequired": true}, err)
}
