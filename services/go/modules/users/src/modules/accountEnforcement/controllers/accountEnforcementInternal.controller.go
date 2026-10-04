package controllers

import (
	"crypto/subtle"
	"net/http"

	"github.com/google/uuid"

	usersErrors "zudomart/modules/users/src/errors"
	banuser "zudomart/modules/users/src/modules/accountEnforcement/commands/banUser"
	restrictuser "zudomart/modules/users/src/modules/accountEnforcement/commands/restrictUser"
	suspenduser "zudomart/modules/users/src/modules/accountEnforcement/commands/suspendUser"
	warnuser "zudomart/modules/users/src/modules/accountEnforcement/commands/warnUser"
	"zudomart/modules/users/src/modules/accountEnforcement/dtos"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
	"zudomart/modules/users/src/types"
	"zudomart/modules/users/src/utils"
	"zudomart/platform/httpserver"
)

func (controller AccountEnforcementController) InternalAction(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.Privacy.InternalApiToken
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.InternalActionRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	actor := types.StaffActor{Id: body.Actor.Id, Name: body.Actor.Name, Role: body.Actor.Role, IpAddress: body.Actor.IpAddress, RequestId: body.Actor.RequestId, StepUp: body.Actor.StepUp}
	var result any
	switch body.Action {
	case "restrict":
		days := 0
		if body.DurationDays != nil {
			days = *body.DurationDays
		}
		result, err = restrictuser.Handler{Container: controller.Container}.Execute(request.Context(), restrictuser.Command{Actor: actor, TargetId: body.UserId, Features: body.Features, DurationDays: days, Reason: body.Reason})
	case "suspend":
		result, err = controller.internalSuspend(request, body, actor)
	case "ban":
		result, err = banuser.Handler{Container: controller.Container}.Execute(request.Context(), banuser.Command{Actor: actor, TargetId: body.UserId, DurationDays: body.DurationDays, Reason: body.Reason})
	case "warn":
		result, err = warnuser.Handler{Container: controller.Container}.Execute(request.Context(), warnuser.Command{Actor: actor, TargetId: body.UserId, Reason: body.Reason, Source: body.Source, CaseId: body.CaseId})
	default:
		err = usersErrors.ValidationFailedFor("action", "must be warn, restrict, suspend or ban")
	}
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) internalSuspend(request *http.Request, body dtos.InternalActionRequest, actor types.StaffActor) (any, error) {
	days := 0
	if body.DurationDays != nil {
		days = *body.DurationDays
	}
	command := suspenduser.Command{Actor: actor, TargetId: body.UserId, DurationDays: days, ReasonCode: body.ReasonCode, Reason: body.Reason, Source: body.Source}
	if body.CaseId != "" {
		caseId, err := uuid.Parse(body.CaseId)
		if err != nil {
			return nil, usersErrors.ValidationFailedFor("caseId", "must be a uuid")
		}
		command.CaseId = &caseId
	}
	return suspenduser.Handler{Container: controller.Container}.Execute(request.Context(), command)
}

type summariesRequest struct {
	Ids []string `json:"ids"`
}

func (controller AccountEnforcementController) InternalSummaries(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.Privacy.InternalApiToken
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[summariesRequest])
	if err != nil || len(body.Ids) > 100 {
		controller.respond(writer, request, 0, nil, usersErrors.OrConflict(err, "VALIDATION_FAILED", "Send at most 100 ids."))
		return
	}
	summaries := make([]services.PlatformUserSummary, 0, len(body.Ids))
	for _, raw := range body.Ids {
		target, err := services.LoadTarget(request.Context(), controller.Container, raw)
		if err != nil {
			continue
		}
		summary, err := services.BuildPlatformUserSummary(request.Context(), controller.Container, target)
		if err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		summaries = append(summaries, summary)
	}
	controller.respond(writer, request, http.StatusOK, map[string]any{"data": summaries, "nextCursor": nil}, nil)
}
