package controllers

import (
	"crypto/subtle"
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	decidecreatorapplication "nantty/modules/users/src/modules/creatorProgram/commands/decideCreatorApplication"
	submitcreatorapplication "nantty/modules/users/src/modules/creatorProgram/commands/submitCreatorApplication"
	upsertprofilesignals "nantty/modules/users/src/modules/creatorProgram/commands/upsertProfileSignals"
	"nantty/modules/users/src/modules/creatorProgram/dtos"
	getcreatorapplicationdetail "nantty/modules/users/src/modules/creatorProgram/queries/getCreatorApplicationDetail"
	getcreatoreligibility "nantty/modules/users/src/modules/creatorProgram/queries/getCreatorEligibility"
	getmycreatorapplication "nantty/modules/users/src/modules/creatorProgram/queries/getMyCreatorApplication"
	listcreatorapplications "nantty/modules/users/src/modules/creatorProgram/queries/listCreatorApplications"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type CreatorProgramController struct {
	Container *container.Container
}

func acceptAny[Request any](Request) error { return nil }

func (controller CreatorProgramController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func (controller CreatorProgramController) Eligibility(writer http.ResponseWriter, request *http.Request) {
	result, err := getcreatoreligibility.Handler{Container: controller.Container}.Execute(request.Context(), utils.AccountIdFromRequest(request))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CreatorProgramController) MyApplication(writer http.ResponseWriter, request *http.Request) {
	result, err := getmycreatorapplication.Handler{Container: controller.Container}.Execute(request.Context(), utils.AccountIdFromRequest(request))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CreatorProgramController) Submit(writer http.ResponseWriter, request *http.Request) {
	key := request.Header.Get("Idempotency-Key")
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.SubmitApplicationRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := submitcreatorapplication.Handler{Container: controller.Container}.Execute(request.Context(), submitcreatorapplication.Command{AccountId: utils.AccountIdFromRequest(request), IdempotencyKey: key, Input: body})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller CreatorProgramController) List(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := listcreatorapplications.Handler{Container: controller.Container}.Execute(request.Context(), listcreatorapplications.Query{Status: query.Get("status"), Search: query.Get("search"), Cursor: query.Get("cursor")})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CreatorProgramController) Detail(writer http.ResponseWriter, request *http.Request) {
	result, err := getcreatorapplicationdetail.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("applicationId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CreatorProgramController) decide(writer http.ResponseWriter, request *http.Request, approve bool) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.DecisionRequest])
	if err == nil {
		err = decidecreatorapplication.Handler{Container: controller.Container}.Execute(request.Context(), decidecreatorapplication.Command{
			Actor: utils.StaffActorFromRequest(request), ApplicationId: request.PathValue("applicationId"), Approve: approve, Reason: body.Reason,
		})
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.Detail(writer, request)
}

func (controller CreatorProgramController) Approve(writer http.ResponseWriter, request *http.Request) {
	controller.decide(writer, request, true)
}

func (controller CreatorProgramController) Reject(writer http.ResponseWriter, request *http.Request) {
	controller.decide(writer, request, false)
}

func (controller CreatorProgramController) PutSignals(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.Privacy.InternalApiToken
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	profileId, err := uuid.Parse(request.PathValue("profileId"))
	if err != nil {
		controller.respond(writer, request, 0, nil, usersErrors.NotFound("That profile was not found."))
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ProfileSignalsRequest])
	if err == nil {
		err = upsertprofilesignals.Handler{Container: controller.Container}.Execute(request.Context(), upsertprofilesignals.Command{ProfileId: profileId, Input: body})
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
