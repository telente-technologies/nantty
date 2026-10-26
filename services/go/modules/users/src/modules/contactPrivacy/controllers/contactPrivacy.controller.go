package controllers

import (
	"crypto/subtle"
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	updatecontactprivacy "nantty/modules/users/src/modules/contactPrivacy/commands/updateContactPrivacy"
	"nantty/modules/users/src/modules/contactPrivacy/services"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type ContactPrivacyController struct {
	Container *container.Container
}

type mentionRequest struct {
	WhoCanMentionMe *string `json:"whoCanMentionMe"`
}

type messageRequest struct {
	WhoCanMessageMe *string `json:"whoCanMessageMe"`
}

func acceptAny[Request any](Request) error { return nil }

func (controller ContactPrivacyController) respond(writer http.ResponseWriter, request *http.Request, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller ContactPrivacyController) accountId(request *http.Request) (uuid.UUID, error) {
	identifier, err := uuid.Parse(utils.AccountIdFromRequest(request))
	if err != nil {
		return uuid.Nil, usersErrors.ErrAccountUnavailable
	}
	return identifier, nil
}

func (controller ContactPrivacyController) GetMention(writer http.ResponseWriter, request *http.Request) {
	accountId, err := controller.accountId(request)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	result, err := services.LoadContactPrivacy(request.Context(), controller.Container.Client, accountId)
	controller.respond(writer, request, map[string]string{"whoCanMentionMe": result.WhoCanMentionMe}, err)
}

func (controller ContactPrivacyController) GetMessage(writer http.ResponseWriter, request *http.Request) {
	accountId, err := controller.accountId(request)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	result, err := services.LoadContactPrivacy(request.Context(), controller.Container.Client, accountId)
	controller.respond(writer, request, map[string]string{"whoCanMessageMe": result.WhoCanMessageMe}, err)
}

func (controller ContactPrivacyController) PutMention(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[mentionRequest])
	accountId, accountErr := controller.accountId(request)
	if err != nil || accountErr != nil {
		controller.respond(writer, request, nil, usersErrors.OrConflict(err, "UNAUTHORIZED", "Sign in to continue."))
		return
	}
	result, err := updatecontactprivacy.Handler{Container: controller.Container}.Execute(request.Context(), updatecontactprivacy.Command{AccountId: accountId, WhoCanMention: body.WhoCanMentionMe})
	controller.respond(writer, request, map[string]string{"whoCanMentionMe": result.WhoCanMentionMe}, err)
}

func (controller ContactPrivacyController) PutMessage(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[messageRequest])
	accountId, accountErr := controller.accountId(request)
	if err != nil || accountErr != nil {
		controller.respond(writer, request, nil, usersErrors.OrConflict(err, "UNAUTHORIZED", "Sign in to continue."))
		return
	}
	result, err := updatecontactprivacy.Handler{Container: controller.Container}.Execute(request.Context(), updatecontactprivacy.Command{AccountId: accountId, WhoCanMessage: body.WhoCanMessageMe})
	controller.respond(writer, request, map[string]string{"whoCanMessageMe": result.WhoCanMessageMe}, err)
}

func (controller ContactPrivacyController) Internal(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.Privacy.InternalApiToken
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	accountId, err := uuid.Parse(request.PathValue("accountId"))
	if err != nil {
		controller.respond(writer, request, nil, usersErrors.NotFound("That account was not found."))
		return
	}
	result, err := services.LoadContactPrivacy(request.Context(), controller.Container.Client, accountId)
	controller.respond(writer, request, result, err)
}
