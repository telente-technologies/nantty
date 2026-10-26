package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	confirmbusinessdocumentupload "nantty/modules/users/src/modules/businessDocuments/commands/confirmBusinessDocumentUpload"
	createdocumentuploadintent "nantty/modules/users/src/modules/businessDocuments/commands/createDocumentUploadIntent"
	reviewbusinessdocument "nantty/modules/users/src/modules/businessDocuments/commands/reviewBusinessDocument"
	"nantty/modules/users/src/modules/businessDocuments/dtos"
	getmybusinessdocuments "nantty/modules/users/src/modules/businessDocuments/queries/getMyBusinessDocuments"
	getsellerverification "nantty/modules/users/src/modules/businessDocuments/queries/getSellerVerification"
	listbusinessdocumentsubmissions "nantty/modules/users/src/modules/businessDocuments/queries/listBusinessDocumentSubmissions"
	openbusinessdocument "nantty/modules/users/src/modules/businessDocuments/queries/openBusinessDocument"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type BusinessDocumentsController struct {
	Container *container.Container
}

func acceptAny[Request any](Request) error { return nil }

func (controller BusinessDocumentsController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func (controller BusinessDocumentsController) Mine(writer http.ResponseWriter, request *http.Request) {
	result, err := getmybusinessdocuments.Handler{Container: controller.Container}.Execute(request.Context(), utils.AccountIdFromRequest(request))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller BusinessDocumentsController) UploadIntent(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.UploadIntentRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := createdocumentuploadintent.Handler{Container: controller.Container}.Execute(request.Context(), createdocumentuploadintent.Command{
		AccountId: utils.AccountIdFromRequest(request), Kind: request.PathValue("kind"), FileName: body.FileName, ContentType: body.ContentType, SizeBytes: body.SizeBytes,
	})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller BusinessDocumentsController) Confirm(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ConfirmRequest])
	if err == nil {
		err = confirmbusinessdocumentupload.Handler{Container: controller.Container}.Execute(request.Context(), confirmbusinessdocumentupload.Command{
			AccountId: utils.AccountIdFromRequest(request), Kind: request.PathValue("kind"), DocumentId: body.DocumentId, FileUrl: body.FileUrl,
		})
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.Mine(writer, request)
}

func (controller BusinessDocumentsController) List(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := listbusinessdocumentsubmissions.Handler{Container: controller.Container}.Execute(request.Context(), query.Get("status"), query.Get("search"), query.Get("cursor"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller BusinessDocumentsController) Access(writer http.ResponseWriter, request *http.Request) {
	result, err := openbusinessdocument.Handler{Container: controller.Container}.Execute(request.Context(), utils.StaffActorFromRequest(request), request.PathValue("submissionId"), request.PathValue("documentId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller BusinessDocumentsController) review(approve bool) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ReviewRequest])
		if err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		result, err := reviewbusinessdocument.Handler{Container: controller.Container}.Execute(request.Context(), reviewbusinessdocument.Command{
			Actor: utils.StaffActorFromRequest(request), AccountId: request.PathValue("submissionId"), DocumentId: request.PathValue("documentId"), Approve: approve, Reason: body.Reason,
		})
		controller.respond(writer, request, http.StatusOK, result, err)
	}
}

func (controller BusinessDocumentsController) Approve() http.HandlerFunc {
	return controller.review(true)
}
func (controller BusinessDocumentsController) Reject() http.HandlerFunc {
	return controller.review(false)
}

func (controller BusinessDocumentsController) SellerVerification(writer http.ResponseWriter, request *http.Request) {
	result, err := getsellerverification.Handler{Container: controller.Container}.Execute(request.Context(), utils.AccountIdFromRequest(request))
	controller.respond(writer, request, http.StatusOK, result, err)
}
