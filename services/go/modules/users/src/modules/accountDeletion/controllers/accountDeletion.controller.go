package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	cancelaccountdeletion "nantty/modules/users/src/modules/accountDeletion/commands/cancelAccountDeletion"
	requestaccountdeletion "nantty/modules/users/src/modules/accountDeletion/commands/requestAccountDeletion"
	"nantty/modules/users/src/modules/accountDeletion/dtos"
	getmydeletionrequest "nantty/modules/users/src/modules/accountDeletion/queries/getMyDeletionRequest"
	"nantty/modules/users/src/modules/accountDeletion/validators"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type AccountDeletionController struct {
	Container *container.Container
}

func (controller AccountDeletionController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}

func (controller AccountDeletionController) respond(writer http.ResponseWriter, request *http.Request, status int, row *ent.DeletionRequest, err error) {
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, dtos.ConvertDeletionToResponse(row))
}

func (controller AccountDeletionController) Request(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, validators.ValidateRequestDeletionRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	row, err := requestaccountdeletion.Handler{Container: controller.Container}.Execute(request.Context(), requestaccountdeletion.Command{AccountId: accountId, Reason: body.Reason})
	controller.respond(writer, request, http.StatusAccepted, row, err)
}

func (controller AccountDeletionController) Cancel(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	row, err := cancelaccountdeletion.Handler{Container: controller.Container}.Execute(request.Context(), cancelaccountdeletion.Command{AccountId: accountId})
	controller.respond(writer, request, http.StatusOK, row, err)
}

func (controller AccountDeletionController) GetMine(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	row, err := getmydeletionrequest.Handler{Container: controller.Container}.Execute(request.Context(), getmydeletionrequest.Query{AccountId: accountId})
	controller.respond(writer, request, http.StatusOK, row, err)
}
