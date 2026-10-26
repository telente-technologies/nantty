package controllers

import (
	"net/http"

	"nantty/modules/users/src/container"
	banuser "nantty/modules/users/src/modules/accountEnforcement/commands/banUser"
	deleteuser "nantty/modules/users/src/modules/accountEnforcement/commands/deleteUser"
	reinstateuser "nantty/modules/users/src/modules/accountEnforcement/commands/reinstateUser"
	restrictuser "nantty/modules/users/src/modules/accountEnforcement/commands/restrictUser"
	suspenduser "nantty/modules/users/src/modules/accountEnforcement/commands/suspendUser"
	unbanuser "nantty/modules/users/src/modules/accountEnforcement/commands/unbanUser"
	"nantty/modules/users/src/modules/accountEnforcement/dtos"
	getuserdetail "nantty/modules/users/src/modules/accountEnforcement/queries/getUserDetail"
	listusers "nantty/modules/users/src/modules/accountEnforcement/queries/listUsers"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

type AccountEnforcementController struct {
	Container *container.Container
}

func acceptAny[Request any](Request) error { return nil }

func (controller AccountEnforcementController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func (controller AccountEnforcementController) ListUsers(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := listusers.Handler{Container: controller.Container}.Execute(request.Context(), listusers.Query{
		Search: query.Get("search"), Cursor: query.Get("cursor"), Status: query.Get("status"), Verification: query.Get("verification"), Role: query.Get("role"), Risk: query.Get("risk"),
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) GetUser(writer http.ResponseWriter, request *http.Request) {
	result, err := getuserdetail.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("userId"))
	staff, _ := staffauth.StaffFromContext(request.Context())
	controller.respond(writer, request, http.StatusOK, result.VisibleTo(staff), err)
}

func (controller AccountEnforcementController) Restrict(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.RestrictRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := restrictuser.Handler{Container: controller.Container}.Execute(request.Context(), restrictuser.Command{
		Actor: utils.StaffActorFromRequest(request), TargetId: request.PathValue("userId"), Features: body.Features, DurationDays: body.DurationDays, Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) Suspend(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.SuspendRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := suspenduser.Handler{Container: controller.Container}.Execute(request.Context(), suspenduser.Command{
		Actor: utils.StaffActorFromRequest(request), TargetId: request.PathValue("userId"), DurationDays: body.DurationDays, ReasonCode: body.ReasonCode, Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) Reinstate(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ReasonRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := reinstateuser.Handler{Container: controller.Container}.Execute(request.Context(), reinstateuser.Command{Actor: utils.StaffActorFromRequest(request), TargetId: request.PathValue("userId"), Reason: body.Reason})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) Ban(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.BanRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := banuser.Handler{Container: controller.Container}.Execute(request.Context(), banuser.Command{Actor: utils.StaffActorFromRequest(request), TargetId: request.PathValue("userId"), DurationDays: body.DurationDays, Reason: body.Reason})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) Unban(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ReasonRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := unbanuser.Handler{Container: controller.Container}.Execute(request.Context(), unbanuser.Command{Actor: utils.StaffActorFromRequest(request), TargetId: request.PathValue("userId"), Reason: body.Reason})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) Delete(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.DeleteRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := deleteuser.Handler{Container: controller.Container}.Execute(request.Context(), deleteuser.Command{Actor: utils.StaffActorFromRequest(request), TargetId: request.PathValue("userId"), ConfirmUsername: body.ConfirmUsername, Reason: body.Reason})
	controller.respond(writer, request, http.StatusOK, result, err)
}
