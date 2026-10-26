package controllers

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	recordaccessviolation "nantty/modules/moderation/src/modules/accessSecurity/commands/recordAccessViolation"
	recordbotscore "nantty/modules/moderation/src/modules/accessSecurity/commands/recordBotScore"
	recordchallengeoutcome "nantty/modules/moderation/src/modules/accessSecurity/commands/recordChallengeOutcome"
	recordclientsignals "nantty/modules/moderation/src/modules/accessSecurity/commands/recordClientSignals"
	getchallengestate "nantty/modules/moderation/src/modules/accessSecurity/queries/getChallengeState"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type AccessSecurityController struct {
	Container *container.Container
}

func (controller AccessSecurityController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func (controller AccessSecurityController) RecordAccessViolation(writer http.ResponseWriter, request *http.Request) {
	var body recordaccessviolation.Command
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := recordaccessviolation.Handler{Container: controller.Container}.Execute(request.Context(), body)
	controller.respond(writer, request, http.StatusAccepted, result, err)
}

func (controller AccessSecurityController) RecordChallengeOutcome(writer http.ResponseWriter, request *http.Request) {
	var body recordchallengeoutcome.Command
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := recordchallengeoutcome.Handler{Container: controller.Container}.Execute(request.Context(), body)
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccessSecurityController) RecordBotScore(writer http.ResponseWriter, request *http.Request) {
	var body recordbotscore.Command
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := recordbotscore.Handler{Container: controller.Container}.Execute(request.Context(), body)
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccessSecurityController) ChallengeState(writer http.ResponseWriter, request *http.Request) {
	result, err := getchallengestate.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("accountId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccessSecurityController) RecordClientSignals(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	var body recordclientsignals.Command
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	body.AccountId, body.DeviceId = principal.UserId, request.Header.Get("X-Device-Id")
	result, err := recordclientsignals.Handler{Container: controller.Container}.Execute(request.Context(), body)
	controller.respond(writer, request, http.StatusAccepted, result, err)
}
