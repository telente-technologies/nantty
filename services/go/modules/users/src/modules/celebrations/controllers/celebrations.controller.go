package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/modules/celebrations/dtos"
	"nantty/modules/users/src/modules/celebrations/services"
	"nantty/modules/users/src/modules/celebrations/validators"
	usersservices "nantty/modules/users/src/services"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/identityports"
)

type CelebrationsController struct {
	Container *container.Container
}

func (controller CelebrationsController) accountId(writer http.ResponseWriter, request *http.Request) (uuid.UUID, bool) {
	accountId, err := uuid.Parse(utils.AccountIdFromRequest(request))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, usersErrors.ErrAccountUnavailable)
		return uuid.Nil, false
	}
	return accountId, true
}

func (controller CelebrationsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}

func (controller CelebrationsController) GetMine(writer http.ResponseWriter, request *http.Request) {
	accountId, ok := controller.accountId(writer, request)
	if !ok {
		return
	}
	view, err := services.BuildViewerCelebrations(request.Context(), controller.Container, accountId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller CelebrationsController) MarkSeen(writer http.ResponseWriter, request *http.Request) {
	accountId, ok := controller.accountId(writer, request)
	if !ok {
		return
	}
	body, err := utils.DecodeAndValidate[dtos.MarkSeenRequest](writer, request, validators.ValidateMarkSeenRequest)
	if err == nil {
		err = services.MarkSeen(request.Context(), controller.Container, accountId, body)
	}
	controller.noContent(writer, request, err)
}

func (controller CelebrationsController) UpdateSettings(writer http.ResponseWriter, request *http.Request) {
	accountId, ok := controller.accountId(writer, request)
	if !ok {
		return
	}
	body, err := utils.DecodeAndValidate[dtos.UpdateSettingsRequest](writer, request, validators.ValidateUpdateSettingsRequest)
	if err == nil {
		var summary identityports.AccountSummary
		if summary, err = usersservices.LoadActiveAccountSummary(request.Context(), accountId); err == nil {
			err = services.UpdateSettings(request.Context(), controller.Container, accountId, summary.CreatedAt, body)
		}
	}
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := services.BuildViewerCelebrations(request.Context(), controller.Container, accountId)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller CelebrationsController) noContent(writer http.ResponseWriter, request *http.Request, err error) {
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}
