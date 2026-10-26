package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	chooselinkedprofiles "nantty/modules/users/src/modules/linkedProfiles/commands/chooseLinkedProfiles"
	"nantty/modules/users/src/modules/linkedProfiles/dtos"
	"nantty/modules/users/src/modules/linkedProfiles/services"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type LinkedProfilesController struct {
	Container *container.Container
}

func acceptAny[Request any](Request) error { return nil }

func (controller LinkedProfilesController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if body == nil {
		writer.WriteHeader(status)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller LinkedProfilesController) Mine(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.respond(writer, request, 0, nil, usersErrors.ErrAccountUnavailable)
		return
	}
	summary, err := services.BuildSummary(request.Context(), controller.Container, accountId)
	controller.respond(writer, request, http.StatusOK, summary, err)
}

func (controller LinkedProfilesController) Choose(writer http.ResponseWriter, request *http.Request) {
	accountId, err := utils.AuthenticatedAccountId(request)
	if err != nil {
		controller.respond(writer, request, 0, nil, usersErrors.ErrAccountUnavailable)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ChooseRequest])
	var summary services.Summary
	if err == nil {
		summary, err = chooselinkedprofiles.Handler{Container: controller.Container}.Execute(request.Context(), chooselinkedprofiles.Command{AccountId: accountId, Keep: body.Keep})
	}
	controller.respond(writer, request, http.StatusOK, summary, err)
}

func pathAccount(request *http.Request, name string) (uuid.UUID, error) {
	identifier, err := uuid.Parse(request.PathValue(name))
	if err != nil {
		return uuid.Nil, usersErrors.ErrProfileNotFound
	}
	return identifier, nil
}
