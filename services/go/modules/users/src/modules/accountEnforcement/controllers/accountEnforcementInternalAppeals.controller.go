package controllers

import (
	"crypto/subtle"
	"errors"
	"net/http"

	usersErrors "zudomart/modules/users/src/errors"
	decidesuspensionappeal "zudomart/modules/users/src/modules/accountEnforcement/commands/decideSuspensionAppeal"
	reinstateuser "zudomart/modules/users/src/modules/accountEnforcement/commands/reinstateUser"
	"zudomart/modules/users/src/modules/accountEnforcement/dtos"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
	"zudomart/modules/users/src/types"
	"zudomart/modules/users/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/identityports"
)

type internalAppealDecisionRequest struct {
	Outcome string     `json:"outcome"`
	Reason  string     `json:"reason"`
	Actor   dtos.Actor `json:"actor"`
}

func (controller AccountEnforcementController) internalCallerIsTrusted(writer http.ResponseWriter, request *http.Request) bool {
	expected := controller.Container.Settings.Privacy.InternalApiToken
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return false
	}
	return true
}

func (controller AccountEnforcementController) internalReinstate(request *http.Request, body dtos.InternalActionRequest, actor types.StaffActor) (any, error) {
	target, err := services.LoadTarget(request.Context(), controller.Container, body.UserId)
	if err != nil {
		return nil, err
	}
	if _, err := services.FindActiveSuspension(request.Context(), controller.Container, target); err != nil {
		var apiError *httpserver.ApiError
		if errors.As(err, &apiError) && apiError.Code == "NOT_SUSPENDED" {
			detail, err := services.BuildUserDetail(request.Context(), controller.Container, target)
			return map[string]any{"user": detail.User, "alreadyApplied": true}, err
		}
		return nil, err
	}
	auditAction := "user.reinstated"
	if body.Source != "" {
		auditAction += "." + body.Source
	}
	return reinstateuser.Handler{Container: controller.Container}.Execute(request.Context(), reinstateuser.Command{
		Actor: actor, TargetId: body.UserId, Reason: body.Reason, AuditAction: auditAction,
	})
}

func (controller AccountEnforcementController) InternalDecideAppeal(writer http.ResponseWriter, request *http.Request) {
	if !controller.internalCallerIsTrusted(writer, request) {
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[internalAppealDecisionRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	actor := types.StaffActor{Id: body.Actor.Id, Name: body.Actor.Name, Role: body.Actor.Role, IpAddress: body.Actor.IpAddress, RequestId: body.Actor.RequestId, StepUp: body.Actor.StepUp && forwardedStepUpIsValid(identityports.Default, request, body.Actor.Id)}
	if actor.Id == "" {
		controller.respond(writer, request, 0, nil, usersErrors.ValidationFailedFor("actor.id", "is required"))
		return
	}
	result, err := decidesuspensionappeal.Handler{Container: controller.Container}.DecideFromTrust(request.Context(), decidesuspensionappeal.Command{
		Actor: actor, SuspensionId: request.PathValue("caseId"), Outcome: body.Outcome, Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}
